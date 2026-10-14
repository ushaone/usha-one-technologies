// Browser + real local workerd/D1 flow. Requires a running test/wrangler.toml worker.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {signClaims} from '../auth.mjs';
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'):require('playwright');
const base=process.env.ONE_AI_TEST_URL||'http://127.0.0.1:8791';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local tests only');
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/') {
   res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>ONE AI local test</title><link rel="stylesheet" href="/review-panel.css"><body style="margin:16px"><label>Test actor <select id="actor"><option>staff</option><option>manager</option></select></label><main id="panel"></main><script type="module">import {mountReviewPanel} from '/review-panel.mjs';const lead='browser-'+crypto.randomUUID();mountReviewPanel(document.querySelector('#panel'),{leadId:lead,api:async(path,options={})=>{const r=await fetch('/proxy'+path,{method:options.method||'GET',headers:{'content-type':'application/json','x-test-actor':document.querySelector('#actor').value,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});const b=await r.json();if(!r.ok)throw Error(b.error);return b;}});</script></body></html>`);return;
  }
  if(['/review-panel.mjs','/review-panel.css'].includes(url.pathname)){
   res.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(new URL('../integrations'+url.pathname,import.meta.url)));return;
  }
  if(url.pathname.startsWith('/proxy/api/')){
   let body='';for await(const chunk of req)body+=chunk;
   const actor=req.headers['x-test-actor']==='manager'?'manager':'staff',now=Math.floor(Date.now()/1000);
   const token=await signClaims({iss:'local-test-crm',aud:'one-ai:usha-one:local-test',product:'usha-one',tenantId:'test-tenant',sub:actor,version:1,jti:crypto.randomUUID(),iat:now,exp:now+120},'LOCAL-TEST-ONLY-DO-NOT-DEPLOY-123456789');
   const r=await fetch(base+url.pathname.slice(6)+url.search,{method:req.method,headers:{authorization:'Bearer '+token,'content-type':'application/json',...(req.headers['idempotency-key']?{'idempotency-key':req.headers['idempotency-key']}:{})},...(body?{body}:{})});
   res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());return;
  }res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end('Test server failure');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});let pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const status=page.getByRole('status');await status.getByText('No drafts yet.').waitFor();
 await page.getByLabel('Draft language').selectOption('te');await page.getByRole('button',{name:'Generate draft',exact:true}).click();await status.getByText(/draft · Version 1/).waitFor();
 const malicious='<img src=x onerror="window.XSS=true">';await page.getByLabel('Draft message').fill(malicious);
 await page.getByRole('button',{name:'Save revision',exact:true}).click();await status.getByText(/draft · Version 2/).waitFor();
 assert.equal(await page.locator('#panel img').count(),0);assert.equal(await page.evaluate(()=>window.XSS),undefined);
 await page.getByRole('button',{name:'Submit for approval',exact:true}).click();await status.getByText(/pending_approval · Version 3/).waitFor();
 await page.getByRole('button',{name:'Approve',exact:true}).click();await status.getByText('Insufficient role').waitFor();
 await page.locator('#actor').selectOption('manager');await page.getByRole('button',{name:'Approve',exact:true}).click();await status.getByText(/approved · Version 4/).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.getByRole('button',{name:'Send',exact:true}).count(),0);assert.deepEqual(pageErrors,[]);
 console.log('PASS: Chromium 390px, generate/edit/review/role rejection/manager approval through local Worker, no horizontal overflow, model text rendered inert, no send control');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
