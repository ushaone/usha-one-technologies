// Private, allowlisted HTML retrieval. A separately reviewed safe-egress fetcher is REQUIRED.
// This module does not resolve DNS or independently prevent DNS rebinding.
import { analyzeHtml } from './seo-html-analysis.mjs';
const MAX_BYTES=250_000;
export async function auditAllowedPage(input,{allowedHosts=[],fetcher,timeoutMs=5000}={}){
  if(typeof fetcher!=='function')throw new Error('Safe egress fetcher required');
  const url=new URL(input);
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.href.length>2048||host.startsWith('[')||/^\d+(?:\.\d+){3}$/.test(host)||!allowedHosts.some(item=>typeof item==='string'&&item.toLowerCase()===host))throw new Error('Host is not explicitly approved for live audit');
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new Error('Invalid timeout');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(url.href,{method:'GET',redirect:'manual',signal:controller.signal,headers:{accept:'text/html','user-agent':'USHA-ONE-SEO-Audit/0.1'}});
    if(response.status>=300&&response.status<400)throw new Error('Redirect not followed');
    if(!response.ok)throw new Error('HTTP status '+response.status);
    const type=response.headers.get('content-type')||'';
    if(!/^text\/html(?:\s*;|\s*$)/i.test(type))throw new Error('Expected HTML content');
    const length=Number(response.headers.get('content-length')||0);
    if(length>MAX_BYTES)throw new Error('HTML response too large');
    if(!response.body)throw new Error('Empty response body');
    const reader=response.body.getReader();const chunks=[];let total=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES)throw new Error('HTML response too large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    const html=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    return {source:'live-html',fetchedAt:new Date().toISOString(),httpStatus:response.status,...analyzeHtml(html,url.href),limitations:['Single HTML response only','No JS rendering','No Google indexing or performance measurement']};
  }finally{clearTimeout(timer)}
}
