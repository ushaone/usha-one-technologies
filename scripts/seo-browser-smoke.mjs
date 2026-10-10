// Real headless-browser smoke checks; no npm packages required.
import {readFileSync,writeFileSync,mkdtempSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=mkdtempSync(join(tmpdir(),'usha-seo-browser-'));
const browsers=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
const browser=browsers.find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:5000});return !r.error&&r.status===0});
if(!browser)throw Error('Google Chrome / Chromium required for real-browser tests');
const sample='<!doctype html><head><title>SEO Fixture</title><meta name="description" content="Test description"></head><body><h1>Fixture heading</h1></body>';
const wait="const waitFor=async check=>{for(let i=0;i<80;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,20))}throw Error('Timed out waiting for page')};";
function smoke(fileName,name,code,mobile=false){
  const source=readFileSync(join(root,fileName),'utf8');
  assert.ok(source.includes('</body>'));
  const injection='<script>(async()=>{try{'+wait+code+';document.documentElement.setAttribute("data-browser-smoke","passed")}catch(e){document.documentElement.setAttribute("data-browser-smoke","failed");document.documentElement.setAttribute("data-browser-error",String(e.message||e))}})();</script>';
  const path=join(temp,name+'.html');
  writeFileSync(path,source.replace('</body>',injection+'</body>'));
  const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--disable-background-networking','--user-data-dir='+join(temp,'profile-'+name),'--virtual-time-budget=3500','--dump-dom',pathToFileURL(path).href];
  if(mobile)args.splice(args.length-2,0,'--window-size=420,840');
  const result=spawnSync(browser,args,{encoding:'utf8',timeout:30000,maxBuffer:5_000_000});
  assert.equal(result.status,0,name+' Chrome failed: '+String(result.stderr).slice(-1000));
  assert.match(result.stdout,/data-browser-smoke="passed"/,name+' browser failure: '+String(result.stdout.match(/data-browser-error="([^"]*)"/)?.[1]||'missing browser result'));
  console.log('BROWSER PASS: '+name);
}
try{
 // Serve the SEO and homepage test files with their real stylesheet, scripts and logos.
 for(const folder of ['css','js','ASSETS'])cpSync(join(root,folder),join(temp,folder),{recursive:true});
 smoke('seo-offline-standalone.html','offline-upload',[
   'const transfer=new DataTransfer()',
   'transfer.items.add(new File(['+JSON.stringify(sample)+'],"sample.HTML",{type:"text/html"}))',
   'document.getElementById("htmlFile").files=transfer.files',
   'document.getElementById("pageUrl").value="https://www.example.org/"',
   'let blob;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{blob=b;return original(b)}',
   'document.getElementById("analyze").click()',
   'await waitFor(()=>document.getElementById("status").textContent.includes("Offline HTML analysis completed"))',
   'if(document.getElementById("results").classList.contains("hidden"))throw Error("Findings not shown")',
   'if(!document.getElementById("cards").textContent.includes("SEO Fixture"))throw Error("Page title missing")',
   'document.getElementById("download").click()',
   'await waitFor(()=>!!blob)',
   'const output=JSON.parse(await blob.text())',
   'if(output.source!=="offline-html"||output.liveCrawl!==false||output.title!=="SEO Fixture"||output.h1Count!==1)throw Error("Export mismatch")'
 ].join(';'));
 smoke('seo-offline-standalone.html','offline-blank',[
   'const transfer=new DataTransfer()',
   'transfer.items.add(new File(["   "],"blank.htm",{type:"text/html"}))',
   'document.getElementById("htmlFile").files=transfer.files',
   'document.getElementById("pageUrl").value="https://www.example.org/"',
   'document.getElementById("analyze").click()',
   'await waitFor(()=>document.getElementById("status").textContent.includes("The selected HTML file is empty"))',
   'if(!document.getElementById("results").classList.contains("hidden"))throw Error("Blank file produced results")'
 ].join(';'));
 smoke('seo-audit-report.html','report-import',[
   'const report={status:"complete",source:"offline-html",liveCrawl:false,url:"https://www.example.org/",fetchedAt:null,httpStatus:null,observations:[{key:"title",status:"observed",value:"SEO Fixture"}],title:"SEO Fixture",description:"Description",h1:["Heading"],h1Count:1,recommendations:[]}',
   'const dt=new DataTransfer()',
   'dt.items.add(new File([JSON.stringify(report)],"report.json",{type:"application/json"}))',
   'const picker=document.getElementById("file");picker.files=dt.files;picker.dispatchEvent(new Event("change"))',
   'await waitFor(()=>!document.getElementById("print").disabled)',
   'if(document.getElementById("report").classList.contains("hidden"))throw Error("Report hidden")',
   'if(!document.getElementById("meta").textContent.includes("not a live crawl"))throw Error("Offline disclaimer missing")',
   'if(!document.getElementById("cards").textContent.includes("SEO Fixture"))throw Error("Title missing")'
 ].join(';'));
 smoke('seo-preflight.html','url-preflight',[
   'document.getElementById("url").value="https://www.example.org/page?utm_source=smoke"',
   'document.getElementById("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))',
   'if(document.getElementById("results").hidden)throw Error("URL findings hidden")',
   'if(!document.getElementById("grid").textContent.includes("Live crawl / indexing"))throw Error("Missing limitations")'
 ].join(';'));

 smoke('seo-audit-report.html','mobile-xss-report',[
   'const danger="<img src=x onerror=alert(1)>"',
   'const data={status:"complete",source:"offline-html",liveCrawl:false,url:"https://www.example.org/",observations:[{key:"title",status:"observed",value:danger}],title:danger,h1:[danger],h1Count:1,recommendations:[]}',
   'const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(data)],"report.json",{type:"application/json"}))',
   'const picker=document.getElementById("file");picker.files=dt.files;picker.dispatchEvent(new Event("change"))',
   'await waitFor(()=>!document.getElementById("print").disabled)',
   'if(document.getElementById("cards").querySelector("img"))throw Error("Untrusted HTML parsed as markup")',
   'if(!document.getElementById("cards").textContent.includes(danger))throw Error("Untrusted text not visible")',
   'if(window.innerWidth>600)throw Error("Narrow viewport not applied: "+window.innerWidth)',
   'if(document.documentElement.scrollWidth>document.documentElement.clientWidth+4)throw Error("Mobile horizontal overflow")',
   'if(getComputedStyle(document.getElementById("cards")).gridTemplateColumns.trim().split(/\\s+/).length!==1)throw Error("Mobile layout not one column")'
 ].join(';'),true);

 smoke('seo.html','seo-page-mobile-menu',[
   'const toggle=document.querySelector(".menu-toggle"),nav=document.getElementById("seoNav")',
   'if(!toggle||!nav)throw Error("SEO menu missing")',
   'if(getComputedStyle(nav).display!=="none")throw Error("Menu should begin hidden on mobile")',
   'toggle.click()',
   'if(getComputedStyle(nav).display==="none")throw Error("Mobile SEO menu did not open")',
   'if(toggle.getAttribute("aria-expanded")!=="true")throw Error("ARIA state not expanded")',
   'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))',
   'if(getComputedStyle(nav).display!=="none"||toggle.getAttribute("aria-expanded")!=="false")throw Error("Escape did not close the menu")',
   'toggle.click();nav.querySelector(\'a[href="#services"]\').click()',
   'if(getComputedStyle(nav).display!=="none")throw Error("Selecting navigation did not close menu")',
   'if(!document.querySelector(\'a[href="seo-offline-standalone.html"]\'))throw Error("Offline tool link missing")',
   'if(document.documentElement.scrollWidth>document.documentElement.clientWidth+4)throw Error("SEO page horizontal overflow")'
 ].join(';'),true);
 smoke('index.html','home-seo-menu-mobile',[
   'const seoLink=document.querySelector(\'a[href="seo.html"]\')',
   'if(!seoLink)throw Error("Homepage SEO Services link missing")',
   'const nav=document.querySelector(".nav-links"),toggle=document.querySelector(".menu-toggle")',
   'if(getComputedStyle(nav).display!=="none")throw Error("Homepage menu must begin hidden")',
   'toggle.click()',
   'if(getComputedStyle(nav).display==="none")throw Error("Homepage mobile menu did not open")',
   'if(document.documentElement.scrollWidth>document.documentElement.clientWidth+4)throw Error("Homepage horizontal overflow")'
 ].join(';'),true);
}finally{rmSync(temp,{recursive:true,force:true})}
