import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldMatrix, worldMatrixTotals } from './worldMatrix.ts';
import type { WorldOptions } from './worldTypes.ts';
const base: WorldOptions = { width:1920,height:1080,pixelRatio:1,districts:9,samples:120,warmup:30,shadows:true,candidate:'frustum',fov:60,antialias:false,shadowMapSize:2048,path:'mixed' };
test('single configuration preserves all explicit settings and repetitions are independent',()=>{
  const runs=createWorldMatrix(base,2,{});
  assert.equal(runs.length,2);assert.deepEqual(runs[0],base);assert.notEqual(runs[0],runs[1]);
  assert.deepEqual(worldMatrixTotals(runs),{campaigns:2,measuredFrames:960,warmupFrames:240,controlFrames:18,totalFrames:1218});
  assert.deepEqual(base,{...runs[0]});
});
test('main matrix crosses every selected dimension and keeps advanced settings fixed',()=>{
  const runs=createWorldMatrix(base,2,{districts:true,resolutions:true,shadows:true,methods:true});
  assert.equal(runs.length,72);
  assert.equal(new Set(runs.map(r=>JSON.stringify(r))).size,36);
  assert.ok(runs.every(r=>r.fov===60&&r.antialias===false&&r.path==='mixed'&&r.shadowMapSize===2048));
});
test('full matrix includes retina and advanced axes without repeating irrelevant shadow sizes',()=>{
  const runs=createWorldMatrix(base,1,{districts:true,resolutions:true,retina:true,shadows:true,methods:true,fov:true,antialias:true,path:true,shadowMapSize:true});
  assert.equal(runs.length,1728);
  assert.equal(new Set(runs.map(r=>JSON.stringify(r))).size,runs.length);
  assert.ok(runs.filter(r=>!r.shadows).every(r=>r.shadowMapSize===2048));
  assert.deepEqual(new Set(runs.map(r=>r.fov)),new Set([45,60,90]));
  assert.deepEqual(new Set(runs.map(r=>r.path)),new Set(['mixed','panorama','perimeter']));
});
test('retina is not duplicated and invalid repetitions are refused',()=>{
  assert.equal(createWorldMatrix({...base,pixelRatio:2},1,{retina:true}).length,1);
  for(const n of [0,4,1.5,NaN]) assert.throws(()=>createWorldMatrix(base,n,{}));
});
