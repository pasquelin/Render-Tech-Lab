import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createModelAssetsPlugin } from '../assets/vite.ts';

type Handler = (request: EventEmitter & { method: string; url: string }, response: Writable & { statusCode: number; setHeader(name: string, value: string | number): void }) => void;

function modelAssetHandler(root: string) {
 let handler: Handler | undefined;
 const plugin = createModelAssetsPlugin();
 (plugin.configureServer as Function)({config:{root},middlewares:{use(_prefix:string,registered:Handler){handler=registered;}}});
 assert.ok(handler);
 return handler;
}

async function request(handler: Handler, method: string, url: string) {
 const headers = new Map<string, string | number>(), body: Buffer[] = [];
 const response = new Writable({write(chunk,_encoding,callback){body.push(Buffer.from(chunk));callback();}}) as Writable & { statusCode: number; setHeader(name: string, value: string | number): void };
 response.statusCode = 200; response.setHeader = (name,value) => headers.set(name.toLowerCase(),value);
 const finished = new Promise<void>(resolve => response.once('finish',resolve));
 handler(Object.assign(new EventEmitter(),{method,url}),response);
 await finished;
 return {status:response.statusCode,text:Buffer.concat(body).toString('utf8'),headers};
}

test('newly prepared model assets are served after startup; missing files never return the app HTML', async () => {
 const root=await mkdtemp(join(tmpdir(),'model-assets-'));
 try {
  const handler=modelAssetHandler(root);
  assert.equal((await request(handler,'GET','/model-derived/native/full/manifest.json')).status,404);
  await mkdir(join(root,'public/benchmark-assets/model-derived/native/full'),{recursive:true});
  await writeFile(join(root,'public/benchmark-assets/model-derived/native/full/manifest.json'),'{}');
  const response=await request(handler,'GET','/model-derived/native/full/manifest.json');assert.equal(response.status,200);assert.equal(response.text,'{}');assert.match(String(response.headers.get('content-type')),/json/);
  assert.equal((await request(handler,'HEAD','/model-derived/native/full/manifest.json')).status,200);
  assert.equal((await request(handler,'GET','/model-derived/%2e%2e%2fsecret.json')).status,403);
 } finally {await rm(root,{recursive:true,force:true});}
});
