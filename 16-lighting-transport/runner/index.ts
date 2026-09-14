import {createLightingScene,createDefaultLightingSceneLights,createTransport,compareImages} from '@web-geometry/sdk';
import {createExplorer,createLightingExperimentBackend,type LightingExperimentRenderState} from '@web-geometry/sdk/browser';
import {LIGHTING_PROTOCOL,type LightingConfig,type LightingFrame,type LightingController,type LightingReport,type LightingBenchOptions,type LightingVariant} from '../contracts.ts';

const copyConfig=(config:LightingConfig):LightingConfig=>({...config,lights:config.lights.map(light=>({...light,color:[...light.color],position:[...light.position]}))});
const defaults=():LightingConfig=>({variant:'brute',lights:createDefaultLightingSceneLights(),doorAngle:Math.PI/2,roughness:.25,cameraT:0,lightIntensity:1});
const pose=(t:number)=>({position:[2.8+.15*Math.sin(t*Math.PI*2),1.5,2.5-.3*Math.sin(t*Math.PI)] as [number,number,number],target:[-1,1.2,-1] as [number,number,number],fov:66,near:.025,far:50});
const nextFrame=(signal:AbortSignal)=>new Promise<number>((resolve,reject)=>{
  signal.throwIfAborted();
  const cancelled=()=>{cancelAnimationFrame(id);reject(signal.reason);};
  const id=requestAnimationFrame(time=>{signal.removeEventListener('abort',cancelled);resolve(time);});
  signal.addEventListener('abort',cancelled,{once:true});
});

function png(pixels:Uint8Array,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('PNG capture unavailable');
  const image=context.createImageData(width,height),stride=width*4;
  for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-y-1)*stride,(height-y)*stride),y*stride);
  context.putImageData(image,0,0);return canvas.toDataURL('image/png');
}

async function createRuntime(canvas:HTMLCanvasElement,options:LightingBenchOptions){
  const abort=new AbortController(),signal=abort.signal;
  const relay=()=>abort.abort(options.signal?.reason);
  options.signal?.addEventListener('abort',relay,{once:true});
  if(options.signal?.aborted)relay();
  let owned:Awaited<ReturnType<typeof createExplorer>>|undefined;
  const drop=()=>{options.signal?.removeEventListener('abort',relay);abort.abort();owned?.dispose();owned=undefined;};
  try{
    signal.throwIfAborted();options.onProgress?.('Préparation de la scène avec le SDK…');
    const response=await fetch('/api/lighting-prepare',{method:'POST',signal});
    if(!response.ok)throw Error(`Préparation indisponible : ${await response.text()}`);
    const prepared=await response.json() as {manifestUrl:string;preparationMs:number;provenance:Record<string,unknown>;fixtureKey:string};
    let config=defaults();
    const makeScene=()=>createLightingScene({...config,patchSize:LIGHTING_PROTOCOL.patchSize});
    const initial=makeScene();
    const transport=createTransport(initial,{raysPerPatch:LIGHTING_PROTOCOL.raysPerPatch,maxIterations:LIGHTING_PROTOCOL.maxIterations,tolerance:LIGHTING_PROTOCOL.tolerance,warmStart:false,cancelled:()=>signal.aborted});
    let last=transport.update(initial,'reuse');
    const state:LightingExperimentRenderState={scene:initial,indirectIrradiance:last.indirectIrradiance,radiance:last.radiance,exposure:1,
      reflectionSamples:LIGHTING_PROTOCOL.reflectionSamples,directLightSamples:LIGHTING_PROTOCOL.directLightSamples,rayTraversal:config.variant};
    options.onProgress?.('Création du rendu expérimental…');
    owned=await createExplorer(canvas,{manifestUrl:prepared.manifestUrl,scope:'full',width:LIGHTING_PROTOCOL.width,height:LIGHTING_PROTOCOL.height,pixelRatio:1,pixelError:0,preload:'all',backends:[createLightingExperimentBackend(state)],clearColor:0x080c12,signal,diagnosticDetail:'summary'});
    await owned.awaitPages();signal.throwIfAborted();
    const explorer=owned,gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 indisponible');
    const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const check=()=>{signal.throwIfAborted();if(gl.isContextLost())throw Error('Contexte graphique perdu');};
    const render=():LightingFrame=>{
      check();state.rayTraversal=config.variant;
      const start=performance.now(),metrics=explorer.render(pose(config.cameraT)),end=performance.now();
      if(metrics.triangles!==metrics.selectedTriangles)throw Error('Couverture géométrique incomplète');
      if(metrics.triangles!==LIGHTING_PROTOCOL.sourceTriangles)throw Error('La fixture a changé');
      return {variant:config.variant,cpuTransportMs:0,cpuSubmitMs:end-start,cpuFrameMs:end-start,gpuMs:null,rafDeltaMs:null,fps:null,
        drawCalls:metrics.drawCalls,triangles:metrics.triangles,raysReused:last.raysReused,totalRays:last.totalRays,
        bvhRefitMs:state.rayDiagnostics?.bvhRefitMs??null,bvhNodeCount:state.rayDiagnostics?.bvhNodeCount??null,bvhNodeBytes:state.rayDiagnostics?.bvhNodeBytes??null};
    };
    const setConfig=(patch:Partial<LightingConfig>)=>{
      check();const start=performance.now();
      const previous=config;
      config=copyConfig({...config,...patch});
      if(previous.doorAngle!==config.doorAngle||previous.roughness!==config.roughness||previous.lightIntensity!==config.lightIntensity||JSON.stringify(previous.lights)!==JSON.stringify(config.lights)){
        const scene=makeScene();last=transport.update(scene,'reuse');
        if(!last.converged)throw Error('Le transport diffus ne converge pas');
        state.scene=scene;state.radiance=last.radiance;state.indirectIrradiance=last.indirectIrradiance;
      }
      return performance.now()-start;
    };
    const update=async(patch:Partial<LightingConfig>):Promise<LightingFrame>=>{
      const start=performance.now(),cpuTransportMs=setConfig(patch),frame=render();
      return {...frame,cpuTransportMs,cpuFrameMs:performance.now()-start};
    };
    const capturePixels=()=>{check();explorer.setPose(pose(config.cameraT));state.rayTraversal=config.variant;return explorer.capture().slice();};
    const capture=()=>({width:canvas.width,height:canvas.height,dataUrl:png(capturePixels(),canvas.width,canvas.height)});
    const waitGpu=async()=>{
      check();const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)throw Error('GPU fence unavailable');gl.flush();
      const start=performance.now();
      try{for(;;){check();const status=gl.clientWaitSync(fence,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
        if(status===gl.WAIT_FAILED||performance.now()-start>30_000)throw Error('GPU fence timeout');await nextFrame(signal);}}
      finally{gl.deleteSync(fence);}
    };
    const isolatedFrame=async()=>{
      await waitGpu();check();
      if(!timer)return {...render(),gpuMs:null};
      if(gl.getParameter(timer.GPU_DISJOINT_EXT))throw Error('Horloge GPU invalide');
      const query=gl.createQuery();if(!query)throw Error('GPU query unavailable');
      try{
        gl.beginQuery(timer.TIME_ELAPSED_EXT,query);let frame:LightingFrame;
        try{frame=render();}finally{gl.endQuery(timer.TIME_ELAPSED_EXT);}
        await waitGpu();
        const start=performance.now();
        while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
          check();if(performance.now()-start>30_000)throw Error('GPU query timeout');await nextFrame(signal);
        }
        if(gl.getParameter(timer.GPU_DISJOINT_EXT))throw Error('Horloge GPU invalide');
        return {...frame,gpuMs:Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6};
      }finally{gl.deleteQuery(query);}
    };
    const controller:LightingController={update,render,resize:(width,height)=>{check();explorer.resize(width,height);},capture,getConfig:()=>copyConfig(config),dispose:drop};
    return {controller,signal,setConfig,capturePixels,isolatedFrame,waitGpu,prepared,
      environment:{userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio,logicalCpus:navigator.hardwareConcurrency,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,gpuTimerAvailable:!!timer,webglVersion:gl.getParameter(gl.VERSION),visibility:document.visibilityState},
      geometry:{surfaces:initial.surfaces.length,patches:initial.patches.length,triangles:explorer.metadata.selectedTriangles}};
  }catch(error){drop();throw error;}
}

export async function createLightingBench(canvas:HTMLCanvasElement,options:LightingBenchOptions):Promise<LightingController>{
  const runtime=await createRuntime(canvas,options);
  try{runtime.controller.render();return runtime.controller;}catch(error){runtime.controller.dispose();throw error;}
}

export async function runLightingComparison(canvas:HTMLCanvasElement,options:LightingBenchOptions):Promise<LightingReport>{
  const config=defaults(),lights=config.lights;
  let runtime:Awaited<ReturnType<typeof createRuntime>>|undefined;
  const report:LightingReport={formatVersion:1,id:crypto.randomUUID(),timestamp:new Date().toISOString(),status:'rejected',protocol:LIGHTING_PROTOCOL,config,
    environment:{renderer:null,vendor:null,webglVersion:null,gpuTimerAvailable:null},
    provenance:{initialization:'pending',sdkCommit:null,labCommit:null,sourceHashes:null,preparationMs:null,fixtureKey:null,geometry:null,
      labBenchmarkRunner:true,publicPrepare:null,publicExplorer:null,preparedClusterGeometryRendered:false,productionRenderer:false},
    quality:{passed:null,captures:[]},blocks:[],artifacts:[],observedRafCeilingHz:null,
    limitations:['Rendu expérimental WebGL2 des maillages source ; intégration au rendu habituel du moteur non réalisée.',
      'Équivalence entre algorithmes uniquement : la qualité physique et la fluidité cible restent à valider.',
      'Transport diffus calculé sur CPU ; aucune accélération Worker ou WebAssembly dans ce test.',
      'Ce test ne compare pas les cartes d’ombres et ne choisit pas l’architecture du moteur. Un essai dans le pipeline réel reste nécessaire.',
      'GPU isolé et cadence rAF mesurés dans des passes séparées. La fréquence physique de l’écran reste non mesurée.',
      'Une seule machine et un seul navigateur ; les autres systèmes et GPU restent non testés.']};
  const stages:Array<{id:string;patch:Partial<LightingConfig>}>= [
    {id:'closed',patch:{doorAngle:0}},{id:'open',patch:{doorAngle:Math.PI/2}},
    {id:'partial',patch:{doorAngle:Math.PI/4,cameraT:.15}},
    {id:'off',patch:{lightIntensity:0}},{id:'relit',patch:{lightIntensity:1}},
    {id:'closed-again',patch:{doorAngle:0}},{id:'mirror-camera',patch:{doorAngle:Math.PI/2,cameraT:.8}},
    {id:'smooth',patch:{roughness:.03,cameraT:0}},{id:'rough',patch:{roughness:.7}},
    ...lights.map((light,index)=>({id:`light-${light.id}`,patch:{roughness:.25,lights:lights.map((source,i)=>({...source,intensity:i===index?source.intensity:0}))}})),
    {id:'recolored',patch:{lights:lights.map((source,i)=>({...source,color:lights[(i+1)%lights.length].color}))}},
    {id:'moved-lights',patch:{doorAngle:Math.PI/3,lights:lights.map(source=>({...source,position:[source.position[0],source.position[1],-source.position[2]+.3] as [number,number,number]}))}},
  ];
  try{
    runtime=await createRuntime(canvas,options);
    const {controller,signal}=runtime;
    report.config=controller.getConfig();report.environment=runtime.environment;
    report.provenance={...report.provenance,...runtime.prepared.provenance,initialization:'ready',
      preparationMs:runtime.prepared.preparationMs,fixtureKey:runtime.prepared.fixtureKey,geometry:runtime.geometry,publicPrepare:true,publicExplorer:true};
    for(const [index,stage] of stages.entries()){
      options.onProgress?.(`Images identiques · ${index+1}/${stages.length} · ${stage.id}`);await nextFrame(signal);
      runtime.setConfig({...stage.patch,variant:'brute'});controller.render();
      const a=runtime.capturePixels(),aa=runtime.capturePixels();
      runtime.setConfig({variant:'bvh'});const b=runtime.capturePixels();
      const repeat=compareImages(a,aa),candidate=compareImages(a,b);
      let foregroundPixels=0;for(let i=4;i<a.length;i+=4)if(a[i]!==a[0]||a[i+1]!==a[1]||a[i+2]!==a[2])foregroundPixels++;
      const visibleOrUnlit=foregroundPixels>100||controller.getConfig().lightIntensity===0;
      const passed=visibleOrUnlit&&repeat.differentPixels===0&&candidate.differentPixels===0;
      report.quality.captures.push({scenario:stage.id,repeatDifferentPixels:repeat.differentPixels,candidateDifferentPixels:candidate.differentPixels,
        maxRepeatChannelError:repeat.maxChannelError,maxCandidateChannelError:candidate.maxChannelError,foregroundPixels,passed});
      report.artifacts.push({scenario:stage.id,variant:'brute',dataUrl:png(a,canvas.width,canvas.height)},{scenario:stage.id,variant:'bvh',dataUrl:png(b,canvas.width,canvas.height)});
    }
    report.quality.passed=report.quality.captures.every(capture=>capture.passed);
    if(report.quality.passed){
      runtime.setConfig(config);await runtime.waitGpu();
      const idle:number[]=[];let previous=await nextFrame(signal);
      for(let i=0;i<20;i++){const now=await nextFrame(signal);idle.push(now-previous);previous=now;}
      const sorted=idle.sort((a,b)=>a-b);report.observedRafCeilingHz=1000/sorted[Math.floor(sorted.length/2)];
      const order:LightingVariant[]=['brute','bvh','bvh','brute'];
      for(const variant of order){
        options.onProgress?.(`Cadence à qualité constante · ${variant==='brute'?'référence':'arbre d’obstacles'}`);
        runtime.setConfig({variant});await runtime.waitGpu();
        for(let i=0;i<LIGHTING_PROTOCOL.warmupFrames;i++){await nextFrame(signal);controller.render();}
        const frames:LightingFrame[]=[];let previous=await nextFrame(signal);
        // Timing frames contain no capture, readback, UI publication or CPU light solve.
        for(let i=0;i<LIGHTING_PROTOCOL.sampleFrames;i++){
          const frame=controller.render();const now=await nextFrame(signal),interval=now-previous;previous=now;
          frames.push({...frame,rafDeltaMs:interval,fps:1000/interval});
        }
        report.blocks.push({variant,kind:'cadence',frames});await runtime.waitGpu();
      }
      for(const variant of order){
        options.onProgress?.(`Temps GPU isolé · ${variant==='brute'?'référence':'arbre d’obstacles'}`);
        runtime.setConfig({variant});
        for(let i=0;i<2;i++)await runtime.isolatedFrame();
        const frames:LightingFrame[]=[];
        for(let i=0;i<5;i++)frames.push(await runtime.isolatedFrame());
        report.blocks.push({variant,kind:'gpu-isolated',frames});
      }
      report.status='measured';
    }
  }catch(error){
    const stopped=options.signal?.aborted||runtime?.signal.aborted;
    report.status=stopped?'stopped':'error';
    report.error=stopped?'Test arrêté à la demande.':error instanceof Error?error.message:String(error);
    if(!runtime)report.provenance.initialization=stopped?'stopped':'failed';
  }finally{runtime?.controller.dispose();}
  options.onProgress?.('Archivage des images, des mesures et des sources…');
  // An aborted rendering job must still save its partial evidence; use a separate bounded request.
  try{
    const response=await fetch('/api/lighting-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report),signal:AbortSignal.timeout(30_000)});
    if(!response.ok)throw Error(await response.text());
  }catch(error){report.status='error';report.error=`Archivage échoué : ${String(error)}`;}
  return report;
}
