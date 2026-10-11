import test from 'node:test';
import assert from 'node:assert/strict';
import {SeoAuditAdmission} from '../worker/seo-admission.mjs';
import {auditAllowedPage} from '../worker/seo-controlled-fetch.mjs';
import worker from '../worker/seo-audit-phase2.js';
import {safeFetchPublicHtml} from '../gateway/seo-safe-egress.mjs';

// Serialized in-memory transaction model. This is NOT Cloudflare deployment evidence.
function storage(initial){
  let data=initial,tail=Promise.resolve();
  return {transaction(fn){const next=tail.then(()=>fn({get:async()=>structuredClone(data),put:async(_,value)=>{data=structuredClone(value)}}));tail=next.catch(()=>{});return next}};
}
const acquire=object=>object.fetch(new Request('https://admission/acquire',{method:'POST'}));
test('two shared leases admit at most two concurrent callers across object reconstruction',async()=>{
  const state={storage:storage()};
  const a=new SeoAuditAdmission(state),b=new SeoAuditAdmission(state);
  const replies=await Promise.all(Array.from({length:20},(_,i)=>acquire(i%2?a:b)));
  assert.equal(replies.filter(r=>r.status===200).length,2);
  assert.equal(replies.filter(r=>r.status===429).length,18);
});
test('rolling quota survives object reconstruction',async()=>{
  const state={storage:storage({starts:Array(10).fill(Date.now()),leases:[]})};
  assert.equal((await acquire(new SeoAuditAdmission(state))).status,429);
});
test('expired leases and old quota entries permit recovery',async()=>{
  const object=new SeoAuditAdmission({storage:storage({starts:[Date.now()-60001],leases:[Date.now()-1]})});
  assert.equal((await acquire(object)).status,200);
});
test('corrupt admission state and storage outage fail closed',async()=>{
  for(const state of [{storage:storage({starts:['bad'],leases:[]})},{storage:{transaction:async()=>{throw Error('down')}}}]){
    assert.equal((await acquire(new SeoAuditAdmission(state))).status,503);
  }
});
test('leases cannot be released early or acquired by GET',async()=>{
  const object=new SeoAuditAdmission({storage:storage()});
  for(const request of [new Request('https://admission/acquire'),new Request('https://admission/release',{method:'POST'})])assert.equal((await object.fetch(request)).status,404);
});
test('HTML deadline bounds a provider that ignores AbortSignal',async()=>{
  let signal;
  await assert.rejects(auditAllowedPage('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:20,fetcher:async(_,options)=>{signal=options.signal;return new Promise(()=>{})}
  }),/deadline/);
  assert.equal(signal.aborted,true);
});
test('HTML deadline bounds a stalled stream even when cancellation never resolves',async()=>{
  let cancelled=false;
  await assert.rejects(auditAllowedPage('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:20,fetcher:async()=>new Response(new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{})}}),{headers:{'content-type':'text/html'}})
  }),/deadline/);
  assert.equal(cancelled,true);
});
test('DNS deadline prevents any dial on resolver stall',async()=>{
  let dialed=false;
  await assert.rejects(safeFetchPublicHtml('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:20,resolver:()=>new Promise(()=>{}),dial:()=>{dialed=true}
  }),/deadline/);
  assert.equal(dialed,false);
});
const token='long-token-only-for-security-tests';
const env={ENABLE_PRIVATE_AUDIT:'true',AUDIT_ALLOWED_HOSTS:'www.example.org',AUDIT_PREVIEW_TOKEN:token,
 AUDIT_ADMISSION:{idFromName:name=>{assert.equal(name,'seo-private-global-v1');return name},get:()=>({fetch:async()=>Response.json({lease:'unit-test'})})},
 AUDIT_SAFE_FETCH:{fetch:async()=>new Response('<title>OK</title>',{headers:{'content-type':'text/html'}})}};
const request=()=>new Request('https://preview.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({url:'https://www.example.org/'})});
test('missing shared admission binding cannot enable live crawl',async()=>{
  const r=await worker.fetch(request(),{...env,AUDIT_ADMISSION:undefined});assert.equal(r.status,503);
});
test('every private request uses the fixed global admission object',async()=>{
  assert.equal((await worker.fetch(request(),env)).status,200);
});
test('admission outage and malformed lease cannot reach safe fetch',async()=>{
  for(const fetch of [async()=>{throw Error('down')},async()=>Response.json({}),async()=>new Response(null,{status:503})]){
    let outbound=false;
    const r=await worker.fetch(request(),{...env,AUDIT_ADMISSION:{idFromName:n=>n,get:()=>({fetch})},AUDIT_SAFE_FETCH:{fetch:()=>{outbound=true}}});
    assert.equal(r.status,503);assert.equal(outbound,false);
  }
});
test('unauthenticated stalled body is rejected before consumption',async()=>{
  const r=await worker.fetch(new Request('https://preview.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream(),duplex:'half'}),env);
  assert.equal(r.status,401);
});
test('authenticated stalled request body has a hard deadline',async()=>{
  let cancelled=false;
  const r=await worker.fetch(new Request('https://preview.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{})}}),duplex:'half'}),env);
  assert.equal(r.status,400);assert.equal(cancelled,true);
});
test('stalled admission fails closed without fetching',async()=>{
  let outbound=false;
  const r=await worker.fetch(request(),{...env,AUDIT_ADMISSION:{idFromName:n=>n,get:()=>({fetch:()=>new Promise(()=>{})})},AUDIT_SAFE_FETCH:{fetch:()=>{outbound=true}}});
  assert.equal(r.status,503);assert.equal(outbound,false);
});
