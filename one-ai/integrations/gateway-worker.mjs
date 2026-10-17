import {APIError,requireValue,readJSON} from '../errors.mjs';
import {resolveIdentity} from './identities.mjs';
import {createCRMClient} from './crm-client.mjs';
// Deploy separately per product behind the CRM's same-origin /api/one-ai route.
// Uses existing bearer sessions only, never cookies or browser-supplied identity claims.
export default {async fetch(request,env) {
 try {
  const url=new URL(request.url);
  requireValue(/^\/api\/one-ai\/drafts(?:\/generate|\/[A-Za-z0-9-]+(?:\/(?:events|transition))?)?$/.test(url.pathname),404,'Not found');
  requireValue(['GET','POST'].includes(request.method),405,'Method not allowed');
  const origin=request.headers.get('origin');
  requireValue(!origin || (env.CRM_ORIGIN && origin===env.CRM_ORIGIN),403,'Origin not allowed');
  const actor=await resolveIdentity(request,env);
  const client=createCRMClient({binding:env.ONE_AI,secret:env.ONE_AI_TOKEN_SECRET,issuer:env.TOKEN_ISSUER,audience:env.TOKEN_AUDIENCE,product:env.PRODUCT});
  const body=request.method==='POST'?await readJSON(request):undefined;
  return await client(actor,url.pathname.replace('/api/one-ai/','/api/')+url.search,{method:request.method,body,idempotencyKey:request.headers.get('idempotency-key')});
 }catch(e){return Response.json({error:e instanceof APIError?e.message:'Identity integration unavailable'},{status:e instanceof APIError?e.status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
}};
