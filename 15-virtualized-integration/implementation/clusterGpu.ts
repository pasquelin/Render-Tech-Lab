import * as THREE from 'three';
import { TimestampBatch } from '../../shared/gpu/timing.ts';
import { active, bounded } from '../scenarios/protocol.ts';
import { type ClusterAsset } from './geometryAsset.ts';
import { PhysicalPages } from './physicalPages.ts';

const COMMON = /* wgsl */ `
struct View { matrix: mat4x4f, params: vec4f, planes: array<vec4f,6> }
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage,read> regions: array<vec4f>;
@group(0) @binding(2) var<storage,read> residency: array<vec2u>;
`;
const SELECT = COMMON + /* wgsl */ `
struct Args { vertices:u32, count:atomic<u32>, first:u32, base:u32 }
@group(0) @binding(3) var<storage,read_write> selected: array<vec4u>;
@group(0) @binding(4) var<storage,read_write> args: Args;
@group(0) @binding(5) var<storage,read_write> feedback: array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid:vec3u) {
 let id=gid.x; if(id>=u32(view.params.w)){return;}
 let r=regions[id]; let center=vec3f(r.xy,r.z*0.5); let radius=sqrt(0.5+r.z*r.z*0.25);
 var visible=true; for(var p=0u;p<6u;p++){if(dot(view.planes[p],vec4f(center,1.0)) < -radius){visible=false;}}
 let nearZ=view.params.x-r.z; let transverse=abs(r.xy)+vec2f(0.5);
 var error=3.4e38; if(nearZ>0.1){error=r.w*view.params.y/nearZ*sqrt(1.0+dot(transverse,transverse)/(nearZ*nearZ))*1.00001;}
 let wants=error>view.params.z;
 feedback[id]=select(0u,1u,visible && wants);
 if(!visible){return;}
 let fine=wants && residency[id].y!=0xffffffffu;
 let slot=select(residency[id].x,residency[id].y,fine);
 let index=atomicAdd(&args.count,1u);
 // At most one cluster per region; output capacity equals number of regions.
 selected[index]=vec4u(slot,select(2u,4u,fine),id,select(0u,1u,wants && !fine));
}
`;
const RASTER = COMMON + /* wgsl */ `
override direct:bool=false;
@group(0) @binding(3) var<storage,read> selected:array<vec4u>;
@group(0) @binding(4) var<storage,read> vertices:array<vec4f>;
struct Out { @builtin(position) position:vec4f, @location(0) @interpolate(flat) id:u32 }
@vertex fn vs(@builtin(vertex_index) v:u32,@builtin(instance_index) instance:u32)->Out{
 var slot=instance; var id=instance; if(!direct){slot=selected[instance].x;id=selected[instance].z;}
 var o:Out; o.position=view.matrix*vertices[slot*12u+v]; o.id=id; return o;
}
@fragment fn fs(i:Out)->@location(0) vec4f{
 return vec4f(f32(50u+(i.id*37u)%180u)/255.0,f32(50u+(i.id*53u)%180u)/255.0,f32(50u+(i.id*71u)%180u)/255.0,1.0);
}
`;

export class ClusterGpu {
  readonly pool: PhysicalPages;
  readonly canvasContext: GPUCanvasContext;
  readonly resources: Array<GPUBuffer | GPUTexture> = [];
  private uniforms!: GPUBuffer; private regions!: GPUBuffer; private table!: GPUBuffer;
  private selected!: GPUBuffer; private args!: GPUBuffer; private feedback!: GPUBuffer; private source!: GPUBuffer;
  private color!: GPUTexture; private depth!: GPUTexture;
  private compute!: GPUComputePipeline; private computeGroup!: GPUBindGroup;
  private pipelines!: Record<'A'|'B',GPURenderPipeline>; private groups!: Record<'A'|'B',GPUBindGroup>;
  readonly camera: THREE.PerspectiveCamera;
  readonly device: GPUDevice; readonly canvas: HTMLCanvasElement; readonly asset: ClusterAsset; readonly width: number; readonly height: number;
  constructor(device: GPUDevice, canvas: HTMLCanvasElement, asset: ClusterAsset,
    capacity: number, width: number, height: number) {
    this.device=device;this.canvas=canvas;this.asset=asset;this.width=width;this.height=height;
    const context=canvas.getContext('webgpu'); if(!context)throw new Error('WebGPU canvas absent'); this.canvasContext=context;
    this.pool=new PhysicalPages(device,asset,capacity);
    this.camera=new THREE.PerspectiveCamera(60,width/height,.1,100); this.camera.coordinateSystem=THREE.WebGPUCoordinateSystem;this.camera.updateProjectionMatrix();
    try { this.initialize(); } catch(error){this.dispose();throw error;}
  }
  private buffer(size:number,usage:number,data?:ArrayBufferView){const b=this.device.createBuffer({size,usage});this.resources.push(b);
    if(data)this.device.queue.writeBuffer(b,0,data as unknown as BufferSource);return b;}
  private initialize(){
    const d=this.device,n=this.asset.regions.length;
    this.canvas.width=this.width;this.canvas.height=this.height;
    this.canvasContext.configure({device:d,format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
    const storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST;
    this.uniforms=this.buffer(176,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
    this.regions=this.buffer(n*16,storage,new Float32Array(this.asset.regions.flatMap(r=>[r.x,r.y,r.height,r.error])));
    this.table=this.buffer(n*8,storage);
    this.selected=this.buffer(n*16,storage|GPUBufferUsage.COPY_SRC);
    this.args=this.buffer(16,storage|GPUBufferUsage.INDIRECT|GPUBufferUsage.COPY_SRC);
    this.feedback=this.buffer(n*4,storage|GPUBufferUsage.COPY_SRC);
    this.source=this.buffer(this.asset.source.byteLength,storage,this.asset.source);
    this.color=d.createTexture({size:[this.width,this.height],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});this.resources.push(this.color);
    this.depth=d.createTexture({size:[this.width,this.height],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});this.resources.push(this.depth);
    this.compute=d.createComputePipeline({layout:'auto',compute:{module:d.createShaderModule({code:SELECT}),entryPoint:'main'}});
    this.computeGroup=d.createBindGroup({layout:this.compute.getBindGroupLayout(0),entries:[this.uniforms,this.regions,this.table,this.selected,this.args,this.feedback].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const module=d.createShaderModule({code:RASTER});this.pipelines={} as typeof this.pipelines;this.groups={} as typeof this.groups;
    for(const mode of ['A','B'] as const){
      const pipeline=d.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs',constants:{direct:mode==='A'?1:0}},fragment:{module,entryPoint:'fs',targets:[{format:'rgba8unorm'}]},
        primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
      this.pipelines[mode]=pipeline;
      const entries=[{binding:0,resource:{buffer:this.uniforms}},{binding:4,resource:{buffer:mode==='A'?this.source:this.pool.buffer}}];
      // Both entry points statically reference the selection storage binding.
      entries.push({binding:3,resource:{buffer:this.selected}});
      this.groups[mode]=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries});
    }
  }
  update(eyeZ:number,threshold:number){
    this.camera.position.set(0,0,eyeZ);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    const matrix=new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);
    const planes=new THREE.Frustum().setFromProjectionMatrix(matrix,THREE.WebGPUCoordinateSystem).planes;
    const data=new Float32Array(44);matrix.toArray(data);data.set([eyeZ,this.height/(2*Math.tan(Math.PI/6)),threshold,this.asset.regions.length],16);
    planes.forEach((p,i)=>data.set([p.normal.x,p.normal.y,p.normal.z,p.constant],20+i*4));
    this.device.queue.writeBuffer(this.uniforms,0,data);this.device.queue.writeBuffer(this.table,0,this.pool.table());
  }
  render(mode:'A'|'B',timer?:TimestampBatch){
    const start=performance.now(),d=this.device;
    d.queue.writeBuffer(this.args,0,new Uint32Array([12,0,0,0]));
    const encoder=d.createCommandEncoder();
    if(mode==='B'){const pass=encoder.beginComputePass({timestampWrites:timer?.writes(0,0)});pass.setPipeline(this.compute);pass.setBindGroup(0,this.computeGroup);pass.dispatchWorkgroups(Math.ceil(this.asset.regions.length/64));pass.end();}
    const pass=encoder.beginRenderPass({colorAttachments:[{view:this.color.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}],
      depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'},timestampWrites:timer?.writes(0,mode==='A'?0:1)});
    pass.setPipeline(this.pipelines[mode]);pass.setBindGroup(0,this.groups[mode]);
    if(mode==='A')for(let i=0;i<this.asset.regions.length;i++)pass.draw(12,1,0,i);else pass.drawIndirect(this.args,0);
    pass.end();encoder.copyTextureToTexture({texture:this.color},{texture:this.canvasContext.getCurrentTexture()},[this.width,this.height]);
    timer?.resolve(encoder);d.queue.submit([encoder.finish()]);timer?.submitted();
    return {submitMs:performance.now()-start,drawCalls:mode==='A'?this.asset.regions.length:1};
  }
  private async read(size:number,encode:(e:GPUCommandEncoder,b:GPUBuffer)=>void,signal:AbortSignal){
    active(signal);const d=this.device,b=d.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    const abort=()=>b.destroy();signal.addEventListener('abort',abort,{once:true});
    try {const e=d.createCommandEncoder();encode(e,b);d.queue.submit([e.finish()]);await bounded(b.mapAsync(GPUMapMode.READ),signal);return new Uint8Array(b.getMappedRange()).slice();}
    finally{signal.removeEventListener('abort',abort);if(b.mapState==='mapped')b.unmap();b.destroy();}
  }
  async readSelection(signal:AbortSignal){
    const n=this.asset.regions.length;
    const bytes=await this.read(16+n*20,(e,b)=>{e.copyBufferToBuffer(this.args,0,b,0,16);e.copyBufferToBuffer(this.selected,0,b,16,n*16);e.copyBufferToBuffer(this.feedback,0,b,16+n*16,n*4);},signal);
    const u=new Uint32Array(bytes.buffer);if(u[1]>n)throw new Error('Cluster output overflow');
    return {clusters:Array.from({length:u[1]},(_,i)=>Array.from(u.slice(4+i*4,8+i*4))),requests:Array.from(u.slice(4+n*4)).flatMap((v,i)=>v?[n+i]:[])};
  }
  async capture(signal:AbortSignal,depth=false){
    const row=Math.ceil(this.width*4/256)*256;
    const bytes=await this.read(row*this.height,(e,b)=>e.copyTextureToBuffer({texture:depth?this.depth:this.color,aspect:depth?'depth-only':'all'},{buffer:b,bytesPerRow:row},[this.width,this.height]),signal);
    const out=new Uint8Array(this.width*this.height*4);for(let y=0;y<this.height;y++)out.set(bytes.subarray(y*row,y*row+this.width*4),y*this.width*4);return out;
  }
  dispose(){this.pool.dispose();for(const r of this.resources)r.destroy();this.resources.length=0;this.canvasContext.unconfigure();}
}
