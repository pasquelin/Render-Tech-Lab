import * as THREE from 'three';
import { getSharedDevice, getAdapterInfo, configureCanvas } from '../../src/common/gpuContext.ts';
import { createSeededRandom } from '../../shared/scene/random.ts';
import type { TimestampBatch } from '../../shared/gpu/timing.ts';
import { selectLodsOnCpu } from './cpuLodSelector.ts';
import { GPU_LOD_SELECTION_SHADER } from './gpuLodShader.ts';
import { NATIVE_LOD_LOCAL_RANK, NATIVE_LOD_COMPACTION, NATIVE_LOD_RASTER } from './nativeLodShaders.ts';

export interface NativeLodConfig { count:number; width:number; height:number; samples:number; seed:number }
export interface NativeLodMeasurement {
  cpuSelectMs:number|null; cpuSubmitMs:number; cpuFrameMs:number;
  triangles:number|null; lodCounts:number[]|null;
}
export interface NativeLodControl {
  frameIndex:number; passed:boolean; failure?:string;
  selectionMismatches:number; compactedIdentityMismatches:number; compactedOrderMismatches:number; commandMismatches:number;
  referenceSelectionHash:string; gpuSelectionHash:string;
  referenceCounts:number[]; gpuCounts:number[]; indirectCounts:number[];
  referenceTriangles:number; gpuTriangles:number;
  captures:{ referenceHash:string; repeatHash:string; gpuHash:string;
    aaDifferentPixels:number; abDifferentPixels:number; aaMaxChannelError:number; abMaxChannelError:number;
    nonBackgroundPixels:number[]; width:number; height:number; target:string };
}
type ReadState = { selections:Uint8Array; commands:Uint32Array; ids:Uint32Array[]; counters:Uint32Array };
const BACKGROUND = [16,24,35,255];
async function hash(bytes:ArrayBufferView):Promise<string> {
  const copy=new Uint8Array(bytes.byteLength);
  copy.set(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',copy)),v=>v.toString(16).padStart(2,'0')).join('');
}
function compare(a:Uint8Array,b:Uint8Array):{differentPixels:number;maxChannelError:number} {
  let differentPixels=0,maxChannelError=0;
  for(let i=0;i<a.length;i+=4){let different=false;for(let c=0;c<4;c++){
    const delta=Math.abs(a[i+c]-b[i+c]);if(delta)different=true;maxChannelError=Math.max(maxChannelError,delta);
  }if(different)differentPixels++;}
  return {differentPixels,maxChannelError};
}
function nonBackground(bytes:Uint8Array):number {
  let count=0;for(let i=0;i<bytes.length;i+=4)if(BACKGROUND.some((value,c)=>bytes[i+c]!==value))count++;
  return count;
}

/** Native WebGPU diagnostic; Three is used only for CPU geometry and camera mathematics. */
export class NativeLodRenderer {
  readonly sceneInfo:Record<string,unknown>={};
  readonly environment:Record<string,unknown>={};
  readonly device:GPUDevice;
  private readonly config:NativeLodConfig;
  private readonly context:GPUCanvasContext;
  private readonly format:GPUTextureFormat;
  private readonly camera:THREE.PerspectiveCamera;
  private readonly viewProjection=new THREE.Matrix4();
  private readonly positions:Float32Array;
  private readonly radii:Float32Array;
  private readonly matrices:Float32Array;
  private readonly cameraPosition:[number,number,number]=[0,0,0];
  private readonly cameraWords=new Float32Array(8);
  private readonly rasterWords=new Float32Array(16);
  private readonly indirectWords=new Uint32Array(15);
  private readonly zeroCounters=new Uint32Array(4);
  private readonly cpuIds:Uint32Array[];
  private readonly triangleCounts:number[]=[];
  private readonly resources:Array<GPUBuffer|GPUTexture>=[];
  private readonly geometry:Array<{vertex:GPUBuffer;normal:GPUBuffer;index:GPUBuffer}>=[];
  private readonly extent:number;
  private readonly baseCamera:[number,number,number];
  private readonly fovRad:number;
  private readonly errors:string[]=[];
  private readonly uncaptured=(event:GPUUncapturedErrorEvent)=>{this.errors.push(event.error.message);};
  private deviceLost:string|null=null;
  private stopped=false;
  private checkedImage: ImageData | null = null;
  private objectBuffer!:GPUBuffer;
  private cameraBuffer!:GPUBuffer;
  private rasterCameraBuffer!:GPUBuffer;
  private selectionsBuffer!:GPUBuffer;
  private countersBuffer!:GPUBuffer;
  private drawsBuffer!:GPUBuffer;
  private idsBuffers:GPUBuffer[]=[];
  private localRanksBuffer!:GPUBuffer;
  private groupCountsBuffer!:GPUBuffer;
  private selectionPipeline!:GPUComputePipeline;
  private localRankPipeline!:GPUComputePipeline;
  private compactionPipeline!:GPUComputePipeline;
  private rasterPipeline!:GPURenderPipeline;
  private selectionGroup!:GPUBindGroup;
  private localRankGroup!:GPUBindGroup;
  private compactionGroup!:GPUBindGroup;
  private rasterGroups:GPUBindGroup[]=[];
  private depth!:GPUTexture;
  private lastTexture:GPUTexture|null=null;
  private lastCpuSelection:Uint8Array=new Uint8Array(0);

  private constructor(device:GPUDevice,canvas:HTMLCanvasElement,config:NativeLodConfig) {
    this.device=device;this.config={...config};
    canvas.width=config.width;canvas.height=config.height;
    const {context,format}=configureCanvas(canvas,device);this.context=context;this.format=format;
    // COPY_SRC is needed to check the exact image sent to the canvas, outside timing.
    context.configure({device,format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    this.positions=new Float32Array(config.count*3);this.radii=new Float32Array(config.count);
    this.matrices=new Float32Array(config.count*16);this.cpuIds=Array.from({length:3},()=>new Uint32Array(config.count));
    const columns=Math.ceil(Math.sqrt(config.count*1.5)),rows=Math.ceil(config.count/columns);
    this.extent=Math.max(columns,rows)*3.1;
    this.baseCamera=[0,Math.max(35,this.extent*.8),Math.max(50,this.extent*1.1)];
    // Both selectors receive the same f32 camera and the same representable tangent.
    this.cameraWords[5]=Math.fround(Math.tan(Math.PI/6));
    this.fovRad=2*Math.atan(this.cameraWords[5]);
    this.camera=new THREE.PerspectiveCamera(this.fovRad*180/Math.PI,config.width/config.height,.1,Math.max(2000,this.extent*8));
    this.camera.coordinateSystem=THREE.WebGPUCoordinateSystem;this.camera.updateProjectionMatrix();
    device.addEventListener('uncapturederror',this.uncaptured);
    const owner=new WeakRef(this);void device.lost.then(info=>{const renderer=owner.deref();if(renderer)renderer.deviceLost=info.message||info.reason;});
  }

  static async create(canvas:HTMLCanvasElement,config:NativeLodConfig):Promise<NativeLodRenderer> {
    if(!Number.isInteger(config.count)||config.count<1||config.count>100000)throw new Error('Native LOD: count must be 1–100000.');
    if(![config.width,config.height,config.samples].every(v=>Number.isSafeInteger(v)&&v>0)||!Number.isFinite(config.seed))throw new Error('Native LOD: invalid configuration.');
    const device=await getSharedDevice();if(!device)throw new Error('WebGPU native indisponible.');
    if(config.width>device.limits.maxTextureDimension2D||config.height>device.limits.maxTextureDimension2D)throw new Error('Native LOD: physical dimensions exceed device limits.');
    const renderer=new NativeLodRenderer(device,canvas,config);
    device.pushErrorScope('validation');let scopeOpen=true;
    try {
      await renderer.initialize();
      const validation=await device.popErrorScope();scopeOpen=false;if(validation)throw new Error(validation.message);
      renderer.check();return renderer;
    }catch(error){renderer.dispose(false);throw error;}finally{if(scopeOpen)await device.popErrorScope();}
  }

  private buffer(label:string,size:number,usage:GPUBufferUsageFlags):GPUBuffer {
    const buffer=this.device.createBuffer({label,size:Math.max(4,size),usage});this.resources.push(buffer);return buffer;
  }
  private upload(label:string,data:Float32Array|Uint32Array,usage:GPUBufferUsageFlags):GPUBuffer {
    const buffer=this.buffer(label,data.byteLength,usage|GPUBufferUsage.COPY_DST);
    this.device.queue.writeBuffer(buffer,0,data.buffer as ArrayBuffer,data.byteOffset,data.byteLength);return buffer;
  }
  private async shader(label:string,code:string):Promise<GPUShaderModule> {
    const module=this.device.createShaderModule({label,code});const info=await module.getCompilationInfo();
    const errors=info.messages.filter(message=>message.type==='error');
    if(errors.length)throw new Error(`${label}: ${errors.map(message=>`${message.lineNum}:${message.message}`).join('\n')}`);
    return module;
  }
  private async initialize():Promise<void> {
    const {count,width,height}=this.config;
    const geometries=[[192,32],[96,16],[48,8]].map(([tubular,radial])=>new THREE.TorusKnotGeometry(.72,.22,tubular,radial));
    for(const geometry of geometries)geometry.computeBoundingSphere();
    const sourceRadius=Math.max(...geometries.map(g=>g.boundingSphere!.radius+g.boundingSphere!.center.length()));
    const columns=Math.ceil(Math.sqrt(count*1.5));
    const rows=Math.ceil(count/columns),rng=createSeededRandom(this.config.seed);
    const point=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
    const direction=new THREE.Vector3().fromArray(this.baseCamera).negate().normalize(),right=new THREE.Vector3(1,0,0);
    const up=new THREE.Vector3().crossVectors(right,direction).normalize(),cameraDistance=new THREE.Vector3().fromArray(this.baseCamera).length();
    const objectWords=new Float32Array(count*24);let maxObjectCenterY=-Infinity;
    for(let i=0;i<count;i++){
      point.set(((i%columns)-(columns-1)/2)*3.1,(rng()-.5)*.45,(Math.floor(i/columns)-(rows-1)/2)*3.1);
      let objectScale=.8+rng()*.35;
      if(i<3&&count>3){const distance=cameraDistance*[.28,.4,.48][i];objectScale=[340,110,35][i]*distance*this.cameraWords[5]/(1080*sourceRadius);
        point.fromArray(this.baseCamera).addScaledVector(direction,distance).addScaledVector(right,[-.28,.02,.28][i]*distance).addScaledVector(up,distance*.12);}
      this.positions.set(point.toArray(),i*3);this.radii[i]=objectScale*sourceRadius;point.fromArray(this.positions,i*3);
      maxObjectCenterY=Math.max(maxObjectCenterY,this.positions[i*3+1]);
      scale.setScalar(objectScale);rotation.setFromEuler(new THREE.Euler(rng()*Math.PI,rng()*Math.PI,rng()*Math.PI));
      matrix.compose(point,rotation,scale);matrix.toArray(this.matrices,i*16);
      objectWords.set(this.matrices.subarray(i*16,i*16+16),i*24);
      objectWords.set([this.positions[i*3],this.positions[i*3+1],this.positions[i*3+2],this.radii[i]],i*24+16);
    }
    const minimumCameraSeparationBound=Math.fround(this.baseCamera[1]-this.extent*.01)-maxObjectCenterY;
    if(minimumCameraSeparationBound<=.0001)throw new Error('Native LOD fixture does not exclude the CPU/GPU near-camera semantic difference.');
    try {for(let i=0;i<3;i++){
      const geometry=geometries[i],indices=new Uint32Array(geometry.index!.array);
      this.triangleCounts.push(indices.length/3);this.indirectWords[i*5]=indices.length;
      this.geometry.push({vertex:this.upload(`LOD${i} positions`,new Float32Array(geometry.getAttribute('position').array),GPUBufferUsage.VERTEX),
        normal:this.upload(`LOD${i} normals`,new Float32Array(geometry.getAttribute('normal').array),GPUBufferUsage.VERTEX),
        index:this.upload(`LOD${i} indices`,indices,GPUBufferUsage.INDEX)});
    }}finally{for(const geometry of geometries)geometry.dispose();}
    this.objectBuffer=this.upload('Native LOD objects',objectWords,GPUBufferUsage.STORAGE);
    this.cameraBuffer=this.buffer('LOD selection camera',32,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
    this.rasterCameraBuffer=this.buffer('LOD raster camera',64,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
    this.selectionsBuffer=this.buffer('GPU LOD selections',count*16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);
    this.countersBuffer=this.buffer('GPU LOD counters',16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC);
    this.drawsBuffer=this.buffer('Three LOD indirect commands',60,GPUBufferUsage.STORAGE|GPUBufferUsage.INDIRECT|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC);
    this.idsBuffers=Array.from({length:3},(_,i)=>this.buffer(`LOD${i} compacted IDs`,count*4,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC));
    this.localRanksBuffer=this.buffer('Stable LOD local ranks',count*4,GPUBufferUsage.STORAGE);
    this.groupCountsBuffer=this.buffer('Stable LOD group counts',Math.ceil(count/64)*12,GPUBufferUsage.STORAGE);
    const [selectionModule,localRankModule,compactionModule,rasterModule]=await Promise.all([
      this.shader('Existing 04C selection',GPU_LOD_SELECTION_SHADER),this.shader('Stable LOD local ranks',NATIVE_LOD_LOCAL_RANK),
      this.shader('Stable LOD scatter',NATIVE_LOD_COMPACTION),this.shader('Common native LOD raster',NATIVE_LOD_RASTER)]);
    this.selectionPipeline=await this.device.createComputePipelineAsync({layout:'auto',compute:{module:selectionModule,entryPoint:'main'}});
    this.localRankPipeline=await this.device.createComputePipelineAsync({layout:'auto',compute:{module:localRankModule,entryPoint:'main'}});
    this.compactionPipeline=await this.device.createComputePipelineAsync({layout:'auto',compute:{module:compactionModule,entryPoint:'main'}});
    this.rasterPipeline=await this.device.createRenderPipelineAsync({layout:'auto',
      vertex:{module:rasterModule,entryPoint:'vs_main',buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'float32x3'}]},
        {arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:'float32x3'}]}]},
      fragment:{module:rasterModule,entryPoint:'fs_main',targets:[{format:this.format}]},
      primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    const group=(pipeline:GPUComputePipeline|GPURenderPipeline,buffers:GPUBuffer[])=>this.device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
    this.selectionGroup=group(this.selectionPipeline,[this.cameraBuffer,this.objectBuffer,this.selectionsBuffer,this.countersBuffer]);
    this.localRankGroup=group(this.localRankPipeline,[this.selectionsBuffer,this.localRanksBuffer,this.groupCountsBuffer]);
    this.compactionGroup=group(this.compactionPipeline,[this.selectionsBuffer,this.localRanksBuffer,this.groupCountsBuffer,...this.idsBuffers,this.drawsBuffer]);
    this.rasterGroups=this.idsBuffers.map(ids=>group(this.rasterPipeline,[this.rasterCameraBuffer,this.objectBuffer,ids]));
    this.depth=this.device.createTexture({size:[width,height],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});this.resources.push(this.depth);
    const info=getAdapterInfo();
    Object.assign(this.environment,{backend:'native-WebGPU',browser:navigator.userAgent,threeVersion:THREE.REVISION,
      threeUsage:'CPU geometry and camera math only; no Three renderer',adapter:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null,
      timestampQueryAvailable:this.device.features.has('timestamp-query'),features:[...this.device.features],physicalWidth:width,physicalHeight:height,
      devicePixelRatio,canvasFormat:this.format,visibility:document.visibilityState,
      raster:'Common opaque Lambert diagnostic; no PBR, textures, shadows, streaming or animation; no Bistro parity claim'});
    Object.assign(this.sceneInfo,{fixture:'native-lod-dense-torus-knot-grid-with-detailed-foreground',objects:count,seed:this.config.seed,
      sourceTrianglesAtFinestLod:count*this.triangleCounts[0],geometryTrianglesPerLod:[...this.triangleCounts],drawCalls:3,
      materials:1,lights:1,shadows:false,textures:0,fov:this.camera.fov,
      selector:'Existing CPU selectLodsOnCpu versus existing 04C GPU_LOD_SELECTION_SHADER; thresholds 250/60 physical pixels',
      selectorDomain:'Positive radii and screen height; finite camera separated from objects by more than 0.0001 world units. Existing GPU shader clamps near-zero distance while CPU returns Infinity; this fixture excludes that domain.',
      minimumCameraSeparationBound,
      pathFormula:'t=index/max(1,samples-1); zoom=1+1.5*(1-cos(2*pi*t)); camera=(sin(index*.017)*extent*.025,baseY*zoom+sin(index*.011)*extent*.01,baseZ*zoom+cos(index*.013)*extent*.015), all coordinates rounded to f32; zoom 1 to 4 to 1',
      compaction:'Stable ascending object IDs per LOD: local rank within 64-object group, prefix of group counts, scatter. No GPU-to-CPU readback during frames.',
      compactionScratchBytes:count*4+Math.ceil(count/64)*12,
      gpuPassLabels:['LOD selection','LOD local ranks and group counts','LOD stable scatter','Common native LOD raster'],cpuPassLabels:['Common native LOD raster'],
      positionHash:await hash(this.positions),radiiHash:await hash(this.radii),matricesHash:await hash(this.matrices),
      allocatedBufferBytes:this.resources.reduce((sum,r)=>sum+('size' in r?(r as GPUBuffer).size:0),0),
      depthBytesEstimate:width*height*4,depthBytesMeasured:null,fullGpuMemoryBytes:null});
    this.setPose(0);
  }

  private check():void {
    if(this.stopped)throw new Error('Native LOD renderer disposed.');
    if(this.deviceLost)throw new Error(`WebGPU device lost: ${this.deviceLost}`);
    if(this.errors.length)throw new Error(`WebGPU validation: ${this.errors.join('; ')}`);
    if(document.visibilityState!=='visible')throw new Error('Native LOD campaign interrupted: tab hidden.');
  }
  setPose(index:number):void {
    this.check();
    if(!Number.isSafeInteger(index)||index<0)throw new Error('Native LOD pose index invalid.');
    const t=index/Math.max(1,this.config.samples-1),zoom=1+1.5*(1-Math.cos(2*Math.PI*t));
    this.cameraPosition[0]=Math.fround(Math.sin(index*.017)*this.extent*.025);
    this.cameraPosition[1]=Math.fround(this.baseCamera[1]*zoom+Math.sin(index*.011)*this.extent*.01);
    this.cameraPosition[2]=Math.fround(this.baseCamera[2]*zoom+Math.cos(index*.013)*this.extent*.015);
    this.camera.position.fromArray(this.cameraPosition);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).toArray(this.rasterWords);
    this.cameraWords.set(this.cameraPosition,0);this.cameraWords[4]=this.config.height;this.cameraWords[6]=250;this.cameraWords[7]=60;
  }
  render(mode:'cpu'|'gpu',timer?:TimestampBatch,frameIndex=0):NativeLodMeasurement {
    this.check();const start=performance.now();let cpuSelectMs:number|null=null,counts:number[]|null=null;
    if(mode==='cpu'){
      const selection=selectLodsOnCpu(this.positions,this.radii,this.cameraPosition,this.config.height,this.fovRad);
      cpuSelectMs=selection.durationMs;counts=selection.lodCounts;this.lastCpuSelection=selection.selectedLods;
      const used=[0,0,0];for(let i=0;i<this.config.count;i++){const lod=selection.selectedLods[i];this.cpuIds[lod][used[lod]++]=i;}
      for(let lod=0;lod<3;lod++)this.indirectWords[lod*5+1]=used[lod];
    }else{for(let lod=0;lod<3;lod++)this.indirectWords[lod*5+1]=0;}
    const submitStart=performance.now();
    this.device.queue.writeBuffer(this.cameraBuffer,0,this.cameraWords.buffer);
    this.device.queue.writeBuffer(this.rasterCameraBuffer,0,this.rasterWords.buffer);
    this.device.queue.writeBuffer(this.drawsBuffer,0,this.indirectWords.buffer);
    this.device.queue.writeBuffer(this.countersBuffer,0,this.zeroCounters.buffer);
    if(counts)for(let lod=0;lod<3;lod++)if(counts[lod])this.device.queue.writeBuffer(this.idsBuffers[lod],0,this.cpuIds[lod].buffer as ArrayBuffer,0,counts[lod]*4);
    const encoder=this.device.createCommandEncoder({label:`Native LOD ${mode}`});
    if(mode==='gpu'){
      const workgroups=Math.ceil(this.config.count/64);
      const selection=encoder.beginComputePass({label:'LOD selection',timestampWrites:timer?.writes(frameIndex,0)});
      selection.setPipeline(this.selectionPipeline);selection.setBindGroup(0,this.selectionGroup);selection.dispatchWorkgroups(workgroups);selection.end();
      const localRank=encoder.beginComputePass({label:'LOD local ranks and group counts',timestampWrites:timer?.writes(frameIndex,1)});
      localRank.setPipeline(this.localRankPipeline);localRank.setBindGroup(0,this.localRankGroup);localRank.dispatchWorkgroups(workgroups);localRank.end();
      const compaction=encoder.beginComputePass({label:'LOD stable scatter',timestampWrites:timer?.writes(frameIndex,2)});
      compaction.setPipeline(this.compactionPipeline);compaction.setBindGroup(0,this.compactionGroup);compaction.dispatchWorkgroups(workgroups);compaction.end();
    }
    this.lastTexture=this.context.getCurrentTexture();
    const raster=encoder.beginRenderPass({label:'Common native LOD raster',timestampWrites:timer?.writes(frameIndex,mode==='gpu'?3:0),
      colorAttachments:[{view:this.lastTexture.createView(),clearValue:{r:16/255,g:24/255,b:35/255,a:1},loadOp:'clear',storeOp:'store'}],
      depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    raster.setPipeline(this.rasterPipeline);
    for(let lod=0;lod<3;lod++){const geometry=this.geometry[lod];raster.setBindGroup(0,this.rasterGroups[lod]);raster.setVertexBuffer(0,geometry.vertex);
      raster.setVertexBuffer(1,geometry.normal);raster.setIndexBuffer(geometry.index,'uint32');raster.drawIndexedIndirect(this.drawsBuffer,lod*20);}
    raster.end();this.device.queue.submit([encoder.finish()]);const end=performance.now();
    return {cpuSelectMs,cpuSubmitMs:end-submitStart,cpuFrameMs:end-start,
      triangles:counts?counts.reduce((sum,value,lod)=>sum+value*this.triangleCounts[lod],0):null,lodCounts:counts};
  }

  private async capture():Promise<Uint8Array> {
    this.check();if(!this.lastTexture)throw new Error('No displayed texture to capture.');
    const {width,height}=this.config,rowBytes=Math.ceil(width*4/256)*256;
    const read=this.device.createBuffer({size:rowBytes*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try {const encoder=this.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:this.lastTexture},{buffer:read,bytesPerRow:rowBytes},[width,height]);
      this.device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
      const mapped=new Uint8Array(read.getMappedRange()),pixels=new Uint8Array(width*height*4),bgra=this.format.startsWith('bgra');
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const src=y*rowBytes+x*4,dst=(y*width+x)*4;
        pixels[dst]=mapped[src+(bgra?2:0)];pixels[dst+1]=mapped[src+1];pixels[dst+2]=mapped[src+(bgra?0:2)];pixels[dst+3]=mapped[src+3];}
      this.check();return pixels;
    }finally{if(read.mapState==='mapped')read.unmap();read.destroy();}
  }
  private async readState(mode:'cpu'|'gpu'):Promise<ReadState> {
    const n=this.config.count,selectionBytes=n*16,commandsOffset=selectionBytes,countersOffset=commandsOffset+60,idsOffset=countersOffset+16;
    const read=this.device.createBuffer({size:idsOffset+n*12,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try {const encoder=this.device.createCommandEncoder();
      if(mode==='gpu')encoder.copyBufferToBuffer(this.selectionsBuffer,0,read,0,selectionBytes);
      encoder.copyBufferToBuffer(this.drawsBuffer,0,read,commandsOffset,60);encoder.copyBufferToBuffer(this.countersBuffer,0,read,countersOffset,16);
      for(let lod=0;lod<3;lod++)encoder.copyBufferToBuffer(this.idsBuffers[lod],0,read,idsOffset+lod*n*4,n*4);
      this.device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const mapped=read.getMappedRange();
      const selections=mode==='cpu'?this.lastCpuSelection.slice():new Uint8Array(n);
      if(mode==='gpu'){const words=new Uint32Array(mapped,0,n*4);for(let i=0;i<n;i++)selections[i]=words[i*4];}
      return {selections,commands:new Uint32Array(mapped,commandsOffset,15).slice(),counters:new Uint32Array(mapped,countersOffset,4).slice(),
        ids:Array.from({length:3},(_,lod)=>new Uint32Array(mapped,idsOffset+lod*n*4,n).slice())};
    }finally{if(read.mapState==='mapped')read.unmap();read.destroy();}
  }
  async control(index:number):Promise<NativeLodControl> {
    this.check();this.device.pushErrorScope('validation');let scopeOpen=true;
    try {
      this.setPose(index);this.render('cpu');const a=await this.capture(),cpu=await this.readState('cpu');
      this.setPose(index);this.render('cpu');const aa=await this.capture();
      this.setPose(index);this.render('gpu');const b=await this.capture(),gpu=await this.readState('gpu');
      const error=await this.device.popErrorScope();scopeOpen=false;if(error)throw new Error(error.message);this.check();
      let selectionMismatches=0,compactedIdentityMismatches=0,compactedOrderMismatches=0,commandMismatches=0;
      const referenceCounts=[0,0,0],gpuCounts=[0,0,0],seen=new Uint8Array(this.config.count);
      for(let i=0;i<this.config.count;i++){referenceCounts[cpu.selections[i]]++;if(gpu.selections[i]<3)gpuCounts[gpu.selections[i]]++;
        if(cpu.selections[i]!==gpu.selections[i])selectionMismatches++;}
      for(let lod=0;lod<3;lod++){
        const expected=[this.triangleCounts[lod]*3,referenceCounts[lod],0,0,0];
        for(let word=0;word<5;word++)if(cpu.commands[lod*5+word]!==expected[word]||gpu.commands[lod*5+word]!==expected[word])commandMismatches++;
        for(const state of [cpu,gpu]){seen.fill(0);const count=state.commands[lod*5+1];
          if(count>this.config.count){compactedIdentityMismatches++;continue;}
          for(let slot=0;slot<count;slot++){const id=state.ids[lod][slot];
            if(id>=this.config.count||seen[id]||cpu.selections[id]!==lod)compactedIdentityMismatches++;else seen[id]=1;}
          for(let id=0;id<this.config.count;id++)if(cpu.selections[id]===lod&&!seen[id])compactedIdentityMismatches++;
        }
        const sharedCount=Math.min(cpu.commands[lod*5+1],gpu.commands[lod*5+1],this.config.count);
        for(let slot=0;slot<sharedCount;slot++)if(cpu.ids[lod][slot]!==gpu.ids[lod][slot])compactedOrderMismatches++;
        if(gpu.counters[lod]!==gpuCounts[lod])commandMismatches++;
      }
      if(gpu.counters[3]!==this.config.count)commandMismatches++;
      const repeat=compare(a,aa),candidate=compare(a,b),nonBackgroundPixels=[a,aa,b].map(nonBackground);
      const passed=!selectionMismatches&&!compactedIdentityMismatches&&!compactedOrderMismatches&&!commandMismatches&&!repeat.differentPixels&&!candidate.differentPixels&&nonBackgroundPixels.every(v=>v>0);
      if (passed) this.checkedImage = new ImageData(new Uint8ClampedArray(b), this.config.width, this.config.height);
      return {frameIndex:index,passed,...(passed?{}:{failure:'Selection, indirect IDs/counts, repeat image, candidate image, or nonempty-render control failed.'}),
        selectionMismatches,compactedIdentityMismatches,compactedOrderMismatches,commandMismatches,
        referenceSelectionHash:await hash(cpu.selections),gpuSelectionHash:await hash(gpu.selections),referenceCounts,gpuCounts,
        indirectCounts:[gpu.commands[1],gpu.commands[6],gpu.commands[11]],
        referenceTriangles:referenceCounts.reduce((sum,value,lod)=>sum+value*this.triangleCounts[lod],0),gpuTriangles:gpuCounts.reduce((sum,value,lod)=>sum+value*this.triangleCounts[lod],0),
        captures:{referenceHash:await hash(a),repeatHash:await hash(aa),gpuHash:await hash(b),aaDifferentPixels:repeat.differentPixels,abDifferentPixels:candidate.differentPixels,
          aaMaxChannelError:repeat.maxChannelError,abMaxChannelError:candidate.maxChannelError,nonBackgroundPixels,
          width:this.config.width,height:this.config.height,target:'Exact GPUCanvasContext current texture after native raster, copied before presentation; RGBA8'}};
    }finally{if(scopeOpen)await this.device.popErrorScope();}
  }
  takeCheckedImage(): ImageData | null {
    const image = this.checkedImage; this.checkedImage = null; return image;
  }
  dispose(preserveCanvas=true):void {
    if(this.stopped)return;this.stopped=true;this.device.removeEventListener('uncapturederror',this.uncaptured);
    for(const resource of this.resources)resource.destroy();
    // A completed campaign leaves its last presented image visible. No animation continues.
    if(!preserveCanvas)this.context.unconfigure();this.lastTexture=null;this.checkedImage=null;
  }
}
