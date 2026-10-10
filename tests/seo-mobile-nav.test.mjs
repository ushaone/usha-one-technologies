import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const seo=read('seo.html'),css=read('css/seo.css'),js=read('js/seo.js'),home=read('index.html');
test('homepage makes new SEO services discoverable',()=>{
 assert.match(home,/<a href="seo\.html">SEO Services<\/a>/);
});
test('SEO page mobile menu has accessible expanded state and target',()=>{
 assert.match(seo,/aria-controls="seoNav" aria-expanded="false"/);
 assert.match(seo,/<nav id="seoNav" class="nav-links"/);
 assert.match(js,/nav\.classList\.toggle\('seo-nav-open',open\)/);
});
test('SEO mobile menu has actual CSS making hidden links visible',()=>{
 assert.match(css,/@media\(max-width:1000px\)/);
 assert.match(css,/\.site-header \.nav-links\.seo-nav-open\{display:flex/);
 assert.match(css,/:focus-visible/);
});
test('SEO navigation closes when a link is selected or Escape is pressed',()=>{
 assert.match(js,/event\.target\.closest\('a'\)\)closeMenu\(\)/);
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/toggle\.setAttribute\('aria-expanded','false'\)/);
});
