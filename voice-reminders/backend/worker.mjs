import {normalizeRow, escapeXML, messageFor, validateTemplate} from '../dist/core.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
async function equal(a,b){const enc=new TextEncoder();const hash=x=>crypto.subtle.digest('SHA-256',enc.encode(x));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;const xx=new Uint8Array(x),yy=new Uint8Array(y);for(let i=0;i<xx.length;i++)diff|=xx[i]^yy[i];return diff===0;}
export async function signature(url,params,token){let value=url;for(const key of [...new Set(params.keys())].sort()){for(const v of [...new Set(params.getAll(key))].sort())value+=key+v;}const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))));}
export async function db(env,path,body,method){const response=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Database request failed ('+response.status+')');const text=await response.text();return text?JSON.parse(text):null;}
const readyDB=e=>!!(e.SUPABASE_URL&&e.SUPABASE_SERVICE_ROLE_KEY);
const readyVoice=e=>!!(e.TWILIO_ACCOUNT_SID&&e.TWILIO_AUTH_TOKEN&&e.TWILIO_FROM&&e.PUBLIC_BASE_URL&&e.TWILIO_VOICE);
async function body(req){const reader=req.body?.getReader();if(!reader)throw Error('Request body required');let n=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>600000){await reader.cancel();throw Error('Request too large');}chunks.push(value);}const bytes=new Uint8Array(n);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return new TextDecoder().decode(bytes);}
const twilioAuth=e=>'Basic '+btoa(e.TWILIO_ACCOUNT_SID+':'+e.TWILIO_AUTH_TOKEN);
export async function runBatch(env){
 if(env.CALL_MODE!=='live'||!readyDB(env)||!readyVoice(env))return {sent:0,reason:'Live calling is disabled or not configured'};
 const jobs=await db(env,'rpc/vr_claim',{p_limit:10});let sent=0;
 for(const job of jobs){
  const work=await db(env,'rpc/vr_begin',{p_id:job.id});if(!work)continue;
  const text=messageFor({...work.customer,...work.due},work.settings);
  const form=new URLSearchParams({To:work.customer.phone,From:env.TWILIO_FROM,Twiml:'<Response><Say language="te-IN" voice="'+escapeXML(env.TWILIO_VOICE)+'">'+escapeXML(text)+'</Say></Response>',StatusCallback:env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/webhooks/twilio?id='+job.id,StatusCallbackMethod:'POST',Timeout:'25'});
  for(const event of ['initiated','ringing','answered','completed'])form.append('StatusCallbackEvent',event);
  try{
   const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+env.TWILIO_ACCOUNT_SID+'/Calls.json',{method:'POST',headers:{Authorization:twilioAuth(env),'content-type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(15000)});
   if(!response.ok){
    // 5xx/timeouts are ambiguous: never redial automatically after an uncertain acceptance.
    await db(env,'rpc/vr_status',{p_id:job.id,p_sid:null,p_status:response.status>=500?'uncertain':'failed',p_error:'HTTP_'+response.status});continue;
   }
   const call=await response.json();if(!/^CA[0-9a-f]{32}$/i.test(call.sid||''))throw Error('Missing call SID');
   await db(env,'rpc/vr_status',{p_id:job.id,p_sid:call.sid,p_status:call.status||'queued'});sent++;
  }catch{
   // An interrupted DB write also stays uncertain; a verified callback can recover the SID.
   await db(env,'rpc/vr_status',{p_id:job.id,p_sid:null,p_status:'uncertain',p_error:'DISPATCH_UNCERTAIN'}).catch(()=>{});
  }
 }
 return {sent,claimed:jobs.length};
}
async function reconcile(env){
 const before=new Date(Date.now()-15*60000).toISOString();
 const rows=await db(env,'vr_attempts?select=id,call_sid&call_sid=not.is.null&status=in.(queued,initiated,ringing,in-progress,uncertain)&updated_at=lt.'+encodeURIComponent(before)+'&limit=10');
 for(const row of rows){if(!/^CA[0-9a-f]{32}$/i.test(row.call_sid))continue;const r=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+env.TWILIO_ACCOUNT_SID+'/Calls/'+row.call_sid+'.json',{headers:{Authorization:twilioAuth(env)},signal:AbortSignal.timeout(10000)});if(r.ok){const call=await r.json();await db(env,'rpc/vr_status',{p_id:row.id,p_sid:row.call_sid,p_status:call.status});}}
}
export async function handle(req,env){
 const u=new URL(req.url), path=u.pathname;
 if(path==='/webhooks/twilio'){
  if(req.method!=='POST'||!readyVoice(env)||!readyDB(env))return json({error:'Not available'},503);
  if(!UUID.test(u.searchParams.get('id')||''))return json({error:'Invalid callback'},400);
  const params=new URLSearchParams(await body(req));
  const canonical=env.PUBLIC_BASE_URL.replace(/\/$/,'')+u.pathname+u.search;
  if(!await equal(await signature(canonical,params,env.TWILIO_AUTH_TOKEN),req.headers.get('x-twilio-signature')||''))return json({error:'Invalid signature'},403);
  if(params.get('AccountSid')!==env.TWILIO_ACCOUNT_SID||!/^CA[0-9a-f]{32}$/i.test(params.get('CallSid')||''))return json({error:'Invalid account or SID'},403);
  await db(env,'rpc/vr_status',{p_id:u.searchParams.get('id'),p_sid:params.get('CallSid'),p_status:params.get('CallStatus'),p_error:params.get('ErrorCode')});return json({ok:true});
 }
 if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(req):json({error:'Not found'},404);
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32||!await equal(req.headers.get('authorization')||'','Bearer '+env.ADMIN_TOKEN))return json({error:'Sign in with the administrator access token'},401);
 if(path==='/api/health'&&req.method==='GET')return json({database:readyDB(env),voice:readyVoice(env),mode:env.CALL_MODE||'disabled'});
 if(!readyDB(env))return json({error:'Database is not connected'},503);
 if(path==='/api/run-now'&&req.method==='POST'){await reconcile(env);return json(await runBatch(env));}
 if(path==='/api/dashboard'&&req.method==='GET'){
  const offset=Math.max(0,Math.min(Number(u.searchParams.get('offset'))||0,1000000));
  const [dues,attempts,settings]=await Promise.all([db(env,'vr_dues?select=*,vr_customers(*)&order=due_date.asc,id.asc&limit=500&offset='+offset),db(env,'vr_attempts?select=*&order=created_at.desc&limit=100'),db(env,'vr_settings?id=eq.true')]);return json({dues,attempts,settings:settings[0],offset,pageSize:500});
 }
 if(path==='/api/import'&&req.method==='POST'){
  const b=JSON.parse(await body(req));if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>500)return json({error:'Import 1–500 rows at a time'},400);
  const rows=b.rows.map(normalizeRow);if(new Set(rows.map(r=>r.reference)).size!==rows.length)return json({error:'Duplicate references in upload'},400);
  const inserted=await db(env,'rpc/vr_import',{p_rows:rows});return json({inserted,skipped:rows.length-inserted});
 }
 if(path==='/api/settings'&&req.method==='PATCH'){
  const b=JSON.parse(await body(req)),patch={};if(typeof b.paused==='boolean')patch.paused=b.paused;
  if(b.template!==undefined)patch.template=validateTemplate(b.template);
  if(b.business_name!==undefined){if(typeof b.business_name!=='string'||!b.business_name.trim()||b.business_name.length>100)throw Error('Business name required (max 100 characters)');patch.business_name=b.business_name.trim();}
  if(patch.paused===false&&(env.CALL_MODE!=='live'||!readyVoice(env)))return json({error:'Configure and test the voice provider before enabling the schedule'},409);
  return json(await db(env,'vr_settings?id=eq.true',patch,'PATCH'));
 }
 const due=path.match(/^\/api\/dues\/([0-9a-f-]+)$/i);
 if(due&&UUID.test(due[1])&&req.method==='PATCH'){const b=JSON.parse(await body(req));if(!['paid','pending','paused'].includes(b.state))throw Error('Invalid state');return json(await db(env,'vr_dues?id=eq.'+due[1],{state:b.state},'PATCH'));}
 const consent=path.match(/^\/api\/customers\/([0-9a-f-]+)\/consent$/i);
 if(consent&&UUID.test(consent[1])&&req.method==='PATCH'){const b=JSON.parse(await body(req));if(typeof b.consent!=='boolean')throw Error('Consent must be true or false');return json(await db(env,'vr_customers?id=eq.'+consent[1],{consent:b.consent},'PATCH'));}
 return json({error:'Not found'},404);
}
export default {
 async fetch(req,env){let r;const origin=req.headers.get('origin');const allowed=!origin||origin===new URL(req.url).origin||origin===env.PORTAL_ORIGIN;
  if(req.method==='OPTIONS'){r=new Response(null,{status:allowed?204:403,headers:{'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'Authorization,Content-Type','access-control-max-age':'600'}});}else if(!allowed&&new URL(req.url).pathname.startsWith('/api/'))r=json({error:'Origin not allowed'},403);else{try{r=await handle(req,env);}catch(e){r=json({error:e.message.startsWith('Database')?'Database unavailable. Please retry later.':e instanceof SyntaxError?'Invalid JSON':e.message},e.message.startsWith('Database')?503:400);}}
  r=new Response(r.body,r);if(origin&&allowed)r.headers.set('access-control-allow-origin',origin);r.headers.set('vary','Origin');r.headers.set('x-content-type-options','nosniff');r.headers.set('referrer-policy','no-referrer');return r;
 },
 async scheduled(event,env,ctx){if(env.CALL_MODE!=='live'||!readyDB(env)||!readyVoice(env))return;ctx.waitUntil((async()=>{await reconcile(env);await runBatch(env);})());}
};
