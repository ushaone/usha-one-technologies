// Real Chromium keyboard/semantic/mobile accessibility smoke checks.
// This is NOT a WCAG conformance or assistive-technology certification.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const browser=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean).find(bin=>{
  const x=spawnSync(bin,['--version'],{encoding:'utf8',timeout:5000});return !x.error&&x.status===0;
});
if(!browser)throw Error('Chrome/Chromium required for accessibility smoke');
const tmp=mkdtempSync(join(tmpdir(),'usha-seo-a11y-'));
const checks=`
(async()=>{
 try {
   await new Promise(resolve=>setTimeout(resolve,100));
   const errors=[];
   const ids=new Set();
   for(const el of document.querySelectorAll('[id]')){
     if(ids.has(el.id))errors.push('Duplicate id: '+el.id);
     ids.add(el.id);
   }
   if(document.querySelectorAll('h1').length!==1)errors.push('Expected one H1');
   for(const img of document.querySelectorAll('img:not([alt])'))errors.push('Image without alt');
   for(const input of document.querySelectorAll('input,select,textarea')){
     if(input.type==='hidden')continue;
     const labeled=!!input.getAttribute('aria-label')||!!input.getAttribute('aria-labelledby')||!!(input.id&&document.querySelector('label[for="'+input.id+'"]'))||!!input.closest('label');
     if(!labeled)errors.push('Unlabeled form field: '+(input.id||input.type));
   }
   for(const btn of document.querySelectorAll('button')){
     if(!btn.textContent.trim()&&!btn.getAttribute('aria-label')&&!btn.getAttribute('aria-labelledby'))errors.push('Nameless button');
   }
   const focusable=[...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')].find(el=>el.getClientRects().length>0);
   if(!focusable)errors.push('No visible keyboard target');
   else {focusable.focus();if(document.activeElement!==focusable)errors.push('Keyboard target cannot receive focus')}
   if(document.documentElement.scrollWidth>document.documentElement.clientWidth+4)errors.push('Mobile horizontal overflow');
   if(errors.length)throw Error(errors.join('; '));
   document.documentElement.setAttribute('data-a11y-smoke','passed');
 }catch(error){
   document.documentElement.setAttribute('data-a11y-smoke','failed');
   document.documentElement.setAttribute('data-a11y-error',String(error.message||error));
 }
})();
`;
try{
  for(const folder of ['css','js','ASSETS'])cpSync(join(root,folder),join(tmp,folder),{recursive:true});
  for(const page of ['index.html','seo.html','seo-preflight.html','seo-offline-standalone.html','seo-audit-report.html']){
    const source=readFileSync(join(root,page),'utf8');
    assert.ok(source.includes('</body>'),page+' missing closing body');
    const checked=source.replace('</body>','<script>'+checks+'</script></body>');
    const name='checked-'+page;
    const file=join(tmp,name);writeFileSync(file,checked);
    const result=spawnSync(browser,[
      '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
      '--disable-background-networking','--no-first-run','--window-size=420,840',
      '--user-data-dir='+join(tmp,'profile-'+page),'--virtual-time-budget=2500',
      '--dump-dom',pathToFileURL(file).href
    ],{encoding:'utf8',timeout:30000,maxBuffer:5_000_000});
    assert.equal(result.status,0,page+': Chrome launch failed '+String(result.stderr).slice(-500));
    const error=result.stdout.match(/data-a11y-error="([^"]*)"/)?.[1]||'missing a11y result';
    assert.match(result.stdout,/data-a11y-smoke="passed"/,page+': '+error);
    console.log('ACCESSIBILITY SMOKE PASS: '+page+' (420px Chromium)');
  }
}finally{rmSync(tmp,{recursive:true,force:true})}
