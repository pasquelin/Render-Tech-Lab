import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {archiveIntegration} from '../../shared/archive/integration.ts';
test('UI archive retains partial errors in a unique file and writes the common report',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cluster-archive-'));
 try{await mkdir(join(root,'15-virtualized-integration','implementation'),{recursive:true}); await mkdir(join(root,'15-virtualized-integration','runner')); 
  for(const name of ['geometryAsset.ts','physicalPages.ts','clusterGpu.ts','virtualizedCampaign.ts','runner.ts'])await writeFile(join(root,'15-virtualized-integration',name === 'runner.ts' ? 'runner/index.ts' : `implementation/${name}`),'// source fixture');
  const result={test:'15-virtualized-integration',status:'not-run',archive:{errors:['cancelled'],virtualized:{scenarios:[{status:'not-run',blocks:[{raw:[{gpuMs:null}]}]}]}}};
  const a=await archiveIntegration(root,result),b=await archiveIntegration(root,result);assert.notEqual(a.id,b.id);
  const saved=JSON.parse(await readFile(join(root,a.artifact),'utf8'));assert.deepEqual(saved.result,result);assert.ok(saved.sources['clusterGpu.ts'].sha256);
  assert.match(await readFile(join(root,'reports','15-virtualized-integration.md'),'utf8'),/cancelled/);
  await assert.rejects(archiveIntegration(root,{test:'../escape',archive:{}}),/Invalid/);
 }finally{await rm(root,{recursive:true,force:true});}
});
