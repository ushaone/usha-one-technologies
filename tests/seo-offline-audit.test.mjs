import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeHtml} from '../worker/seo-html-analysis.mjs';
import {buildSeoRecommendations} from '../worker/seo-recommendations.mjs';
const page=readFileSync(new URL('../seo-offline-audit.html',import.meta.url),'utf8');
test('offline UI uses offline provenance',()=>{assert.match(page,/source:'offline-html'/);assert.match(page,/liveCrawl:false/);assert.match(page,/buildSeoRecommendations/)});
test('offline audit does not fetch remote content',()=>{assert.doesNotMatch(page,/\bfetch\s*\(/);assert.doesNotMatch(page,/XMLHttpRequest/)});
test('offline evidence remains labeled offline',()=>{const html=readFileSync(new URL('./fixtures/seo-example-page.html',import.meta.url),'utf8');const result=analyzeHtml(html,'https://www.example.org/');const advice=buildSeoRecommendations({...result,source:'offline-html'});assert.equal(result.h1Count,1);assert.equal(result.internalLinks,1);assert.equal(result.externalLinks,1);assert.equal(advice.scope,'user-supplied-html');assert.equal(advice.scoring,'not-calculated')});
