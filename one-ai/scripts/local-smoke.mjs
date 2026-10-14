import assert from 'node:assert/strict';
import {signClaims} from '../auth.mjs';
const base=process.env.ONE_AI_TEST_URL||'http://127.0.0.1:8791';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Synthetic smoke is local-only');
async function call(path,body,actor='staff',role) {
 const now=Math.floor(Date.now()/1000),token=await signClaims({iss:'local-test-crm',aud:'one-ai:usha-one:local-test',product:'usha-one',tenantId:'test-tenant',sub:actor,version:1,jti:crypto.randomUUID(),iat:now,exp:now+120},'LOCAL-TEST-ONLY-DO-NOT-DEPLOY-123456789');
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':crypto.randomUUID()},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json()};
}
const ready=await call('/ready',undefined,'admin');assert.equal(ready.status,200);
let r=await call('/api/drafts/generate',{leadId:'synthetic-lead',language:'te'});assert.equal(r.status,201);const id=r.data.id;
r=await call(`/api/drafts/${id}/transition`,{action:'submit',version:1});assert.equal(r.status,200);
r=await call(`/api/drafts/${id}/transition`,{action:'approve',version:2},'manager');assert.equal(r.status,200);
const stale=await call(`/api/drafts/${id}/transition`,{action:'reject',version:2},'manager');assert.equal(stale.status,409);
const audit=await call(`/api/drafts/${id}/events`);assert.deepEqual(audit.data.events.map(x=>x.action),['create','submit','approve']);
assert.equal((await call(`/api/drafts/${id}/send`,{},'manager')).status,409);
console.log('PASS: local workerd + D1 migrations, readiness, Telugu draft (stub AI), staff submission, manager approval, stale-write denial, audit and blocked outbound');
