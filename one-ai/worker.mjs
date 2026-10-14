import {APIError,requireValue,identifier,readJSON,fields} from './errors.mjs';
import {authenticate,canWrite,rateLimit} from './auth.mjs';
import {PRODUCTS,STATES,createDraft,transition} from './workflow.mjs';
import {insertDraft,getDraft,saveTransition,listDrafts,auditEvents,findRequest,hashInput} from './storage.mjs';
import {fetchLead,generateMessage} from './adapters.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export default {
 async fetch(request,env) {
  try {
   const url=new URL(request.url);
   if(url.pathname==='/health' && request.method==='GET')return reply({ok:true,service:'one-ai-master',outboundEnabled:false});
   // API is intended for same-origin CRM server proxies / private service bindings. No wildcard CORS.
   requireValue(['GET','POST'].includes(request.method),405,'Method not allowed');
   requireValue(env.DB && PRODUCTS.includes(env.PRODUCT) && env.ONE_AI_TOKEN_SECRET?.length>=32 && env.TOKEN_ISSUER && env.TOKEN_AUDIENCE,503,'Service not configured');
   const instance=await env.DB.prepare('SELECT product FROM one_ai_instance WHERE singleton=1').first();
   requireValue(instance?.product===env.PRODUCT,503,'Database isolation configuration mismatch');
   const actor=await authenticate(request,env);
   await rateLimit(env.DB,actor,'api',120);
   if(url.pathname==='/ready' && request.method==='GET') {
    requireValue(actor.role==='admin',403,'Forbidden');
    const ready=!!(env.CRM?.fetch && env.CRM_TOKEN_SECRET?.length>=32 && env.AI?.run);
    return reply({ready,product:env.PRODUCT,database:true,crmConfigured:!!env.CRM?.fetch,aiConfigured:!!env.AI?.run,outboundEnabled:false},ready?200:503);
   }
   if(url.pathname==='/api/drafts' && request.method==='GET') {
    const state=url.searchParams.get('state'), leadId=url.searchParams.get('leadId'), before=url.searchParams.get('before');
    requireValue(!state||STATES.includes(state),400,'Invalid state');
    if(leadId)identifier(leadId); if(before)identifier(before);
    return reply(await listDrafts(env.DB,actor.tenantId,{state,leadId,before}));
   }
   if(['/api/drafts','/api/drafts/generate'].includes(url.pathname) && request.method==='POST') {
    canWrite(actor);
    const generated=url.pathname.endsWith('/generate');
    const body=await readJSON(request); fields(body,generated?['leadId','language']:['leadId','language','message']);
    identifier(body.leadId,'lead'); requireValue(['te','en','hi'].includes(body.language),400,'Unsupported language');
    const key=identifier(request.headers.get('idempotency-key'),'idempotency key');
    const hash=await hashInput([env.PRODUCT,body.leadId,body.language,generated?'ai':'manual',body.message??null]);
    const existing=await findRequest(env.DB,actor,key,hash); if(existing)return reply(existing);
    await rateLimit(env.DB,actor,'create',10);
    const context=await fetchLead(env,actor,body.leadId); // Verify ownership even for manually authored drafts.
    const message=generated?await generateMessage(env,context,body.language):body.message;
    const draft=createDraft({tenantId:actor.tenantId,product:env.PRODUCT,leadId:body.leadId,language:body.language,message,actorId:actor.actorId});
    return reply(await insertDraft(env.DB,draft,{requestKey:key,requestHash:hash,source:generated?'workers-ai':'manual'}),201);
   }
   const match=url.pathname.match(/^\/api\/drafts\/([A-Za-z0-9-]+)(?:\/(transition|events|send))?$/);
   requireValue(match,404,'Not found');
   const draft=await getDraft(env.DB,actor.tenantId,match[1]);requireValue(draft,404,'Not found');
   if(request.method==='GET' && !match[2])return reply(draft);
   if(request.method==='GET' && match[2]==='events')return reply({events:await auditEvents(env.DB,actor.tenantId,draft.id)});
   if(request.method==='POST' && match[2]==='send')throw new APIError(409,'Outbound disabled: verified consent, template and provider integration required');
   if(request.method==='POST' && match[2]==='transition') {
    canWrite(actor);
    const body=await readJSON(request);fields(body,['action','version','message']);
    requireValue(Number.isSafeInteger(body.version) && body.version===draft.version,409,'Concurrent modification; reload the draft');
    requireValue(body.action==='edit'||body.message===undefined,400,'Message changes require edit action');
    const next=transition(draft,{...actor,action:body.action,message:body.message});
    return reply(await saveTransition(env.DB,draft,next,body.action,actor.actorId));
   }
   throw new APIError(405,'Method not allowed');
  } catch(e) {
   const status=e instanceof APIError?e.status:e.status===404?404:500;
   return reply({error:status===500?'Internal error':e.message},status);
  }
 }
};
