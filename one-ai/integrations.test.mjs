import test from 'node:test';
import assert from 'node:assert/strict';
import {createCRMClient} from './integrations/crm-client.mjs';
import {createUshaContextService} from './integrations/usha-context.mjs';
import {signClaims,verifyClaims} from './auth.mjs';
test('server CRM client signs only trusted scoped identity and rejects external/send routes',async()=>{
 const secret='test-key-'.repeat(6);let calls=0;
 const client=createCRMClient({secret,issuer:'crm',audience:'engine',product:'usha-one',binding:{async fetch(r){calls++;
  const c=await verifyClaims(r.headers.get('authorization').slice(7),secret,{issuer:'crm',audience:'engine',product:'usha-one'});
  assert.equal(c.tenantId,'t');assert.equal(c.sub,'s');assert.equal(r.headers.get('idempotency-key'),'key1');return Response.json({ok:true});}}});
 const actor={tenantId:'t',actorId:'s',authVersion:1};
 assert.equal((await client(actor,'/api/drafts/generate',{method:'POST',body:{leadId:'L1',language:'en'},idempotencyKey:'key1'})).status,200);
 for(const path of ['https://attacker.test/api/drafts','//attacker.test/api/drafts','/api/drafts/a/send','/health'])await assert.rejects(()=>client(actor,path));
 await assert.rejects(()=>client({...actor,authVersion:undefined},'/api/drafts'));assert.equal(calls,1);
});
test('USHA context contract verifies authentication, ownership and strips all PII',async()=>{
 const secret='test-crm-key-'.repeat(4);let lookups=0;
 const service=createUshaContextService({async findLead({tenantId,leadId}) {lookups++;return {tenantId:leadId==='wrong'?'other':tenantId,leadId,status:'New',name:'PRIVATE',email:'PRIVATE',notes:'PRIVATE'};}});
 const env={CRM_TOKEN_SECRET:secret,ENGINE_AUDIENCE:'engine'};
 async function call(leadId,product='usha-one') {const now=Math.floor(Date.now()/1000);const token=await signClaims({iss:'engine',aud:'one-ai-crm',product,tenantId:'t',sub:'s',version:1,iat:now,exp:now+60,jti:'j',leadId},secret);
 return service.fetch(new Request('https://crm.internal/context/'+leadId,{headers:{authorization:'Bearer '+token}}),env);}
 const result=await call('L1');assert.equal(result.status,200);assert.deepEqual(await result.json(),{tenantId:'t',leadId:'L1',status:'New',product:'usha-one'});
 assert.equal((await call('wrong')).status,404);assert.equal((await call('L1','neo-school-india')).status,401);assert.equal(lookups,2);
});
