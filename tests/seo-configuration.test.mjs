import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/seo-audit-phase2.js';
const token='long-preview-token-for-testing-only';
const request=()=>new Request('https://preview.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({url:'https://www.example.org/'})});
const common={ENABLE_PRIVATE_AUDIT:'true',AUDIT_PREVIEW_TOKEN:token,AUDIT_RATE_LIMITER:{limit:async()=>({success:true})},AUDIT_SAFE_FETCH:{fetch:async()=>new Response('<title>OK</title>',{headers:{'content-type':'text/html'}})}};
for(const host of ['[','%%%','http://example.org','example.org:443','*.example.org','localhost','127.0.0.1']){
 test('malformed host configuration fails closed: '+host,async()=>{const r=await worker.fetch(request(),{...common,AUDIT_ALLOWED_HOSTS:host});assert.equal(r.status,503)});
}
test('disabled flag blocks outbound request',async()=>{let called=false;const r=await worker.fetch(request(),{...common,ENABLE_PRIVATE_AUDIT:'false',AUDIT_ALLOWED_HOSTS:'www.example.org',AUDIT_SAFE_FETCH:{fetch:async()=>{called=true}}});assert.equal(r.status,503);assert.equal(called,false)});
