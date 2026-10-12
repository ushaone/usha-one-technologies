// Fail CI if the static release candidate diverges from reviewed development files
// or includes any live-audit backend, Worker configuration or unexpected asset.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const root=new URL('..',import.meta.url);
const exec=(...args)=>{
 const run=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,'git '+args.join(' ')+' failed: '+(run.stderr||run.stdout));
 return run.stdout.trim();
};
const candidate='origin/seo-offline-release-candidate';
// PR #2 is merged. A moving main now has the candidate's tree, so comparing
// against it incorrectly reports zero changed files. Preserve the approved
// pre-release baseline; do not weaken the seven-file or blob-equality checks.
const base='ed356568d30e66e5c5a07f4f9e41fe8fcd0ec0a2';
exec('merge-base','--is-ancestor',base,candidate);
const allowed=[
 'index.html','seo.html','css/seo.css','js/seo.js',
 'seo-preflight.html','seo-offline-standalone.html','seo-audit-report.html'
].sort();
const diff=exec('diff','--name-only',base,candidate).split('\n').filter(Boolean).sort();
assert.deepEqual(diff,allowed,'Release PR must change exactly the seven reviewed static files');
for(const path of allowed){
 const reviewed=exec('rev-parse','HEAD:'+path);
 const proposed=exec('rev-parse',candidate+':'+path);
 assert.equal(proposed,reviewed,path+' diverges from validated development branch');
}
const forbidden=diff.filter(path=>path.startsWith('worker/')||path.startsWith('wrangler')||path.startsWith('.github/'));
assert.deepEqual(forbidden,[],'Release branch must not modify Workers or CI');
console.log('RELEASE CHECK PASS: exactly 7 reviewed static files; all Git blob SHAs match validated development branch');
