import { cp, mkdir, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await rm(new URL('../dist', import.meta.url), {recursive:true, force:true});
await mkdir(new URL('../dist/vendor', import.meta.url), {recursive:true});
await cp(new URL('../public', import.meta.url), new URL('../dist', import.meta.url), {recursive:true});
await cp(new URL('../node_modules/pdf-lib/dist/pdf-lib.min.js', import.meta.url), new URL('../dist/vendor/pdf-lib.min.js', import.meta.url));
const hash=createHash('sha256');
for(const name of (await readdir(new URL('../dist',import.meta.url))).sort()) {
  if(name==='vendor') continue;
  hash.update(await readFile(new URL('../dist/'+name,import.meta.url)));
}
hash.update(await readFile(new URL('../dist/vendor/pdf-lib.min.js',import.meta.url)));
const worker=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
await writeFile(new URL('../dist/sw.js',import.meta.url),worker.replace('BUILD_VERSION',hash.digest('hex').slice(0,12)));
await mkdir(new URL('../dist/licenses',import.meta.url),{recursive:true});
for(const [source,name] of [['pdf-lib/LICENSE.md','pdf-lib.txt'],['@pdf-lib/standard-fonts/LICENSE.md','standard-fonts.txt'],['@pdf-lib/upng/LICENSE','upng.txt'],['pako/LICENSE','pako.txt'],['tslib/LICENSE.txt','tslib.txt']]) {
  await cp(new URL('../node_modules/'+source,import.meta.url),new URL('../dist/licenses/'+name,import.meta.url));
}
console.log('Built standalone static app in dist/');
