import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const imports="import {analyzeHtml} from './worker/seo-html-analysis.mjs';\nimport {buildSeoRecommendations} from './worker/seo-recommendations.mjs';";
const html=read('seo-offline-audit.html');
assert.ok(html.includes(imports)&&html.includes('<script type="module">'),'Unexpected offline template');
const libs=['worker/seo-html-analysis.mjs','worker/seo-recommendations.mjs'].map(p=>read(p).replace(/^export /gm,'').trim()).join('\n\n');
assert.ok(!libs.toLowerCase().includes('</script'),'Embedded code cannot contain script-close tokens');
let output=html.replace('<script type="module">','<script>').replace(imports,libs+'\n');
output=output.replace('Offline SEO Audit | USHA ONE Technologies','Standalone Offline SEO Audit | USHA ONE Technologies').replace('SEO HTML Audit — Offline','SEO HTML Audit — Standalone Offline');
const path=new URL('../seo-offline-standalone.html',import.meta.url);
if(process.argv.includes('--check'))assert.equal(readFileSync(path,'utf8'),output,'Rebuild standalone HTML: node scripts/build-seo-standalone.mjs');
else{writeFileSync(path,output);console.log('Generated seo-offline-standalone.html')}
