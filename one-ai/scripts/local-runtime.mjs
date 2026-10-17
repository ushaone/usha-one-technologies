// Alternative to `wrangler dev` for restricted containers where interface discovery is unavailable.
// Same workerd runtime and D1 state created by Wrangler migrations; synthetic test Worker only.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['test/local-worker.mjs'],bundle:true,format:'esm',platform:'neutral',write:false});
const mf=new Miniflare({...convertV4MiniflareOptions({host:'127.0.0.1',port:8791,modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-13',
 d1Databases:{DB:'00000000-0000-0000-0000-000000000001'},d1Persist:'test/.wrangler/state/v3/d1'}),resourcePersistencePath:'test/.wrangler/state/v3'});
console.log('Local synthetic runtime ready:',String(await mf.ready));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0);});
if(process.argv.includes('--verify')) {
 try {
  await import('./local-smoke.mjs');
  if(process.argv.includes('--browser'))await import('./browser-smoke.mjs');
 } finally {await mf.dispose();}
}
