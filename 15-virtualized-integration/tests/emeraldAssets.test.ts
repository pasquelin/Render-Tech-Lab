import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createEmeraldAssetsPlugin } from '../assets/vite.ts';

test('newly prepared Emerald assets are served after startup; missing files never return the app HTML', async () => {
 const root=await mkdtemp(join(tmpdir(),'emerald-assets-'));
 const server=createServer();
 const plugin=createEmeraldAssetsPlugin();
 (plugin.configureServer as Function)({config:{root},middlewares:{use(prefix:string,handler:Function){server.on('request',(req,res)=>{req.url=req.url?.slice(prefix.length);handler(req,res);});}}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/benchmark-assets/emerald-derived`;
 try {
  assert.equal((await fetch(url+'/native/full/manifest.json')).status,404);
  await mkdir(join(root,'public/benchmark-assets/emerald-derived/native/full'),{recursive:true});
  await writeFile(join(root,'public/benchmark-assets/emerald-derived/native/full/manifest.json'),'{}');
  const response=await fetch(url+'/native/full/manifest.json');assert.equal(response.status,200);assert.equal(await response.text(),'{}');assert.match(response.headers.get('content-type')!,/json/);
  assert.equal((await fetch(url+'/native/full/manifest.json',{method:'HEAD'})).status,200);
  assert.equal((await fetch(url+'/%2e%2e%2fsecret.json')).status,403);
 } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
