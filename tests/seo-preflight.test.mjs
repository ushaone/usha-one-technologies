// Run: node --test tests/seo-preflight.test.mjs
// This suite validates the Phase 2 standalone URL preflight page without network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(resolve(here, '../seo-preflight.html'), 'utf8');

test('page has an accessible, required URL input and a submit button', () => {
  assert.match(page, /<form id="form">/);
  assert.match(page, /<label for="url">Website URL<\/label>/);
  assert.match(page, /<input id="url" type="url" required/);
  assert.match(page, /<button type="submit">Analyze URL/);
});

test('results are initially hidden and announced when populated', () => {
  assert.match(page, /id="results" class="results" hidden aria-live="polite"/);
  assert.match(page, /results\.hidden=false/);
});

test('input accepts only HTTP and HTTPS URLs', () => {
  assert.match(page, /\['https:','http:'\]\.includes\(u\.protocol\)/);
  assert.match(page, /new URL\(document\.getElementById\('url'\)\.value\.trim\(\)\)/);
});

test('untrusted user data is written using textContent, not innerHTML', () => {
  assert.match(page, /desc\.textContent=detail/);
  assert.match(page, /checked\.textContent=u\.href/);
  assert.doesNotMatch(page, /\.innerHTML\s*=/);
  assert.doesNotMatch(page, /document\.write\s*\(/);
});

test('page makes no remote calls and labels live audit as not tested', () => {
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /XMLHttpRequest/);
  assert.match(page, /Live crawl \/ indexing','Not tested'/);
  assert.match(page, /not a technical SEO audit/i);
});

test('download is generated locally with a safe filename', () => {
  assert.match(page, /new Blob\(\[report\]/);
  assert.match(page, /a\.download='usha-one-url-preflight\.txt'/);
  assert.match(page, /URL\.revokeObjectURL/);
});

test('page includes mobile viewport and responsive styling', () => {
  assert.match(page, /name="viewport"/);
  assert.match(page, /@media\(max-width:620px\)/);
});
