import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../seo-audit-report.html',import.meta.url),'utf8');
test('viewer identifies offline and live evidence separately',()=>{
 assert.match(html,/offline-html/);
 assert.match(html,/live-html/);
 assert.match(html,/Not fetched/);
 assert.match(html,/Not measured/);
});
test('viewer avoids HTML injection from imported reports',()=>{
 assert.match(html,/textContent/);
 assert.doesNotMatch(html,/innerHTML\s*=/);
});
