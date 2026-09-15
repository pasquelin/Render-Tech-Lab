import test from 'node:test';
import assert from 'node:assert/strict';
import { checkModelAvailability, defaultModelId } from '../src/lab/modelAvailability.ts';
import { FORMAT_VERSION, CLUSTERED_BLEND_FORMAT_VERSION } from '@web-geometry/sdk';
const json = (value: unknown) => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
test('availability reads only pointer and metadata, without loading scene assets', async () => {
 const urls:string[]=[];
 const fetcher=(async (url: string) => { urls.push(url);return json(url.endsWith('manifest.json') ? {status:'ready',scope:'full',url:'key/clusters.json'} : {status:'ready',scope:'full',schema:FORMAT_VERSION,primitives:[],selectedNodes:[],selectedTriangles:10046405}); }) as typeof fetch;
 assert.equal(await checkModelAvailability(defaultModelId(),fetcher),10046405);
 assert.equal(urls.length,2);assert.ok(urls.every(url=>url.endsWith('.json')));
});
test('missing cache gives an actionable failure without claiming preparation is active', async()=> {
 await assert.rejects(checkModelAvailability(defaultModelId(),(async()=>new Response('{}',{status:404})) as typeof fetch),/HTTP 404.*Préparez/);
});
test('caches at the current clustered-blend format are available', async()=> {
 const fetcher=(async(url:string)=>json(String(url).endsWith('manifest.json')
  ?{status:'ready',scope:'full',formatVersion:CLUSTERED_BLEND_FORMAT_VERSION,url:'key/clusters.json'}
  :{status:'ready',scope:'full',schema:CLUSTERED_BLEND_FORMAT_VERSION,formatVersion:CLUSTERED_BLEND_FORMAT_VERSION,primitives:[{pass:'clustered-blend'}],selectedNodes:[0],selectedTriangles:1})) as typeof fetch;
 assert.equal(await checkModelAvailability(defaultModelId(),fetcher),1);
});
// Le verdict sur le cache vient du SDK : le Lab n'en teste que la remontée, par code d'erreur.
const rejects=(fetcher:typeof fetch,code:string)=>assert.rejects(checkModelAvailability(defaultModelId(),fetcher),(error:{code?:string})=>error.code===code);
const cache=(metadata:unknown)=>(async(url:string)=>json(String(url).endsWith('manifest.json')?{status:'ready',scope:'full',url:'key/clusters.json'}:metadata)) as typeof fetch;
test('HTML and invalid metadata are rejected', async()=>{
 await assert.rejects(checkModelAvailability(defaultModelId(),(async()=>new Response('<html>')) as typeof fetch),/JSON/);
 await rejects((async()=>json({status:'ready',scope:'full',url:'key/clusters.json'})) as typeof fetch,'INVALID_CACHE');
 await rejects(cache({status:'ready',scope:'slice',schema:FORMAT_VERSION,primitives:[],selectedNodes:[],selectedTriangles:1}),'SCOPE_MISMATCH');
 // Le format 1 a été retiré par le moteur : un cache qui le porte encore est refusé, message à l'appui.
 await assert.rejects(
  checkModelAvailability(defaultModelId(),cache({status:'ready',scope:'full',schema:1,primitives:[],selectedNodes:[],selectedTriangles:1})),
  new RegExp(`format ${FORMAT_VERSION} or ${CLUSTERED_BLEND_FORMAT_VERSION}.*received 1`),
 );
 await rejects(cache({status:'ready',scope:'full',schema:FORMAT_VERSION,primitives:[],selectedNodes:[],selectedTriangles:1,clusterStrategy:'dag-groups',errorModel:'qem-local-plus-child-max'}),'STALE_CACHE');
});
