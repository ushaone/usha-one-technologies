// Mount ONLY in the verified USHA CRM backend. No browser-supplied tenant or lead context.
import {verifyClaims} from '../auth.mjs';
export function createUshaContextService({findLead}) {
 return {async fetch(request,env) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
  try {
   const match=new URL(request.url).pathname.match(/^\/context\/([A-Za-z0-9_.:@-]{1,128})$/);
   if(request.method!=='GET'||!match)return reply({error:'Not found'},404);
   const raw=request.headers.get('authorization')||'';
   const claims=await verifyClaims(raw.startsWith('Bearer ')?raw.slice(7):'',env.CRM_TOKEN_SECRET,{issuer:env.ENGINE_AUDIENCE,audience:'one-ai-crm',product:'usha-one'});
   if(!claims||claims.leadId!==match[1])return reply({error:'Unauthorized'},401);
   // Required callback must query WHERE tenant_id=tenantId AND lead_id=leadId.
   const lead=await findLead({tenantId:claims.tenantId,leadId:claims.leadId,actorId:claims.sub});
   if(!lead||lead.tenantId!==claims.tenantId||lead.leadId!==claims.leadId)return reply({error:'Not found'},404);
   const allowed=['New','Contacted','Follow-up','Interested','Visit / Meeting','Decision Pending','Converted','Lost'];
   return reply({product:'usha-one',tenantId:claims.tenantId,leadId:claims.leadId,status:allowed.includes(lead.status)?lead.status:'New'});
  }catch{return reply({error:'Context service unavailable'},503);}
 }};
}
