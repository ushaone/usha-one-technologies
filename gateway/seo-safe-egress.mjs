// Isolated Node.js safe-egress *core* for an operator-controlled private gateway.
// It is NOT a Cloudflare Worker service binding or a deployed HTTP endpoint.
// Network policy must additionally deny private/metadata destinations at the gateway firewall.
// Fail closed on all IPv6 until a complete IPv6 public-address policy is reviewed.
import {resolveCname,resolve4,resolve6} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {validateAuditUrl} from '../worker/seo-audit-phase2.js';

const MAX_HTML_BYTES=250_000;
const DENIED_V4=[
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],
  ['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4]
];
const n4=ip=>ip.split('.').reduce((n,x)=>((n*256)+Number(x))>>>0,0);
export function isPublicIPv4(ip){
  if(isIP(ip)!==4||ip.split('.').length!==4)return false;
  const target=n4(ip);
  return !DENIED_V4.some(([base,bits])=>{
    const mask=(0xffffffff << (32-bits))>>>0;
    return (target&mask)===(n4(base)&mask);
  });
}
const noRecord=e=>['ENODATA','ENOTFOUND','ENONAME','ENODOMAIN'].includes(e?.code);
const normalizeHost=host=>{
  if(typeof host!=='string')throw Error('Invalid DNS hostname');
  const h=host.replace(/\.$/,'').toLowerCase();
  if(!validateAuditUrl('https://'+h+'/').ok)throw Error('Unsafe DNS hostname');
  return h;
};
export async function resolvePublicIPv4(hostname,{
  cname=resolveCname,a=resolve4,aaaa=resolve6
}={}){
  let host=normalizeHost(hostname);const chain=[];const visited=new Set();
  for(let hop=0;hop<8;hop++){
    if(visited.has(host))throw Error('DNS CNAME loop');
    visited.add(host);
    let cnames;
    try{cnames=await cname(host)}catch(e){if(noRecord(e))cnames=[];else throw e}
    if(!Array.isArray(cnames)||cnames.length>1)throw Error('Ambiguous DNS CNAME');
    if(cnames.length===0)break;
    chain.push(host);
    host=normalizeHost(cnames[0]);
    if(hop===7)throw Error('DNS CNAME chain too long');
  }
  const [v4,v6]=await Promise.all([
    a(host),aaaa(host).catch(e=>{if(noRecord(e))return [];throw e})
  ]);
  if(!Array.isArray(v4)||!v4.length||v4.some(ip=>!isPublicIPv4(ip)))throw Error('DNS contains a non-public or missing IPv4 destination');
  // Deliberately conservative: refuse a dual-stack origin until IPv6 is supported.
  if(!Array.isArray(v6)||v6.length)throw Error('IPv6 origin is not yet supported by safe egress');
  return {address:v4[0],chain:[...chain,host]};
}
export async function fetchPinnedHtml(url,{hostname,address,timeoutMs=5000}){
  if(!isPublicIPv4(address))throw Error('Unsafe pinned IP address');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Invalid request timeout');
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!==hostname||u.port||u.username||u.password||u.hash)throw Error('Pinned destination mismatch');
  return new Promise((resolve,reject)=>{
    let settled=false;
    let deadline;
    const done=(err,value)=>{if(settled)return;settled=true;clearTimeout(deadline);err?reject(err):resolve(value)};
    const req=httpsRequest(u,{
      method:'GET',agent:false,autoSelectFamily:false,family:4,servername:hostname,
      rejectUnauthorized:true,maxHeaderSize:8192,
      lookup:(_host,_opts,cb)=>cb(null,address,4),
      headers:{accept:'text/html','accept-encoding':'identity','user-agent':'USHA-ONE-SEO-Audit/0.2'}
    },async res=>{
      try{
        if(res.socket?.remoteAddress!==address)throw Error('Pinned IP connection mismatch');
        if(res.statusCode!==200)throw Error('HTTP response rejected (including redirects)');
        if(!/^text\/html(?:\s*;|\s*$)/i.test(res.headers['content-type']||''))throw Error('Not HTML');
        if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity')throw Error('Encoded response denied');
        const length=res.headers['content-length'];
        if(length!==undefined&&(!/^(0|[1-9][0-9]*)$/.test(String(length))||Number(length)>MAX_HTML_BYTES))throw Error('Invalid response size');
        const parts=[];let total=0;
        for await(const part of res){
          total+=part.byteLength;
          if(total>MAX_HTML_BYTES)throw Error('Response too large');
          parts.push(part);
        }
        done(null,new Response(Buffer.concat(parts),{
          status:200,headers:{'content-type':'text/html; charset=utf-8'}
        }));
      }catch(e){res.destroy();done(e)}
    });
    deadline=setTimeout(()=>req.destroy(Error('Egress total deadline exceeded')),timeoutMs);
    req.setTimeout(timeoutMs,()=>req.destroy(Error('Egress request timeout')));
    req.on('error',e=>done(e));
    req.end();
  });
}
export async function safeFetchPublicHtml(input,{
  allowedHosts=[],resolver=resolvePublicIPv4,dial=fetchPinnedHtml,timeoutMs=5000
}={}){
  const parsed=validateAuditUrl(input);
  if(!parsed.ok||!allowedHosts.includes(parsed.hostname))throw Error('Host is not explicitly approved');
  if(typeof resolver!=='function'||typeof dial!=='function')throw Error('Safe egress functions required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Invalid request timeout');
  // Bound DNS resolution, too. The Node HTTPS dial enforces its own hard deadline.
  let timer;
  const destination=await Promise.race([
    Promise.resolve().then(()=>resolver(parsed.hostname)),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS resolution deadline exceeded')),timeoutMs)})
  ]).finally(()=>clearTimeout(timer));
  if(!destination||!isPublicIPv4(destination.address))throw Error('Unsafe resolved address');
  return dial(parsed.url,{hostname:parsed.hostname,address:destination.address,timeoutMs});
}
