import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
function check(dir) { for(const entry of readdirSync(dir,{withFileTypes:true})) {
 const path=dir+'/'+entry.name; if(entry.isDirectory() && entry.name!=='node_modules')check(path);
 else if(entry.isFile() && path.endsWith('.mjs'))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
}}
check('.'); console.log('JavaScript syntax checks passed');
