import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAllowedPage } from '../worker/seo-controlled-fetch.mjs';
const html='<!doctype html><head><title>Example</title><meta name="description" content="Sample"></head><body><h1>Welcome</h1></body>';
const allowedHosts=['www.example.org'];
const fake=(body=html,init={})=>async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response(body,{headers:{'content-type':'text/html'},...init})};
test('fetches and analyzes one explicitly approved HTTPS page',async()=>{
 const result=await auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake()});
 assert.equal(result.title,'Example');assert.equal(result.h1Count,1);assert.equal(result.source,'live-html');
});
for(const url of ['https://evil.org/','http://www.example.org/','https://127.0.0.1/','https://www.example.org:8443/','https://user:pass@www.example.org/','https://www.example.org/#fragment','https://www.example.org.evil.org/']){
 test('rejects unapproved destination '+url,async()=>{
  let called=false;await assert.rejects(auditAllowedPage(url,{allowedHosts,fetcher:async()=>{called=true;throw Error('should not call')}}));
  assert.equal(called,false);
 });
}
test('does not follow redirects',async()=>{
 await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake('',{status:302,headers:{location:'https://evil.org/','content-type':'text/html'}})}),/Redirect/);
});
test('rejects non-HTML',async()=>{
 await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake('abc',{headers:{'content-type':'application/pdf'}})}),/Expected HTML/);
});
test('rejects oversized streamed responses',async()=>{
 await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake('x'.repeat(250001))}),/too large/);
});
test('rejects unsupported timeout',async()=>{
 await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,timeoutMs:11000,fetcher:fake()}),/timeout/);
});

test('requires explicit safe-egress fetcher and never uses global fetch',async()=>{await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts}),/Safe egress fetcher required/)});

test('controlled fetch rejects explicit default HTTPS port without network access',async()=>{let called=false;await assert.rejects(auditAllowedPage('https://www.example.org:443/page',{allowedHosts,fetcher:async()=>{called=true;throw Error('unexpected fetch')}}),/Explicit ports/);assert.equal(called,false)});

for(const target of ['https://host.local/','https://service.internal/','https://localhost/','https://bad-.example.org/'])test('controlled fetch refuses forbidden hostname even when allowlisted: '+target,async()=>{let called=false;const hostname=new URL(target).hostname;await assert.rejects(auditAllowedPage(target,{allowedHosts:[hostname],fetcher:async()=>{called=true;throw Error('unexpected outbound call')}}));assert.equal(called,false)});

for(const length of ['abc','-1','250001','1.5'])test('rejects invalid content-length '+length,async()=>{await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake(html,{headers:{'content-type':'text/html','content-length':length}})}),/content length/)});

for(const length of ['',' 5','05','+5','5.0'])test('rejects noncanonical content-length '+JSON.stringify(length),async()=>{await assert.rejects(auditAllowedPage('https://www.example.org/',{allowedHosts,fetcher:fake(html,{headers:{'content-type':'text/html','content-length':length}})}),/content length/)});
