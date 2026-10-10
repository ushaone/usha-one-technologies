import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const page=readFileSync(new URL('../seo-offline-standalone.html',import.meta.url),'utf8');
test('standalone audit is a valid inline browser script without module dependencies',()=>{
 assert.doesNotMatch(page,/<script type="module">/);
 assert.doesNotMatch(page,/import \{analyzeHtml\}/);
 const inline=page.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline,'Expected one inline script');
 assert.doesNotThrow(()=>new Script(inline[1]));
});
test('standalone offline audit never calls remote networks or claims a live crawl',()=>{
 assert.doesNotMatch(page,/\bfetch\s*\(/);
 assert.doesNotMatch(page,/XMLHttpRequest/);
 assert.match(page,/source:'offline-html'/);
 assert.match(page,/liveCrawl:false/);
 assert.match(page,/No website was contacted/);
});
test('standalone retains HTML analysis, recommendations and JSON export',()=>{
 assert.match(page,/function analyzeHtml\(/);
 assert.match(page,/function buildSeoRecommendations\(/);
 assert.match(page,/usha-one-offline-seo-report\.json/);
});
