// Security regression tests deliberately use mocks; these do NOT establish DNS/IP-safe egress.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validateAuditUrl} from '../worker/seo-audit-phase2.js';
import {auditAllowedPage} from '../worker/seo-controlled-fetch.mjs';
const approved='www.example.org';
const token='test-only-preview-bearer-token-123';
const endpoint='https://preview.invalid/api/seo/audits';
const html='<html><head><title>Test</title></head><body><h1>OK</h1></body></html>';
const env={
  ENABLE_PRIVATE_AUDIT:'true',AUDIT_PREVIEW_TOKEN:token,AUDIT_ALLOWED_HOSTS:approved,
  AUDIT_RATE_LIMITER:{limit:async()=>({success:true})},
  AUDIT_SAFE_FETCH:{fetch:async()=>new Response(html,{headers:{'content-type':'text/html'}})}
};
const request=(body,extra={})=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body,...extra});
for(const url of [
  'https://www.example.org:0443/',
  'https://www.example.org:000443/path',
  'https://127.0.0.1/',
  'https://0177.0.0.1/',
  'https://0x7f000001/',
  'https://2130706433/',
  'https://%31%32%37.0.0.1/',
  'https://[::1]/',
  'https://[::ffff:127.0.0.1]/',
  'https://www.example.org./',
  'https://host.local/',
  'https://svc.internal/',
  'https://user:pass@www.example.org/'
]){
  test('URL validation rejects bypass or non-public literal '+url,()=>{
    assert.equal(validateAuditUrl(url).ok,false);
  });
}
for(const url of ['https://www.example.org:0443/','https://www.example.org:000443/path']){
  test('bounded fetch rejects padded default port before egress '+url,async()=>{
    let outbound=0;
    await assert.rejects(auditAllowedPage(url,{allowedHosts:[approved],fetcher:async()=>{outbound++;throw Error('Unexpected network request')}}),/Explicit ports/);
    assert.equal(outbound,0);
  });
}
test('worker refuses redirect to metadata endpoint without making a second request',async()=>{
  let outbound=0;
  const res=await worker.fetch(request(JSON.stringify({url:'https://www.example.org/'})),{
    ...env,AUDIT_SAFE_FETCH:{fetch:async()=>{outbound++;return new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest/meta-data/'}})}}
  });
  assert.equal(res.status,502);
  assert.equal(outbound,1);
  assert.equal((await res.json()).liveCrawl,false);
});
test('worker bounds a chunked request body with no Content-Length',async()=>{
  let cancelled=false;
  const body=new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(4097)))},
    cancel(){cancelled=true}
  });
  const res=await worker.fetch(request(body,{duplex:'half'}),env);
  assert.equal(res.status,413);
  assert.equal(cancelled,true);
});
test('worker accepts a normal small streaming JSON request',async()=>{
  const source=new TextEncoder().encode(JSON.stringify({url:'https://www.example.org/'}));
  const body=new ReadableStream({start(controller){controller.enqueue(source.subarray(0,9));controller.enqueue(source.subarray(9));controller.close()}});
  const res=await worker.fetch(request(body,{duplex:'half'}),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).liveCrawl,true);
});
test('private API responses never allow credentialed cross-origin reads by default',async()=>{
  const res=await worker.fetch(request(JSON.stringify({url:'https://www.example.org/'})),env);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('access-control-allow-origin'),null);
  assert.equal(res.headers.get('access-control-allow-credentials'),null);
  assert.equal(res.headers.get('cache-control'),'no-store');
});
test('unapproved hostname cannot be fetched even when Authorization is valid',async()=>{
  let outbound=0;
  const res=await worker.fetch(request(JSON.stringify({url:'https://evil.example.net/'})),{
    ...env,AUDIT_SAFE_FETCH:{fetch:async()=>{outbound++;throw Error('Unexpected network request')}}
  });
  assert.equal(res.status,403);
  assert.equal(outbound,0);
});
test('disabled API cannot fetch even if its egress binding is present',async()=>{
  let outbound=0;
  const res=await worker.fetch(request(JSON.stringify({url:'https://www.example.org/'})),{
    ...env,ENABLE_PRIVATE_AUDIT:'false',
    AUDIT_SAFE_FETCH:{fetch:async()=>{outbound++;throw Error('Unexpected network request')}}
  });
  assert.equal(res.status,503);
  assert.equal(outbound,0);
});
