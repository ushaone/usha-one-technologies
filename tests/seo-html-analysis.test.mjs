import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHtml } from '../worker/seo-html-analysis.mjs';

const page='https://www.sample.org/services';
test('extracts core on-page SEO evidence',()=>{
 const result=analyzeHtml(`<!doctype html><html><head><title>My &amp; Your Services</title><meta name="description" content="Useful services"><meta name="robots" content="index,follow"><meta name="viewport" content="width=device-width"><link rel="canonical" href="/services"></head><body><h1>Our <em>Services</em></h1><a href="/about">About</a><a href="https://other.org">External</a></body></html>`,page);
 assert.equal(result.title,'My & Your Services');
 assert.equal(result.description,'Useful services');
 assert.equal(result.canonical,page);
 assert.deepEqual(result.h1,['Our Services']);
 assert.equal(result.internalLinks,1);
 assert.equal(result.externalLinks,1);
 assert.equal(result.robots,'index,follow');
});
test('missing metadata is reported as missing, not fabricated',()=>{
 const result=analyzeHtml('<html><body>Hi</body></html>',page);
 assert.equal(result.title,'');
 assert.equal(result.canonical,null);
 assert.equal(result.h1Count,0);
 assert.equal(result.observations.find(x=>x.key==='title').status,'missing');
});
test('does not treat script markup as a real H1',()=>{
 const result=analyzeHtml('<html><head><script>const x="<h1>Fake</h1>"</script></head><body><script><h1>Fake</h1></script><h1>Real</h1></body></html>',page);
 assert.deepEqual(result.h1,['Real']);
});
test('does not accept javascript canonical URLs',()=>{
 const result=analyzeHtml('<head><link rel="canonical" href="javascript:alert(1)"></head>',page);
 assert.equal(result.canonical,null);
});
test('enforces bounded input size',()=>{
 assert.throws(()=>analyzeHtml('x'.repeat(1_000_001),page),/1 MB/);
});
