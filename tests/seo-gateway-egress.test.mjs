import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicIPv4,resolvePublicIPv4,safeFetchPublicHtml,fetchPinnedHtml} from '../gateway/seo-safe-egress.mjs';
const notFound=Object.assign(Error('No record'),{code:'ENODATA'});
const noCname=async()=>{throw notFound};
const noV6=async()=>{throw notFound};
const dns=(a,cname=noCname,aaaa=noV6)=>({a:async()=>a,cname,aaaa});
for(const address of [
  '0.0.0.0','10.1.2.3','100.64.1.2','127.0.0.1','169.254.169.254',
  '172.16.0.1','192.0.0.1','192.0.2.1','192.88.99.1','192.168.1.1',
  '198.18.0.1','198.51.100.1','203.0.113.5','224.0.0.1',
  '255.255.255.255','::1','::ffff:127.0.0.1','0x7f000001','0177.0.0.1'
])test('gateway fails closed on non-public IPv4 or any IPv6 '+address,()=>{
  assert.equal(isPublicIPv4(address),false);
});
for(const address of ['1.1.1.1','8.8.8.8','93.184.215.14'])
  test('gateway public IPv4 policy accepts representative routable address '+address,()=>assert.equal(isPublicIPv4(address),true));
test('resolves single approved public IPv4 hostname',async()=>{
  const result=await resolvePublicIPv4('www.example.org',dns(['8.8.8.8']));
  assert.equal(result.address,'8.8.8.8');
});
test('DNS CNAME chain to a private address fails before HTTPS',async()=>{
  const resolve=async host=>host==='www.example.org'?['internal.example.org']:[];
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['10.0.0.2'],resolve)),/non-public/);
});
test('CNAME chain to internal suffix cannot proceed',async()=>{
  const resolve=async host=>host==='www.example.org'?['admin.internal']:[];
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['8.8.8.8'],resolve)),/Unsafe DNS hostname/);
});
test('mixed public and private DNS addresses are denied',async()=>{
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['8.8.8.8','169.254.169.254'])),/non-public/);
});
test('IPv6-only or dual-stack DNS answer is denied until reviewed',async()=>{
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['8.8.8.8'],noCname,async()=>['2606:4700:4700::1111'])),/IPv6/);
  await assert.rejects(resolvePublicIPv4('www.example.org',dns([])),/missing IPv4/);
});
test('CNAME DNS rebinding/looped alias is denied',async()=>{
  const cname=async host=>[host==='www.example.org'?'alias.example.org':'www.example.org'];
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['8.8.8.8'],cname)),/loop/);
});
test('ambiguous CNAME answer fails closed',async()=>{
  await assert.rejects(resolvePublicIPv4('www.example.org',dns(['8.8.8.8'],async()=>['first.example.org','second.example.org'])),/Ambiguous/);
});
test('pins the validated address into the only dial invocation',async()=>{
  const calls=[];
  const response=await safeFetchPublicHtml('https://www.example.org/path',{
    allowedHosts:['www.example.org'],
    resolver:async host=>{assert.equal(host,'www.example.org');return {address:'8.8.8.8'}},
    dial:async(url,options)=>{calls.push({url,options});return new Response('OK')}
  });
  assert.equal(await response.text(),'OK');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://www.example.org/path');
  assert.equal(calls[0].options.hostname,'www.example.org');
  assert.equal(calls[0].options.address,'8.8.8.8');
  assert.ok(calls[0].options.timeoutMs>0&&calls[0].options.timeoutMs<=5000);
});
test('unsafe resolver result cannot reach dial even if resolver is compromised',async()=>{
  let called=false;
  await assert.rejects(safeFetchPublicHtml('https://www.example.org/',{
    allowedHosts:['www.example.org'],resolver:async()=>({address:'169.254.169.254'}),
    dial:async()=>{called=true}
  }),/Unsafe resolved/);
  assert.equal(called,false);
});
test('gateway rejects unapproved hostname before DNS call',async()=>{
  let called=false;
  await assert.rejects(safeFetchPublicHtml('https://unapproved.example.org/',{
    allowedHosts:['www.example.org'],resolver:async()=>{called=true}
  }),/explicitly approved/);
  assert.equal(called,false);
});
test('dial rejects bad pinned address and hostname mismatch before any socket',async()=>{
  await assert.rejects(fetchPinnedHtml('https://www.example.org/',{
    hostname:'www.example.org',address:'127.0.0.1'
  }),/Unsafe pinned IP/);
  await assert.rejects(fetchPinnedHtml('https://www.example.org/',{
    hostname:'unapproved.example.org',address:'8.8.8.8'
  }),/mismatch/);
});

test('DNS delay consumes the same total egress budget',async()=>{
  let remaining;
  await safeFetchPublicHtml('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:200,
    resolver:async()=>{await new Promise(r=>setTimeout(r,30));return {address:'8.8.8.8'}},
    dial:async(_,options)=>{remaining=options.timeoutMs;return new Response('OK')}
  });
  assert.ok(remaining>0&&remaining<=180);
});
test('expired DNS cannot initiate a late connection',async()=>{
  let resolveDns,called=false;
  const result=safeFetchPublicHtml('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:20,
    resolver:()=>new Promise(r=>{resolveDns=r}),
    dial:async()=>{called=true;return new Response('OK')}
  });
  await assert.rejects(result,/total deadline/);
  resolveDns({address:'8.8.8.8'});
  await new Promise(r=>setImmediate(r));
  assert.equal(called,false);
});
test('a stalled dial adapter cannot leave the caller waiting forever',async()=>{
  await assert.rejects(safeFetchPublicHtml('https://www.example.org/',{
    allowedHosts:['www.example.org'],timeoutMs:20,
    resolver:async()=>({address:'8.8.8.8'}),dial:()=>new Promise(()=>{})
  }),/total deadline/);
});
