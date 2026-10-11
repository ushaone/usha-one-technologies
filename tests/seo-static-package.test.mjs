import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {STATIC_FILES,stageStaticAssets} from '../scripts/stage-static-assets.mjs';
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'seo-package-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(...a)=>execFileSync('git',a,{cwd:root,stdio:'pipe'});
 git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
 for(const p of STATIC_FILES){mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),'committed '+p);}
 git('add','.');git('commit','-m','fixture');return {root,git};
}
test('static package excludes repository metadata, runtime files and unreviewed content',t=>{
 const {root,git}=fixture(t);
 for(const p of ['worker/secret.mjs','css/unapproved.css','.wrangler/tmp/source.map']){
  mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),'must not ship');
 }
 git('add','.');git('commit','-m','unapproved files');
 writeFileSync(join(root,'index.html'),'uncommitted change must not ship');
 const result=stageStaticAssets(root);
 const paths=readdirSync(result.output,{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>join(x.parentPath??x.path,x.name).slice(result.output.length+1)).sort();
 assert.deepEqual(paths,[...STATIC_FILES].sort());
 assert.equal(readFileSync(join(result.output,'index.html'),'utf8'),'committed index.html');
 writeFileSync(join(result.output,'stale-secret.txt'),'old');
 stageStaticAssets(root);
 assert.equal(readdirSync(result.output).includes('stale-secret.txt'),false);
});
test('static package rejects committed symlinks',t=>{
 const {root,git}=fixture(t);rmSync(join(root,'index.html'));symlinkSync('.git/config',join(root,'index.html'));
 git('add','.');git('commit','-m','symlink');
 assert.throws(()=>stageStaticAssets(root),/non-regular website asset/);
});
test('static package fails closed when a required asset is missing',t=>{
 const {root,git}=fixture(t);git('rm','seo.html');git('commit','-m','missing');
 assert.throws(()=>stageStaticAssets(root),/Missing or non-regular/);
});
