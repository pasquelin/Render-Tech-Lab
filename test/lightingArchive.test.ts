import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {createLightingArchivePlugin,createLightingArchiveStore} from '../16-lighting-transport/assets/archive.ts';
import {LIGHTING_PROTOCOL,type LightingReport,type LightingArchiveHistory} from '../16-lighting-transport/index.ts';
import {campaignSummary} from '../src/lab/campaignSummary.ts';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHqkAAAAASUVORK5CYII=';
function report(status:LightingReport['status']='measured'):LightingReport{
  const frame={variant:'bvh' as const,cpuTransportMs:0,cpuSubmitMs:.4,cpuFrameMs:.6,gpuMs:2,rafDeltaMs:null,fps:null,drawCalls:96,triangles:4158,raysReused:0,totalRays:72192,bvhRefitMs:.01,bvhNodeCount:189,bvhNodeBytes:6048};
  return {formatVersion:1,id:randomUUID(),timestamp:new Date().toISOString(),status,protocol:LIGHTING_PROTOCOL,
    config:{variant:'brute',lights:[],doorAngle:0,roughness:.25,cameraT:0,lightIntensity:1},
    environment:{renderer:'fixture'},provenance:{sourceArchive:'benchmark-runs/local-sources',sourceHashes:{'renderer.ts':'abc'}},
    quality:{passed:status==='measured'?true:status==='rejected'?false:null,captures:[]},
    blocks:[{variant:'bvh',kind:'cadence',frames:[{...frame,gpuMs:999}]},{variant:'bvh',kind:'gpu-isolated',frames:[frame]}],
    artifacts:[{scenario:'open',variant:'bvh',dataUrl:png}],limitations:['Fixture de test ; aucune mesure physique.']};
}

test('lighting archives keep the last valid package beyond five failed attempts and retain its honest dashboard measures',async()=>{
  const root=await mkdtemp(join(tmpdir(),'lighting-archives-'));
  try{
    const store=createLightingArchiveStore(root),valid=await store.save(report());
    let last=valid;
    for(let i=0;i<6;i++)last=await store.save(report(i%2?'stopped':'rejected'));
    const reloaded=await createLightingArchiveStore(root).history();
    assert.equal(reloaded.latestValid,valid.entry.package);
    assert.equal(reloaded.latestAttempt,last.entry.package);
    assert.equal(reloaded.attempts.length,6,'five attempts plus the older valid result');
    assert.equal((await readdir(join(root,'reports/16-lighting-transport'))).filter(name=>name.startsWith('campaign-')).length,6);
    assert.equal(JSON.parse(await readFile(join(root,'reports/16-lighting-transport/latest.json'),'utf8')).reportPackage,valid.entry.package);
    const dashboard=JSON.parse(await readFile(join(root,'16-lighting-transport/results/latest.json'),'utf8'));
    assert.deepEqual(dashboard.records,[{variant:'bvh',cpuMs:null,gpuMs:2}],'cadence and CPU values are not repurposed as isolated GPU measurements');
    assert.ok(campaignSummary(dashboard),'the Dashboard recognizes the stored measurement contract');
    const markdown=await store.read(valid.entry.package);
    assert.match(markdown,new RegExp('<!-- report-package:16-lighting-transport/'+valid.entry.package+' -->'));
    assert.match(markdown,/Données brutes compressées/);
    assert.match(markdown,/!\[[^\]]*\]\(\.\/media\/[^)]+\.png\)/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('lighting HTTP history is compact and reopens the actual first error package without exposing raw sources',async()=>{
  const root=await mkdtemp(join(tmpdir(),'lighting-history-http-'));
  const server=await createServer({root,configFile:false,plugins:[createLightingArchivePlugin()],optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0,hmr:false,ws:false}});
  try{
    await server.listen();
    const address=server.httpServer?.address();
    assert.ok(address&&typeof address==='object');
    const base='http://127.0.0.1:'+address.port+'/api/lighting-report';
    assert.deepEqual(await(await fetch(base)).json(),{formatVersion:1,latestAttempt:null,latestValid:null,attempts:[]});
    const failed=report('error');failed.blocks=[];failed.provenance={};failed.limitations=['Compilation initiale échouée.'];
    const saved=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(failed)});
    assert.equal(saved.status,200);
    const metadata=await(await fetch(base)).json() as LightingArchiveHistory;
    assert.equal(metadata.latestValid,null);
    assert.equal(metadata.attempts[0].status,'error');
    assert.doesNotMatch(JSON.stringify(metadata),/base64|sourceArchive|sourceHashes|blocks|artifacts/);
    const markdown=await(await fetch(base+'?package='+metadata.latestAttempt)).text();
    assert.match(markdown,/Compilation initiale échouée/);
    assert.match(markdown,/<!-- report-package:16-lighting-transport\/campaign-/);
    assert.equal((await fetch(base+'?package='+metadata.latestAttempt+'&format=sources')).status,400);
    await assert.rejects(readFile(join(root,'16-lighting-transport/results/latest.json')),{code:'ENOENT'});
  }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
