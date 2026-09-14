import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {runLightingComparison} from '../16-lighting-transport/runner/index.ts';
import {createLightingArchivePlugin} from '../16-lighting-transport/assets/archive.ts';
import type {LightingArchiveHistory} from '../16-lighting-transport/contracts.ts';

test('comparison archives preparation failure and cancellation before a renderer exists',async()=>{
  for(const scenario of ['failure','stop'] as const){
    const root=await mkdtemp(join(tmpdir(),'lighting-initialization-'));
    let started=()=>{};
    const preparationStarted=new Promise<void>(resolve=>{started=resolve;});
    const server=await createServer({root,configFile:false,optimizeDeps:{noDiscovery:true,include:[]},
      plugins:[createLightingArchivePlugin(),{name:'unavailable-preparation',configureServer(server){
        server.middlewares.use('/api/lighting-prepare',(_request,response)=>{
          started();
          if(scenario==='failure'){response.statusCode=503;response.end('Compilateur indisponible.');}
        });
      }}],server:{host:'127.0.0.1',port:0,hmr:false,ws:false}});
    const nativeFetch=globalThis.fetch;
    try{
      await server.listen();
      const address=server.httpServer?.address();assert.ok(address&&typeof address==='object');
      const origin='http://127.0.0.1:'+address.port;
      // Only adapt browser-relative URLs; runtime preparation and HTTP archiving execute normally.
      globalThis.fetch=(input,options)=>nativeFetch(typeof input==='string'&&input.startsWith('/')?new URL(input,origin):input,options);
      const abort=new AbortController();
      const pending=runLightingComparison({} as HTMLCanvasElement,{signal:abort.signal});
      await preparationStarted;
      if(scenario==='stop')abort.abort();
      const result=await pending;
      assert.equal(result.status,scenario==='failure'?'error':'stopped');
      assert.equal(result.provenance.initialization,scenario==='failure'?'failed':'stopped');
      for(const field of ['sdkCommit','labCommit','sourceHashes','preparationMs','fixtureKey','geometry'])assert.equal(result.provenance[field],null);
      assert.equal(result.environment.renderer,null);
      assert.equal(result.quality.passed,null);
      assert.equal(result.observedRafCeilingHz,null);
      assert.deepEqual(result.blocks,[]);assert.deepEqual(result.artifacts,[]);
      const history=await(await nativeFetch(origin+'/api/lighting-report')).json() as LightingArchiveHistory;
      assert.equal(history.attempts.length,1);assert.equal(history.latestValid,null);
      assert.equal(history.attempts[0].id,result.id);assert.equal(history.attempts[0].status,result.status);
      const response=await nativeFetch(origin+'/api/lighting-report?package='+history.latestAttempt);
      assert.equal(response.status,200);
      const markdown=await response.text();
      assert.match(markdown,/Initialisation non achevée/);
      assert.match(markdown,/Non mesuré/);
      assert.match(markdown,scenario==='failure'?/Compilateur indisponible/:/Campagne arrêtée à la demande/);
      assert.match(markdown,/<!-- report-package:16-lighting-transport\/campaign-/);
    }finally{globalThis.fetch=nativeFetch;await server.close();await rm(root,{recursive:true,force:true});}
  }
});
