// USHA ONE SEO Phase 2 — isolated API starter, NOT a live crawler.
// Deploy only after security review. No outbound fetch is performed.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
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
export default {
  async fetch(request){
    const u=new URL(request.url);
    if(u.pathname==='/health'&&request.method==='GET')return json({service:'usha-one-seo-audit',status:'starter',liveCrawl:false});
    if(u.pathname!=='/api/seo/audits')return json({error:'Not found'},404);
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
    // A public DNS/IP-safe outbound gateway is required before any remote scan.
    return json({status:'not_implemented',url:result.url,liveCrawl:false,checks:[],message:'URL validation passed. Live crawling is disabled until SSRF protections and rate limiting are implemented.'},501);
  }
};
