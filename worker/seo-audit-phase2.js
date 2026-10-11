// Isolated SEO Phase 2 API. Fail-closed: scanning is disabled unless explicitly configured.
// This endpoint is for PRIVATE preview, not public arbitrary-domain auditing.
import { deadline } from './seo-deadline.mjs';
export { SeoAuditAdmission } from './seo-admission.mjs';
import { auditAllowedPage } from './seo-controlled-fetch.mjs';
import { buildSeoRecommendations } from './seo-recommendations.mjs';

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const blockedSuffix=/(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/i;
export function validateAuditUrl(input){
  if(typeof input!=='string'||input.length>2048)return {ok:false,error:'URL must be a string up to 2048 characters'};
  let u;try{u=new URL(input)}catch{return {ok:false,error:'Invalid absolute URL'}}
  if(u.protocol!=='https:')return {ok:false,error:'HTTPS is required'};
  if(u.username||u.password)return {ok:false,error:'Credentials are not allowed'};
  if(u.port||/^https:\/\/[^/?#]*:[0-9]+(?:[/?#]|$)/i.test(input))return {ok:false,error:'Explicit ports are not allowed'};
  if(u.hash)return {ok:false,error:'URL fragments are not allowed'};
  const host=u.hostname.toLowerCase();
  if(!host||host.length>253||!host.includes('.')||host.endsWith('.')||blockedSuffix.test(host))return {ok:false,error:'Hostname is not eligible'};
  if(host.startsWith('[')||/^\d+(?:\.\d+){3}$/.test(host)||/^0x/i.test(host)||/^\d+$/.test(host))return {ok:false,error:'IP address literals are not allowed'};
  if(!/^[a-z0-9.-]+$/.test(host)||host.split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))return {ok:false,error:'Invalid hostname'};
  return {ok:true,url:u.href,hostname:host};
}
// Read incrementally: chunked bodies without Content-Length must never be buffered unbounded.
async function readBoundedBody(request){
  if(!request.body)return '';
  const reader=request.body.getReader();const chunks=[];let total=0;
  const budget=deadline(2000,'Request body deadline exceeded');
  try{
    while(true){
      const {done,value}=await budget.wait(reader.read());
      if(done)break;
      total+=value.byteLength;
      if(total>4096){const error=new Error('Payload too large');error.status=413;throw error}
      chunks.push(value);
    }
  }finally{budget.clear();void reader.cancel().catch(()=>{})}
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
function configured(env){
  const hosts=typeof env?.AUDIT_ALLOWED_HOSTS==='string'?env.AUDIT_ALLOWED_HOSTS.split(',').map(s=>s.trim().toLowerCase()):[];
  // Explicitly approved public hostnames only. No wildcards, suffix matches or IPs.
  const allowedHosts=hosts.filter(host=>{const check=validateAuditUrl('https://'+host+'/');return check.ok&&host===check.hostname});
  // Reject the entire configuration if any entry is malformed, rather than silently ignoring it.
  if(allowedHosts.length!==hosts.length||new Set(allowedHosts).size!==allowedHosts.length)return null;
  return env?.ENABLE_PRIVATE_AUDIT==='true'&&typeof env?.AUDIT_PREVIEW_TOKEN==='string'&&env.AUDIT_PREVIEW_TOKEN.length>=24&&
    typeof env?.AUDIT_ADMISSION?.idFromName==='function'&&
    typeof env?.AUDIT_ADMISSION?.get==='function'&&
    typeof env?.AUDIT_SAFE_FETCH?.fetch==='function'&&allowedHosts.length>0?allowedHosts:null;
}
export default {
  async fetch(request,env={}){
    const path=new URL(request.url).pathname;
    if(path==='/health'&&request.method==='GET')return json({service:'usha-one-seo-audit',status:'private-preview',liveCrawlEnabled:Boolean(configured(env))});
    if(path!=='/api/seo/audits')return json({error:'Not found'},404);
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    const earlyConfig=configured(env);
    if(earlyConfig&&request.headers.get('authorization')!=='Bearer '+env.AUDIT_PREVIEW_TOKEN)return json({error:'Unauthorized'},401);
    const type=request.headers.get('content-type')||'';
    if(!/^application\/json(?:\s*;|\s*$)/i.test(type))return json({error:'application/json required'},415);
    if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Payload too large'},413);
    let raw;try{raw=await readBoundedBody(request)}catch(error){return error?.status===413?json({error:'Payload too large'},413):json({error:'Unable to read request'},400)}
    let payload;try{payload=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
    if(!payload||Array.isArray(payload)||typeof payload!=='object')return json({error:'Expected object'},400);
    const result=validateAuditUrl(payload.url);
    if(!result.ok)return json({error:result.error},400);
    const allowedHosts=configured(env);
    if(!allowedHosts)return json({status:'disabled',liveCrawl:false,checks:[],message:'Private live audit is not configured.'},503);
    if(request.headers.get('authorization')!=='Bearer '+env.AUDIT_PREVIEW_TOKEN)return json({error:'Unauthorized'},401);
    if(!allowedHosts.includes(result.hostname))return json({error:'Hostname is not approved'},403);
    // All callers use ONE durable instance: never key this by IP, host or region.
    const admissionBudget=deadline(2000,'Admission deadline exceeded');
    try{
      const admission=env.AUDIT_ADMISSION.get(env.AUDIT_ADMISSION.idFromName('seo-private-global-v1'));
      const response=await admissionBudget.wait(admission.fetch('https://admission/acquire',{method:'POST'}));
      if(response.status===429)return json({error:'Audit rate or concurrency limit exceeded'},429);
      if(!response.ok)throw Error('Admission unavailable');
      const data=await admissionBudget.wait(response.json());
      if(typeof data.lease!=='string'||!data.lease)throw Error('Invalid lease');
    }catch{return json({error:'Admission unavailable'},503)}finally{admissionBudget.clear()}
    try{
      const analysis=await auditAllowedPage(result.url,{allowedHosts,fetcher:(url,options)=>env.AUDIT_SAFE_FETCH.fetch(url,options)});
      return json({status:'complete',liveCrawl:true,...analysis,...buildSeoRecommendations(analysis)});
    }catch{
      // Avoid exposing upstream response or network internals to unauthenticated clients.
      return json({status:'failed',liveCrawl:false,checks:[],message:'Audit fetch failed or was rejected.'},502);
    }
    // Admission leases expire after 30s, including successes; never release
    // early while an aborted gateway operation might still be running.
  }
};
