// Local synthetic fixtures only. Never deploy.
import worker from '../worker.mjs';
import {verifyClaims} from '../auth.mjs';
export default {fetch(request,env) {
 const config={...env,PRODUCT:'usha-one',TOKEN_ISSUER:'local-test-crm',TOKEN_AUDIENCE:'one-ai:usha-one:local-test',
 ONE_AI_TOKEN_SECRET:'LOCAL-TEST-ONLY-DO-NOT-DEPLOY-123456789',CRM_TOKEN_SECRET:'LOCAL-CRM-ONLY-DO-NOT-DEPLOY-123456789',
 AI:{async run(_model,input){return {response:input.messages[0].content.includes('Telugu')?'నమస్కారం. మీకు మా సిబ్బంది నుంచి కాల్ కావాలా?':'Hello. Would you like a call from our team?'};}},
 CRM:{async fetch(r){const c=await verifyClaims(r.headers.get('authorization').slice(7),'LOCAL-CRM-ONLY-DO-NOT-DEPLOY-123456789',
 {issuer:'one-ai:usha-one:local-test',audience:'one-ai-crm',product:'usha-one'});
 if(!c)return Response.json({error:'Unauthorized'},{status:401});
 return Response.json({product:'usha-one',tenantId:c.tenantId,leadId:c.leadId,status:'New'});}}
 };
 return worker.fetch(request,config);
}};
