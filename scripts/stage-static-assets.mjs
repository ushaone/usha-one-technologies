// Package only reviewed, committed website blobs; never scan the checkout root.
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, renameSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const STATIC_FILES = [
  "ASSETS/README.txt",
  "ASSETS/brand/usha-one-brand-board.png",
  "ASSETS/logo/usha-one-full-logo-blue-bg.png",
  "ASSETS/logo/usha-one-full-logo-transparent.png",
  "ASSETS/logo/usha-one-icon-transparent.png",
  "ASSETS/logo/usha-one-marked-dark-logo.png",
  "ASSETS/logo/usha-one-text-full-transparent.png",
  "ASSETS/logo/usha-one-text-transparent.png",
  "ASSETS/reference/usha-one-approved-website-mockup.png",
  "ASSETS/usha-one-approved-website-mockup.png",
  "ASSETS/usha-one-full-logo-transparent.png",
  "ASSETS/usha-one-icon-transparent.png",
  "ASSETS/usha-one-text-transparent.png",
  "ASSETS/website/favicon.png",
  "ASSETS/website/index.html",
  "css/seo.css",
  "css/style.css",
  "index.html",
  "js/main.js",
  "js/seo.js",
  "seo-audit-report.html",
  "seo-offline-standalone.html",
  "seo-preflight.html",
  "seo.html"
];
export function stageStaticAssets(root) {
  root=resolve(root);
  const git=(...args)=>execFileSync('git',args,{cwd:root,timeout:10000,maxBuffer:32*1024*1024});
  const commit=git('rev-parse','--verify','HEAD^{commit}').toString().trim();
  // Validate every entry before replacing any previous successful package.
  const blobs=STATIC_FILES.map(path=>{
    const entry=git('ls-tree',commit,'--',path).toString().trim();
    if (!/^100644 blob [a-f0-9]+	/.test(entry)) throw new Error('Missing or non-regular website asset: '+path);
    return [path,git('show',commit+':'+path)];
  });
  const staging=mkdtempSync(resolve(root,'.static-assets-stage-'));
  try {
    for(const [path,bytes] of blobs){
      const destination=resolve(staging,path);
      mkdirSync(dirname(destination),{recursive:true});
      writeFileSync(destination,bytes);
    }
    const output=resolve(root,'.static-assets');
    rmSync(output,{recursive:true,force:true});
    renameSync(staging,output);
    return {commit,files:blobs.length,output};
  } finally {rmSync(staging,{recursive:true,force:true});}
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log('STATIC PACKAGE PASS:',JSON.stringify(stageStaticAssets(fileURLToPath(new URL('..',import.meta.url)))));
}
