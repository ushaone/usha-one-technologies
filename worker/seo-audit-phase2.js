// Isolated SEO Phase 2 API. Fail-closed: scanning is disabled unless explicitly configured.
// This endpoint is for PRIVATE preview, not public arbitrary-domain auditing.
import { auditAllowedPage } from './seo-controlled-fetch.mjs';

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const blockedSuffix=/(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/i;
export function validateAuditUrl(input){
  if(typeof input!=='string'||input.length>2048)return {ok:false,error:'URL must be a string up to 2048 characters'};
  let u;try{u=new URL(input)}catch{return {ok:false,error:'Invalid absolute URL'}}
  if(u.protocol!=='https:')return {ok:false,error:'HTTPS is required'};
  if(u.username||u.password)return {ok:false,error:'Credentials are not allowed'};
  if(u.port)return {ok:false,error:'Custom ports are not allowed'};
  if(u.hash)return {ok:false,error:'URL fragments are not allowed'};
  const host=u.hostname.toLowerCase();
  if(!host||host.length>253||!host.includes('.')||host.endsWith('.')||blockedSuffix.test(host))return {ok:false,error:'Hostname is not eligible'};
  if(host.startsWith('[')||/^\d+(?:\.\d+){3}$/.test(host)||/^0x/i.test(host)||/^\d+$/.test(host))return {ok:false,error:'IP address literals are not allowed'};
  if(!/^[a-z0-9.-]+$/.test(host)||host.split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))return {ok:false,error:'Invalid hostname'};
  return {ok:true,url:u.href,hostname:host};
}
function configured(env){
  const hosts=String(env?.AUDIT_ALLOWED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  // Explicitly approved public hostnames only. No wildcards, suffix matches or IPs.
  const allowedHosts=hosts.filter(host=>validateAuditUrl('https://'+host+'/').ok&&host===new URL('https://'+host+'/').hostname);
  return env?.ENABLE_PRIVATE_AUDIT==='true'&&typeof env?.AUDIT_PREVIEW_TOKEN==='string'&&env.AUDIT_PREVIEW_TOKEN.length>=24&&
    typeof env?.AUDIT_RATE_LIMITER?.limit==='function'&&allowedHosts.length>0?allowedHosts:null;
}
export default {
  async fetch(request,env={}){
    const path=new URL(request.url).pathname;
    if(path==='/health'&&request.method==='GET')return json({service:'usha-one-seo-audit',status:'private-preview',liveCrawlEnabled:Boolean(configured(env))});
    if(path!=='/api/seo/audits')return json({error:'Not found'},404);
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    const type=request.headers.get('content-type')||'';
    if(!/^application\/json(?:\s*;|\s*$)/i.test(type))return json({error:'application/json required'},415);
    if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Payload too large'},413);
    let raw;try{raw=await request.text()}catch{return json({error:'Unable to read request'},400)}
    if(raw.length>4096)return json({error:'Payload too large'},413);
    let payload;try{payload=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
    if(!payload||Array.isArray(payload)||typeof payload!=='object')return json({error:'Expected object'},400);
    const result=validateAuditUrl(payload.url);
    if(!result.ok)return json({error:result.error},400);
    const allowedHosts=configured(env);
    if(!allowedHosts)return json({status:'disabled',liveCrawl:false,checks:[],message:'Private live audit is not configured.'},503);
    if(request.headers.get('authorization')!=='Bearer '+env.AUDIT_PREVIEW_TOKEN)return json({error:'Unauthorized'},401);
    if(!allowedHosts.includes(result.hostname))return json({error:'Hostname is not approved'},403);
    // Rate limiter must be provided by the hosting platform and must enforce globally.
    let rate;try{rate=await env.AUDIT_RATE_LIMITER.limit({key:'seo-private-preview'})}catch{return json({error:'Rate limiter unavailable'},503)}
    if(!rate?.success)return json({error:'Audit rate limit exceeded'},429);
    try{
      const analysis=await auditAllowedPage(result.url,{allowedHosts,fetcher:env.AUDIT_FETCHER||fetch});
      return json({status:'complete',liveCrawl:true,...analysis});
    }catch{
      // Avoid exposing upstream response or network internals to unauthenticated clients.
      return json({status:'failed',liveCrawl:false,checks:[],message:'Audit fetch failed or was rejected.'},502);
    }
  }
};
