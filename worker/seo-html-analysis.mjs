// Offline-only HTML evidence extraction for SEO Phase 2.
// This module performs NO network requests. Input must be bounded by the caller.
function decode(value){return String(value||'').replace(/&(?:amp|lt|gt|quot|apos|#39|#x([0-9a-f]+)|#([0-9]+));/gi,(full,hex,dec)=>{if(hex||dec){const n=parseInt(hex||dec,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):full}return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[full.toLowerCase()]||full}).trim()}
function attrs(tag){const out={};const pattern=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;for(const m of tag.matchAll(pattern)){const key=m[1].toLowerCase();if(!Object.hasOwn(out,key))out[key]=decode(m[2]??m[3]??m[4])}return out}
function text(value){return decode(value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).slice(0,500)}
export function analyzeHtml(html,pageUrl){
  if(typeof html!=='string'||html.length>1_000_000)throw new Error('HTML input must be at most 1 MB');
  const page=new URL(pageUrl);
  const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1]||'';
  const safeHead=head.replace(/<!--[\s\S]*?-->/g,'').replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi,'');
  const title=text(safeHead.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'');
  const metas=[...safeHead.matchAll(/<meta\b[^>]*>/gi)].map(m=>attrs(m[0]));
  const links=[...safeHead.matchAll(/<link\b[^>]*>/gi)].map(m=>attrs(m[0]));
  const description=metas.find(m=>m.name?.toLowerCase()==='description')?.content||'';
  const robots=metas.find(m=>m.name?.toLowerCase()==='robots')?.content||'';
  const viewport=metas.find(m=>m.name?.toLowerCase()==='viewport')?.content||'';
  const canonicalRaw=links.find(l=>l.rel?.toLowerCase().split(/\s+/).includes('canonical'))?.href||'';
  let canonical=null;try{if(canonicalRaw){const u=new URL(canonicalRaw,page);if(['https:','http:'].includes(u.protocol))canonical=u.href}}catch{}
  const cleanBody=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)\s*>/gi,'');
  const h1=[...cleanBody.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(m=>text(m[1]));
  const anchors=[...cleanBody.matchAll(/<a\b[^>]*>/gi)];
  let internalLinks=0,externalLinks=0;
  for(const match of anchors){const href=attrs(match[0]).href;if(!href)continue;try{const target=new URL(href,page);if(!['http:','https:'].includes(target.protocol))continue;if(target.hostname===page.hostname)internalLinks++;else externalLinks++}catch{}}
  return {url:page.href,title,description,canonical,robots,viewport,h1,h1Count:h1.length,internalLinks,externalLinks,observations:[
    {key:'title',status:title?'observed':'missing',value:title||null},
    {key:'metaDescription',status:description?'observed':'missing',value:description||null},
    {key:'h1',status:h1.length===1?'observed':h1.length===0?'missing':'review',value:h1},
    {key:'canonical',status:canonical?'observed':'missing',value:canonical},
    {key:'robotsMeta',status:robots?'observed':'not_specified',value:robots||null},
    {key:'viewport',status:viewport?'observed':'missing',value:viewport||null}
  ]};
}
