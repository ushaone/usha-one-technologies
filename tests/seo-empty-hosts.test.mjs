import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/seo-audit-phase2.js';
const token='private-preview-token-long-enough';
const request=()=>new Request('https://preview.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({url:'https://www.example.org/'})});
const base={ENABLE_PRIVATE_AUDIT:'true',AUDIT_PREVIEW_TOKEN:token,AUDIT_ADMISSION:{idFromName:name=>name,get:()=>({fetch:async()=>Response.json({lease:'test-lease'})})},AUDIT_SAFE_FETCH:{fetch:async()=>new Response('<title>OK</title>',{headers:{'content-type':'text/html'}})}};
for(const hosts of ['www.example.org,',',www.example.org','www.example.org,,www.example.net']){
 test('rejects blank allowlist entry: '+hosts,async()=>{
  const res=await worker.fetch(request(),{...base,AUDIT_ALLOWED_HOSTS:hosts});
  assert.equal(res.status,503);
 });
}
