// Playwright WebKit smoke, run on macOS CI. WebKit is not identical to native iOS Safari.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {webkit} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const file=name=>pathToFileURL(resolve(root,name)).href;
const browser=await webkit.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(15000);
const open=async name=>{
  await page.goto(file(name));
  const data=await page.evaluate(()=>({
    headings:document.querySelectorAll('h1').length,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  }));
  assert.equal(data.headings,1,name+' must have one H1');
  assert.ok(data.overflow<=4,name+' has viewport overflow: '+data.overflow);
  console.log('WEBKIT MOBILE PASS: '+name);
};
try{
  await open('index.html');
  assert.ok(await page.locator('a[href="seo.html"]').count());
  const homeNav=page.locator('.nav-links');
  assert.equal(await homeNav.isVisible(),false);
  await page.locator('.menu-toggle').click();
  assert.equal(await homeNav.isVisible(),true);
  await open('seo.html');
  const seoNav=page.locator('#seoNav');
  assert.equal(await seoNav.isVisible(),false);
  await page.locator('.menu-toggle').click();
  assert.equal(await seoNav.isVisible(),true);
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await seoNav.isVisible(),false);
  await open('seo-preflight.html');
  await page.locator('#url').fill('https://www.example.org/a?source=test');
  await page.locator('#form button[type=submit]').click();
  assert.equal(await page.locator('#results').isVisible(),true);
  assert.match(await page.locator('#grid').innerText(),/Live crawl \/ indexing/);
  await open('seo-offline-standalone.html');
  await page.locator('#pageUrl').fill('https://www.example.org/');
  await page.locator('#htmlFile').setInputFiles({
    name:'example.html',mimeType:'text/html',
    buffer:Buffer.from('<html><head><title>WebKit SEO sample</title></head><body><h1>OK</h1></body></html>')
  });
  await page.locator('#analyze').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Offline HTML analysis completed'));
  assert.match(await page.locator('#cards').innerText(),/WebKit SEO sample/);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
  let json='';for await(const chunk of await download.createReadStream())json+=chunk.toString('utf8');
  const result=JSON.parse(json);
  assert.equal(result.liveCrawl,false);
  assert.equal(result.title,'WebKit SEO sample');
  await open('seo-audit-report.html');
  await page.locator('#file').setInputFiles({
    name:'report.json',mimeType:'application/json',buffer:Buffer.from(json)
  });
  await page.waitForFunction(()=>!document.getElementById('print')?.disabled);
  assert.equal(await page.locator('#report').isVisible(),true);
  assert.match(await page.locator('#meta').innerText(),/not a live crawl/);
  assert.match(await page.locator('#cards').innerText(),/WebKit SEO sample/);
  for(const width of [360,420,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const name of ['index.html','seo.html','seo-preflight.html','seo-offline-standalone.html','seo-audit-report.html']){
      await open(name);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true,name+' Tab must reach a control');
      console.log('WEBKIT RESPONSIVE PASS: '+name+' ('+width+'px, keyboard Tab)');
    }
  }
  console.log('WEBKIT PASS: navigation, keyboard, local upload/export, JSON import and 390px layouts');
}finally{await context.close();await browser.close()}
