// Verify Print / Save PDF creates a nonempty document using a real headless browser.
// No external dependencies, no outgoing network requests, and no release artifacts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const browser=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:5000});return !r.error&&r.status===0});
if(!browser)throw Error('Chrome/Chromium is required for printable report verification');
const tmp=mkdtempSync(join(tmpdir(),'usha-seo-print-'));
try{
 const report={status:'complete',source:'offline-html',liveCrawl:false,url:'https://www.example.org/',fetchedAt:null,httpStatus:null,observations:[{key:'title',status:'observed',value:'Printable SEO Fixture'}],title:'Printable SEO Fixture',description:'Local HTML evidence',h1:['A heading'],h1Count:1,internalLinks:2,externalLinks:1,recommendations:[{id:'viewport-missing',severity:'medium',message:'Check viewport',evidence:'Missing viewport'}]};
 const read=readFileSync(new URL('../seo-audit-report.html',import.meta.url),'utf8');
 const inject=[
  'const data='+JSON.stringify(report),
  'const transfer=new DataTransfer()',
  'transfer.items.add(new File([JSON.stringify(data)],"report.json",{type:"application/json"}))',
  'const picker=document.getElementById("file");picker.files=transfer.files;picker.dispatchEvent(new Event("change"))',
  'const wait=async()=>{for(let i=0;i<60;i++){if(!document.getElementById("print").disabled)return;await new Promise(resolve=>setTimeout(resolve,15))}throw Error("Report failed to load")}',
  'await wait()',
  'if(document.getElementById("report").classList.contains("hidden"))throw Error("Report still hidden")',
  'document.documentElement.setAttribute("data-pdf-ready","yes")'
 ].join(';');
 const bootstrap='<script>(async()=>{try{'+inject+'}catch(error){document.documentElement.setAttribute("data-pdf-error",String(error.message||error))}})();</script>';
 assert.ok(read.includes('</body>'));
 const file=join(tmp,'report.html'),pdf=join(tmp,'report.pdf');
 writeFileSync(file,read.replace('</body>',bootstrap+'</body>'));
 const uri=pathToFileURL(file).href;
 const common=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run','--virtual-time-budget=3000'];
 const run=(rest)=>spawnSync(browser,[...common,'--user-data-dir='+join(tmp,'profile-'+rest[0].slice(2,6)),...rest,uri],{encoding:'utf8',timeout:30000,maxBuffer:5_000_000});
 const preflight=run(['--dump-dom']);
 assert.equal(preflight.status,0,'Browser could not open report: '+String(preflight.stderr).slice(-600));
 assert.match(preflight.stdout,/data-pdf-ready="yes"/,'Report did not finish rendering before print');
 assert.match(preflight.stdout,/Printable SEO Fixture/);
 const printed=run(['--no-pdf-header-footer','--print-to-pdf='+pdf]);
 assert.equal(printed.status,0,'Chrome could not print report: '+String(printed.stderr).slice(-600));
 const bytes=readFileSync(pdf);
 assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-','Printed artifact is not PDF');
 assert.ok(statSync(pdf).size>2000,'PDF output is suspiciously small');
 console.log('BROWSER PASS: printable-report-pdf ('+bytes.length+' bytes)');
}finally{rmSync(tmp,{recursive:true,force:true})}
