import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../seo.html',import.meta.url),'utf8');
for(const [path,label] of [['seo-preflight.html','Check a URL'],['seo-offline-audit.html','Analyze an HTML File'],['seo-audit-report.html','Open Report Viewer']]){
 test('SEO services page provides working local navigation to '+path,()=>{
   assert.ok(existsSync(new URL('../'+path,import.meta.url)));
   assert.ok(html.includes('href="'+path+'"'));
   assert.ok(html.includes(label));
 });
}
test('self-service tool descriptions distinguish offline analysis from live audit',()=>{
 assert.match(html,/Neither tool contacts your website/);
 assert.match(html,/No live crawl/);
});
