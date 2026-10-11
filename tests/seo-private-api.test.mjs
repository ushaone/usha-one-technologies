import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/seo-audit-phase2.js';
const url='https://audit.invalid/api/seo/audits';
const token='a-very-long-private-test-token-123';
const request=(target='https://www.example.org/')=>new Request(url,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({url:target})});
const env={ENABLE_PRIVATE_AUDIT:'true',AUDIT_PREVIEW_TOKEN:token,AUDIT_ALLOWED_HOSTS:'www.example.org',AUDIT_ADMISSION:{idFromName:name=>name,get:()=>({fetch:async()=>Response.json({lease:'test-lease'})})},AUDIT_SAFE_FETCH:{fetch:async()=>new Response('<html><head><title>Real title</title></head><body><h1>Hello</h1></body></html>',{headers:{'content-type':'text/html'}})}};
test('fails closed when not configured',async()=>{const res=await worker.fetch(request(),{});assert.equal(res.status,503)});
test('rejects missing token',async()=>{const req=request();req.headers.delete('authorization');const res=await worker.fetch(req,env);assert.equal(res.status,401)});
test('rejects unapproved host without fetching',async()=>{const res=await worker.fetch(request('https://evil.org'),env);assert.equal(res.status,403)});
test('fails closed when shared admission is unavailable',async()=>{const res=await worker.fetch(request(),{...env,AUDIT_ADMISSION:undefined});assert.equal(res.status,503)});
test('enforces admission result',async()=>{const res=await worker.fetch(request(),{...env,AUDIT_ADMISSION:{idFromName:name=>name,get:()=>({fetch:async()=>new Response(null,{status:429})})}});assert.equal(res.status,429)});
test('returns measured HTML evidence only when private controls pass',async()=>{const res=await worker.fetch(request(),env);assert.equal(res.status,200);const data=await res.json();assert.equal(data.liveCrawl,true);assert.equal(data.title,'Real title');assert.equal(data.h1Count,1);assert.equal(data.source,'live-html')});
test('upstream failure is a generic 502',async()=>{const res=await worker.fetch(request(),{...env,AUDIT_SAFE_FETCH:{fetch:async()=>{throw Error('private network details')}}});assert.equal(res.status,502);assert.doesNotMatch(await res.text(),/private network details/)});

test('requires safe outbound binding',async()=>{const res=await worker.fetch(request(),{...env,AUDIT_SAFE_FETCH:undefined});assert.equal(res.status,503)});
