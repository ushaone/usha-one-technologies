import {createDraft,transition} from './workflow.mjs';
import {insertDraft,getDraft,saveTransition} from './storage.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers});}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function verifyToken(request, secret){
 const raw=request.headers.get('authorization')||'';
 if(!raw.startsWith('Bearer ')||!secret) return null;
 const token=raw.slice(7), parts=token.split('.');
 if(parts.length!==2) return null;
 const [payload,sig]=parts;
 if(!/^[A-Za-z0-9_-]+$/.test(payload)||!/^[A-Za-z0-9_-]+$/.test(sig)||payload.length>4096)return null;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))));
 // Constant-time comparison for equal-length signatures.
 if(sig.length!==expected.length)return null;
 let mismatch=0;for(let i=0;i<sig.length;i++)mismatch|=sig.charCodeAt(i)^expected.charCodeAt(i);
 if(mismatch)return null;
 try{
  const base=payload.replace(/-/g,'+').replace(/_/g,'/');
  const claims=JSON.parse(atob(base.padEnd(Math.ceil(base.length/4)*4,'=')));
  if(!claims||!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000)||claims.exp>Math.floor(Date.now()/1000)+3600)return null;
  if(!claims.tenantId||!claims.actorId||!['staff','manager','admin','sender'].includes(claims.role))return null;
  return claims;
 }catch{return null;}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return reply({ok:true,service:'one-ai-master',mode:'preview'});
  if(!env.DB||!env.ONE_AI_TOKEN_SECRET)return reply({error:'Service not configured'},503);
  const claims=await verifyToken(request,env.ONE_AI_TOKEN_SECRET);
  if(!claims)return reply({error:'Unauthorized'},401);
  if(!['POST','GET'].includes(request.method))return reply({error:'Method not allowed'},405);
  const parts=url.pathname.split('/').filter(Boolean);
  if(parts[0]!=='api'||parts[1]!=='drafts')return reply({error:'Not found'},404);
  try {
   if(parts.length===2&&request.method==='POST'){
    if(!['staff','manager','admin'].includes(claims.role))return reply({error:'Forbidden'},403);
    const raw=await request.text();
    if(raw.length>12000)return reply({error:'Payload too large'},413);
    const body=JSON.parse(raw);
    const draft=createDraft({...body,tenantId:claims.tenantId,actorId:claims.actorId});
    await insertDraft(env.DB,draft);
    return reply(draft,201);
   }
   if(parts.length===3&&request.method==='GET'){
    const draft=await getDraft(env.DB,claims.tenantId,parts[2]);
    return draft?reply(draft):reply({error:'Not found'},404);
   }
   if(parts.length===4&&parts[3]==='transition'&&request.method==='POST'){
    const draft=await getDraft(env.DB,claims.tenantId,parts[2]);
    if(!draft)return reply({error:'Not found'},404);
    const raw=await request.text();
    if(raw.length>2048)return reply({error:'Payload too large'},413);
    const body=JSON.parse(raw);
    // Marking sent is disabled until the outbound adapter supplies verified provider delivery evidence.
    if(body.action==='mark_sent')return reply({error:'Outbound integration not enabled'},409);
    const next=transition(draft,{action:body.action,tenantId:claims.tenantId,actorId:claims.actorId,role:claims.role});
    await saveTransition(env.DB,draft,next,body.action,claims.actorId);
    return reply(next);
   }
   return reply({error:'Not found'},404);
  }catch(e){
   if(e instanceof SyntaxError)return reply({error:'Invalid JSON'},400);
   if(/Invalid|Unknown|Unsupported|Tenant|Actor|Lead|message|role|Self-approval|transition|Concurrent/.test(e.message))return reply({error:e.message},409);
   return reply({error:'Internal error'},500);
  }
 }
};
