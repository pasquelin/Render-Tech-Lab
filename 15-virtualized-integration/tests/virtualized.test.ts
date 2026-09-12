import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClusterAsset, PAGE_BYTES, regionErrorPx, selectRegion } from '../implementation/geometryAsset.ts';
import { PhysicalPages } from '../implementation/physicalPages.ts';

test('dyadic tent hierarchy preserves boundaries and bounds both surfaces',()=>{
 const a=buildClusterAsset(2),b=buildClusterAsset(2);assert.deepEqual(a,b);
 for(const region of a.regions){
  const fine=new Float32Array(a.pages[region.finePage].buffer),root=new Float32Array(a.pages[region.rootPage].buffer);
  assert.equal(root.byteLength,PAGE_BYTES);
  for(let i=0;i<12;i++){assert.ok(fine[i*4+2]>=0&&fine[i*4+2]<=region.error);assert.equal(root[i*4+2],0);}
  for(let x=-.5;x<=.5;x+=1/32)for(let y=-.5;y<=.5;y+=1/32){const height=region.height*(1-2*Math.max(Math.abs(x),Math.abs(y)));assert.ok(height>=0&&height<=region.error);}
 }
 assert.throws(()=>buildClusterAsset(2,.03));
});
test('selection threshold equality, near plane and missing fine page keep one complete representation',()=>{
 const r=buildClusterAsset(1).regions[0],error=regionErrorPx(r,8,300);
 assert.equal(selectRegion(r,8,300,error,true).page,r.rootPage);
 assert.equal(selectRegion(r,8,300,error/2,true).page,r.finePage);
 assert.equal(selectRegion(r,8,300,0,false).fallback,true);
 assert.equal(selectRegion(r,.1,300,0,true).page,r.finePage);
 assert.equal(regionErrorPx(r,.1,300),Infinity);
});
test('projected certificate bounds corresponding fine/coarse points off axis',()=>{
 for(const r of buildClusterAsset(8).regions)for(const z of [2,4,20]){
  const bound=regionErrorPx(r,z,300);
  for(let x=-.5;x<=.5;x+=1/16)for(let y=-.5;y<=.5;y+=1/16){const h=r.height*(1-2*Math.max(Math.abs(x),Math.abs(y)));
   const delta=300*Math.hypot((r.x+x)/(z-h)-(r.x+x)/z,(r.y+y)/(z-h)-(r.y+y)/z);assert.ok(delta<=bound);
  }
 }
});
test('physical pool publishes after upload fence, evicts only unpinned pages, and counts actual byte copies',async()=>{
 const g=globalThis as unknown as Record<string,unknown>,old=g.GPUBufferUsage;g.GPUBufferUsage={STORAGE:1,COPY_DST:2};
 const log:string[]=[],asset=buildClusterAsset(2),signal=new AbortController().signal;
 const device={createBuffer:()=>({destroy(){log.push('destroy');}}),queue:{writeBuffer(_b:unknown,offset:number,data:Uint8Array){log.push(`write:${offset}:${data.byteLength}`);},async onSubmittedWorkDone(){log.push('fence');}}} as unknown as GPUDevice;
 try{const pool=new PhysicalPages(device,asset,5);await pool.request([0,1,2,3],signal);await pool.request([4],signal);await pool.request([5],signal);
 assert.equal(pool.stats.evictions,1);assert.ok(!pool.slots.has(4));assert.ok(pool.slots.has(5));for(let i=0;i<4;i++)assert.ok(pool.slots.has(i));
 assert.equal(pool.stats.bytesRead,6*PAGE_BYTES);assert.equal(pool.stats.uploadedBytes,6*PAGE_BYTES);
 assert.equal(pool.table()[1],0xffffffff);assert.equal(pool.table()[3],4);
 assert.ok(log.every((entry,i)=>!entry.startsWith('write')||log[i+1]==='fence'));
 const before=pool.stats.uploadedBytes;await pool.request([5],signal);assert.equal(pool.stats.uploadedBytes,before);assert.equal(pool.stats.hits,1);
 pool.dispose();assert.equal(pool.slots.size,0);assert.equal(log.at(-1),'destroy');
 }finally{g.GPUBufferUsage=old;}
});

test('page read failure and cancellation cannot publish stale GPU residency',async()=>{
 const g=globalThis as unknown as Record<string,unknown>,old=g.GPUBufferUsage;g.GPUBufferUsage={STORAGE:1,COPY_DST:2};
 let writes=0;const device={createBuffer:()=>({destroy(){}}),queue:{writeBuffer(){writes++;},async onSubmittedWorkDone(){}}} as unknown as GPUDevice;
 try{
  const bad=new PhysicalPages(device,buildClusterAsset(1),1,{async read(){return new Uint8Array(1);}});
  await assert.rejects(bad.request([0],new AbortController().signal),/integrity/);assert.equal(bad.slots.size,0);assert.equal(writes,0);bad.dispose();
  let started:()=>void=()=>{};const reading=new Promise<void>(resolve=>started=resolve);
  const pool=new PhysicalPages(device,buildClusterAsset(1),1,{async read(){started();return new Promise(()=>{});}});
  const pending=pool.request([0],new AbortController().signal);await reading;pool.dispose();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(pool.slots.size,0);assert.equal(writes,0);
 }finally{g.GPUBufferUsage=old;}
});
