import test from 'node:test';
import assert from 'node:assert/strict';
import { checkModelAvailability, defaultModelId } from '../src/lab/modelAvailability.ts';
const json = (value: unknown) => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
test('availability reads only pointer and metadata, without loading scene assets', async () => {
 const urls:string[]=[];
 const fetcher=(async (url: string) => { urls.push(url);return json(url.endsWith('manifest.json') ? {status:'ready',scope:'full',url:'key/clusters.json'} : {status:'ready',scope:'full',schema:1,primitives:[],selectedNodes:[],selectedTriangles:10046405,simplification:true,errorModel:'qem-local-plus-child-max'}); }) as typeof fetch;
 assert.equal(await checkModelAvailability(defaultModelId(),fetcher),10046405);
 assert.equal(urls.length,2);assert.ok(urls.every(url=>url.endsWith('.json')));
});
test('missing cache gives an actionable failure without claiming preparation is active', async()=> {
 await assert.rejects(checkModelAvailability(defaultModelId(),(async()=>new Response('{}',{status:404})) as typeof fetch),/HTTP 404.*Préparez/);
});
test('HTML and invalid metadata are rejected', async()=>{
 await assert.rejects(checkModelAvailability(defaultModelId(),(async()=>new Response('<html>')) as typeof fetch),/JSON/);
 await assert.rejects(checkModelAvailability(defaultModelId(),(async()=>json({status:'ready',scope:'full',url:'key/clusters.json'})) as typeof fetch),/Cache de modèle invalide/);
 await assert.rejects(checkModelAvailability(defaultModelId(),(async(url:string)=>json(String(url).endsWith('manifest.json')?{status:'ready',scope:'full',url:'key/clusters.json'}:{status:'ready',scope:'full',schema:1,primitives:[],selectedNodes:[],selectedTriangles:1,simplification:false})) as typeof fetch),/pages QEM/);
 await assert.rejects(checkModelAvailability(defaultModelId(),(async(url:string)=>json(String(url).endsWith('manifest.json')?{status:'ready',scope:'full',url:'key/clusters.json'}:{status:'ready',scope:'full',schema:1,primitives:[],selectedNodes:[],selectedTriangles:1,simplification:true})) as typeof fetch),/obsolète/);
});
