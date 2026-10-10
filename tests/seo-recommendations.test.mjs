import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSeoRecommendations} from '../worker/seo-recommendations.mjs';
const base={source:'live-html',observations:[],title:'',description:'',h1Count:0,canonical:null,viewport:'',robots:''};
test('missing fields have evidence-backed suggestions',()=>{const x=buildSeoRecommendations(base);assert.equal(x.recommendations.length,5);assert.equal(x.scoring,'not-calculated')});
test('noindex produces a review suggestion',()=>{const x=buildSeoRecommendations({...base,title:'Title',description:'Description',h1Count:1,canonical:'https://site.org/',viewport:'width=device-width',robots:'noindex'});assert.equal(x.recommendations[0].id,'noindex')});
test('unmeasured input is rejected',()=>assert.throws(()=>buildSeoRecommendations({...base,source:'preflight'})));
