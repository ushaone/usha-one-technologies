import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../seo-audit-report.html',import.meta.url),'utf8');
test('report is local file only, not a remote data collector',()=>{
 assert.match(page,/type="file" id="file"/);
 assert.match(page,/await f\.text\(\)/);
 assert.doesNotMatch(page,/\bfetch\s*\(/);
 assert.doesNotMatch(page,/XMLHttpRequest/);
});
test('rejects incomplete or fake audit results',()=>{
 assert.match(page,/data\.status!=='complete'/);
 assert.match(page,/data\.liveCrawl===true/);
 assert.match(page,/data\.liveCrawl===false/);
 assert.match(page,/data\.source==='live-html'/);
 assert.match(page,/data\.source==='offline-html'/);
});
test('renders user-supplied values as text and prints locally',()=>{
 assert.match(page,/p\.textContent=/);
 assert.doesNotMatch(page,/\.innerHTML\s*=/);
 assert.match(page,/window\.print\(\)/);
});
test('has responsive print and mobile layout',()=>{
 assert.match(page,/@media print/);
 assert.match(page,/@media\(max-width:600px\)/);
});
