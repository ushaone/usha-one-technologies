import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validateAuditUrl} from '../worker/seo-audit-phase2.js';

test('allows normal HTTPS hostname without remote request',()=>{
  assert.equal(validateAuditUrl('https://www.example.org/page').ok,true);
});
for(const url of ['http://example.org','file:///etc/passwd','https://localhost','https://127.0.0.1','https://[::1]','https://user:pass@example.org','https://example.org:8443','https://site.internal','https://example.org/#fragment','https://-bad.example.org']){
  test('rejects unsafe or unsupported URL: '+url,()=>assert.equal(validateAuditUrl(url).ok,false));
}
test('starter never claims an audit was performed',async()=>{
  const req=new Request('https://audit.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://example.org/'})});
  const response=await worker.fetch(req);
  assert.equal(response.status,503);
  const data=await response.json();
  assert.equal(data.liveCrawl,false);
  assert.deepEqual(data.checks,[]);
});
test('rejects invalid JSON',async()=>{
  const response=await worker.fetch(new Request('https://audit.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json'},body:'not-json'}));
  assert.equal(response.status,400);
});
test('rejects non-JSON content type',async()=>{
  const response=await worker.fetch(new Request('https://audit.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'text/plain'},body:'hello'}));
  assert.equal(response.status,415);
});
test('rejects oversized payload',async()=>{
  const response=await worker.fetch(new Request('https://audit.invalid/api/seo/audits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://example.org',padding:'a'.repeat(5000)})}));
  assert.equal(response.status,413);
});
