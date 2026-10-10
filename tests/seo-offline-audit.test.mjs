import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeHtml} from '../worker/seo-html-analysis.mjs';
import {buildSeoRecommendations} from '../worker/seo-recommendations.mjs';
const page=readFileSync(new URL('../seo-offline-audit.html',import.meta.url),'utf8');
test('offline audit imports shared evidence and recommendation modules',()=>{assert.match(page,/import \{analyzeHtml\}/);assert.match(page,/import \{buildSeoRecommendations\}/);assert.match(page,/source:'offline-html'/);assert.match(page,/liveCrawl:false/)});
test('offline audit does not fetch or upload website data',()=>{assert.doesNotMatch(page,/\bfetch\s*\(/);assert.doesNotMatch(page,/XMLHttpRequest/);assert.match(page,/file\.text\(\)/)});
test('offline HTML analysis gives conservative findings',()=>{const evidence=analyzeHtml('<html><head><title>Sample</title></head><body><h1>Heading</h1></body></html>','https://www.example.org/');const suggestions=buildSeoRecommendations({...evidence,source:'live-html'});assert.equal(evidence.title,'Sample');assert.equal(evidence.h1Count,1);assert.equal(suggestions.scoring,'not-calculated')});
