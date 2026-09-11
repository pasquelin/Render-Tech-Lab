import * as THREE from 'three';
import { selectLodsOnCpu, type CpuLodSelectionResult } from '../cpuLodSelector.ts';
import { selectLodsPrepared, selectLodsGuarded, GUARDED_VARIANT_ASSUMPTIONS } from './variants.ts';
import { createSeededRandom } from '../../shared/scene/random.ts';
import type { BenchResultRecord } from '../../shared/benchmark/types.ts';
import type {
  ComparisonOptions, ComparisonVariant, ComparisonFrame, ComparisonBlock, MetricSummary,
  QualityCapture, TrajectoryControl, SceneComparisonResult,
} from './comparisonTypes.ts';
export type { ComparisonOptions, SceneComparisonResult } from './comparisonTypes.ts';

type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type PendingQuery = { query: WebGLQuery; sample: ComparisonFrame };
const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const timestamp = () => new Date().toISOString();

async function sha256(view: ArrayBufferView): Promise<string> {
  // Exact copy outside timing also accommodates SharedArrayBuffer-backed views.
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
function summarize(values: Array<number | null>): MetricSummary {
  const ordered = values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a,b) => a-b);
  const quantile = (p: number) => ordered.length ? ordered[Math.floor((ordered.length - 1) * p)] : null;
  return { p50: quantile(.5), p95: quantile(.95), p99: quantile(.99),
    mean: ordered.length ? ordered.reduce((a,b) => a+b,0) / ordered.length : null,
    min: ordered[0] ?? null, max: ordered.at(-1) ?? null, validSamples: ordered.length };
}
function blockSummary(samples: ComparisonFrame[]): Record<string, MetricSummary> {
  return Object.fromEntries((['cpuSelectMs','cpuApplyMs','cpuRenderSubmitMs','cpuFrameWorkMs','rafDeltaMs','gpuMs'] as const)
    .map(key => [key, summarize(samples.map(sample => sample[key]))]));
}
function validateOptions(options: ComparisonOptions) {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100000) throw new Error('Nombre d’objets : 1 à 100 000.');
  if (!Number.isInteger(options.samples) || options.samples < 120 || options.samples > 600) throw new Error('Échantillons : 120 à 600.');
  if (!Number.isInteger(options.warmup) || options.warmup < 1 || options.warmup > 600) throw new Error('Échauffement : 1 à 600.');
  if (![options.width,options.height,options.pixelRatio].every(v => Number.isFinite(v) && v > 0)) throw new Error('Dimensions invalides.');
  if (!Number.isInteger(options.width) || !Number.isInteger(options.height)) throw new Error('Dimensions physiques entières requises.');
  if (options.width > 4096 || options.height > 4096) throw new Error('Cible limitée à 4 096 pixels par axe.');
  if (!Number.isFinite(options.seed)) throw new Error('Graine invalide.');
}

/** Resident, deliberately expensive scene. This compares selectors, not a new LOD policy. */
export interface PreviewMetrics {
  cpuFrameWorkMs: number; rafDeltaMs: number | null; triangles: number; drawCalls: number; lodCounts: number[];
  mainPassTriangles: number; shadowPassTriangles: number;
}
async function executeSceneComparison(
  canvas: HTMLCanvasElement,
  options: ComparisonOptions,
  onProgress: (message: string) => void = () => {},
  preview?: { onFrame: (metrics: PreviewMetrics) => void },
): Promise<SceneComparisonResult | (() => void)> {
  validateOptions(options);
  const config = { ...options }, candidate = config.candidate ?? 'prepared';
  const start = timestamp(), preparationStart = performance.now();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const scene = new THREE.Scene(), resources: Array<{ dispose(): void }> = [];
  const queries: PendingQuery[] = [];
  let activeQuery:WebGLQuery|null=null,activeQueryTarget:number|null=null;
  let hidden = document.visibilityState !== 'visible';
  const visibilityChanged = () => { if (document.visibilityState !== 'visible') hidden = true; };
  document.addEventListener('visibilitychange', visibilityChanged);
  const check = () => {
    if (hidden || document.visibilityState !== 'visible') throw new Error('Campagne interrompue : onglet masqué.');
    if (gl.isContextLost()) throw new Error('Campagne interrompue : contexte WebGL perdu.');
  };
  let restoreUploadInstrumentation = () => {};
  let previewOwnsResources = false;
  const cleanup = () => {
    restoreUploadInstrumentation();document.removeEventListener('visibilitychange',visibilityChanged);
    if(activeQuery){if(activeQueryTarget!==null)gl.endQuery(activeQueryTarget);gl.deleteQuery(activeQuery);activeQuery=null;}
    for(const item of queries.splice(0))gl.deleteQuery(item.query);
    for(const resource of resources)resource.dispose();
    scene.traverse(object=>{if(object instanceof THREE.DirectionalLight)object.shadow.dispose();});
    renderer.dispose();
  };
  try {
    if (!(gl instanceof WebGL2RenderingContext)) throw new Error('WebGL2 requis.');
    check(); renderer.setPixelRatio(config.pixelRatio);
    renderer.setSize(config.width/config.pixelRatio,config.height/config.pixelRatio,true);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = config.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    let shadowPassTriangles = 0, shadowPassDrawCalls = 0;
    const originalShadowRender = renderer.shadowMap.render;
    renderer.shadowMap.render = (...args) => {
      const beforeTriangles = renderer.info.render.triangles, beforeCalls = renderer.info.render.calls;
      originalShadowRender.apply(renderer.shadowMap,args);
      shadowPassTriangles = renderer.info.render.triangles-beforeTriangles;
      shadowPassDrawCalls = renderer.info.render.calls-beforeCalls;
    };
    const physical = renderer.getDrawingBufferSize(new THREE.Vector2());
    if(physical.x!==config.width||physical.y!==config.height)throw new Error('Le drawing buffer ne correspond pas aux dimensions physiques demandées.');
    const columns = Math.ceil(Math.sqrt(config.count * 1.5)), rows = Math.ceil(config.count / columns), spacing = 3.1;
    const extent = Math.max(columns, rows) * spacing;
    const camera = new THREE.PerspectiveCamera(60, physical.x / physical.y, .1, Math.max(2000, extent * 8));
    const baseCamera: [number,number,number] = [0, Math.max(35, extent * .8), Math.max(50, extent * 1.1)];
    camera.position.fromArray(baseCamera); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    scene.background = new THREE.Color('#111925');
    scene.add(new THREE.HemisphereLight(0xc5d9ff, 0x62432a, 1.5));
    const key = new THREE.DirectionalLight(0xffefda, 3); key.position.set(extent * .3, extent, extent * .3);
    key.castShadow = config.shadows; key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -extent;
    key.shadow.camera.right = key.shadow.camera.top = extent;
    key.shadow.camera.near = .1; key.shadow.camera.far = extent * 4; key.shadow.normalBias = .035;
    key.shadow.camera.updateProjectionMatrix(); scene.add(key);
    const fill = new THREE.DirectionalLight(0x7698ef, 1.2); fill.position.set(-extent, extent * .3, -extent); scene.add(fill);
    const geometries = [[192,32],[96,16],[48,8]].map(([tubular, radial]) => new THREE.TorusKnotGeometry(.72,.22,tubular,radial));
    geometries.forEach(geometry=>geometry.computeBoundingSphere());
    const sourceRadius=Math.max(...geometries.map(geometry=>geometry.boundingSphere!.radius+geometry.boundingSphere!.center.length()));
    const material = new THREE.MeshStandardMaterial({ color: 0x7ec4e2, roughness: .27, metalness: .65 });
    const groundGeometry = new THREE.PlaneGeometry(extent * 2, extent * 2);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x242b39, roughness: .85, metalness: .05 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5;
    ground.receiveShadow = config.shadows; scene.add(ground);
    resources.push(...geometries, material, groundGeometry, groundMaterial);
    const meshes = geometries.map(geometry => {
      const mesh = new THREE.InstancedMesh(geometry, material, config.count);
      mesh.frustumCulled = false; mesh.castShadow = config.shadows; mesh.receiveShadow = config.shadows;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh); resources.push(mesh); return mesh;
    });
    const positions = new Float32Array(config.count * 3), radii = new Float32Array(config.count);
    const matrices = new Float32Array(config.count * 16), rng = createSeededRandom(config.seed);
    const point = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion(), matrix = new THREE.Matrix4();
    const viewDirection = new THREE.Vector3().fromArray(baseCamera).negate().normalize(), viewRight = new THREE.Vector3(1,0,0);
    const viewUp = new THREE.Vector3().crossVectors(viewRight, viewDirection).normalize();
    const cameraDistance = new THREE.Vector3().fromArray(baseCamera).length();
    for (let i = 0; i < config.count; i++) {
      point.set(((i % columns) - (columns - 1) / 2) * spacing,
        (rng() - .5) * .45, (Math.floor(i / columns) - (rows - 1) / 2) * spacing);
      let objectScale = .8 + rng() * .35;
      // A few fully drawn detailed foreground objects exercise LOD0/LOD1; the complete grid stays present.
      if (i < 3 && config.count > 3) {
        const distance = cameraDistance * [.28,.4,.48][i];
        const radialPixels = [340,110,35][i];
        objectScale = radialPixels * distance * Math.tan(Math.PI / 6) / (1080 * sourceRadius);
        point.fromArray(baseCamera).addScaledVector(viewDirection, distance)
          .addScaledVector(viewRight, [-.28,.02,.28][i] * distance).addScaledVector(viewUp, distance * .12);
      }
      positions.set(point.toArray(), i * 3); radii[i] = objectScale * sourceRadius;
      point.fromArray(positions, i * 3); scale.setScalar(objectScale);
      rotation.setFromEuler(new THREE.Euler(rng()*Math.PI,rng()*Math.PI,rng()*Math.PI));
      matrix.compose(point, rotation, scale); matrix.toArray(matrices, i * 16);
      if(i>0&&i%2000===0){onProgress(`Préparation de ${i}/${config.count} objets détaillés.`);await nextFrame();check();}
    }
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    const environment = { browser: navigator.userAgent, threeVersion: THREE.REVISION, backend: 'WebGL2',
      glVersion: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER),
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : null,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      timerQueryAvailable: timer !== null, devicePixelRatio, visibility: document.visibilityState,
      cssWidth:config.width/config.pixelRatio,cssHeight:config.height/config.pixelRatio,renderPixelRatio:config.pixelRatio,
      physicalWidth: physical.x, physicalHeight: physical.y, performanceTimeOrigin: performance.timeOrigin,
      candidateStatus:candidate==='guarded'?'experimental-conditional':'benchmark-candidate',
      candidateAssumptions:candidate==='guarded'?GUARDED_VARIANT_ASSUMPTIONS:null };
    const sceneInfo = { fixture: 'dense-visible-resident-torus-knot-grid-with-detailed-foreground', count: config.count,
      geometryTrianglesPerLod: geometries.map(g => g.index!.count / 3), sourceTrianglesAtFinestLod: config.count * geometries[0].index!.count / 3,
      positionHash: await sha256(positions), radiiHash: await sha256(radii), matricesHash: await sha256(matrices),
      materialCount: 2, lights: 3, shadowLights: config.shadows ? 1 : 0, shadowMapSize: config.shadows ? [2048,2048] : null,
      fov: 60, aspect: camera.aspect, near: camera.near, far: camera.far, seed: config.seed,
      instanceBufferCapacityBytes: meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength, 0),
      snapshotRetentionBytesPerBlock: config.count * config.samples,
      note: 'All N assets are selected and submitted; frustum counts do not mean every surface is unoccluded.' };
    const choose = (variant: ComparisonVariant, position: [number,number,number]) => {
      const fn = variant === 'reference' ? selectLodsOnCpu : variant === 'prepared' ? selectLodsPrepared : selectLodsGuarded;
      return fn(positions,radii,position,physical.y,Math.PI/3);
    };
    const setCamera = (index: number): [number,number,number] => {
      const position: [number,number,number] = [Math.sin(index*.017)*extent*.025,
        baseCamera[1] + Math.sin(index*.011)*extent*.01, baseCamera[2] + Math.cos(index*.013)*extent*.015];
      camera.position.fromArray(position); camera.lookAt(0,0,0); camera.updateMatrixWorld(); return position;
    };
    const apply = (result: CpuLodSelectionResult): [number,number,number] => {
      const used: [number,number,number] = [0,0,0];
      if (result.selectedLods.length !== config.count) throw new Error('Nombre d’identités incorrect.');
      for (let i = 0; i < config.count; i++) {
        const tier = result.selectedLods[i]; if (tier > 2) throw new Error('LOD invalide.');
        const destination = meshes[tier].instanceMatrix.array, offset = used[tier]++ * 16;
        for (let j = 0; j < 16; j++) destination[offset+j] = matrices[i*16+j];
      }
      for (let i=0;i<3;i++) { const mesh = meshes[i]; mesh.count = used[i]; mesh.instanceMatrix.clearUpdateRanges();
        if (used[i]) { mesh.instanceMatrix.addUpdateRange(0,used[i]*16); mesh.instanceMatrix.needsUpdate = true; } }
      return used;
    };
    const equal = (a: CpuLodSelectionResult,b: CpuLodSelectionResult) => {
      if (a.selectedLods.length !== b.selectedLods.length) return false;
      for (let i=0;i<a.selectedLods.length;i++) if (a.selectedLods[i] !== b.selectedLods[i]) return false;
      return a.lodCounts.every((count,i) => count === b.lodCounts[i]);
    };
    const render = () => {renderer.info.reset();shadowPassTriangles=shadowPassDrawCalls=0;renderer.render(scene,camera);};
    apply(choose('reference',setCamera(0))); renderer.compile(scene,camera);
    if(preview){
      let active=true,frame=0,request=0,previous:number|null=null;
      const stop=()=>{if(!active)return;active=false;cancelAnimationFrame(request);cleanup();};
      const tick=(now:number)=>{
        if(!active)return;
        if(document.visibilityState!=='visible'){previous=null;request=requestAnimationFrame(tick);return;}
        if(gl.isContextLost()){stop();return;}
        try{
          const begin=performance.now(),position=setCamera(frame++),selection=choose(config.candidate??'reference',position);
          const counts=apply(selection);render();
          preview.onFrame({cpuFrameWorkMs:performance.now()-begin,rafDeltaMs:previous===null?null:now-previous,
            triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,lodCounts:counts,
            mainPassTriangles:renderer.info.render.triangles-shadowPassTriangles,shadowPassTriangles});
        }catch(error){stop();throw error;}
        previous=now;request=requestAnimationFrame(tick);
      };
      previewOwnsResources=true;request=requestAnimationFrame(tick);return stop;
    }
    const preparationMs = performance.now()-preparationStart, controlsStart = performance.now();
    const trajectory: TrajectoryControl[] = [], captures:QualityCapture[]=[];
    const reject=(failure:string):SceneComparisonResult=>({timestamp:start,config,environment,scene:sceneInfo,
      preparation:{sceneAndCompileMs:preparationMs},quality:{passed:false,captures,trajectory,measuredFrameIdsMatch:false,correspondingDrawCountsMatch:false,failure},blocks:[],
      records:[{timestamp:timestamp(),test:'04-gpu-lod-scene-comparison',commit:null,status:'not-run',verdict:'REJECT',
        environment:{gpu:environment.gpu,browser:navigator.userAgent,threeVersion:THREE.REVISION},scene:{objects:config.count},
        cpu:{frameMs:null},gpu:{frameMs:null},memory:{gpuBytes:null},draw:{submitted:null},customMetrics:{candidate,qualityPassed:false,failure}}],
      limitations:['Correctness mismatch; timing results are not accepted.']});
    const frustum = new THREE.Frustum(), clip = new THREE.Matrix4(), sphere = new THREE.Sphere();
    onProgress('Contrôle des identités pour toute la trajectoire, hors chronométrage.');
    for (let index=0;index<config.samples;index++) {
      check(); const position=setCamera(index), reference=choose('reference',position), optimized=choose(candidate,position);
      if (!equal(reference,optimized)) return reject(`Différence de sélection à la frame ${index} (référence ${await sha256(reference.selectedLods)}, candidate ${await sha256(optimized.selectedLods)}).`);
      frustum.setFromProjectionMatrix(clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      let intersecting=0;
      for(let i=0;i<config.count;i++) { sphere.center.fromArray(positions,i*3);sphere.radius=radii[i];if(frustum.intersectsSphere(sphere))intersecting++; }
      trajectory.push({ frameIndex:index,referenceHash:await sha256(reference.selectedLods),lodCounts:reference.lodCounts,frustumIntersectingInstances:intersecting });
      if(index%30===29) {onProgress(`Identités contrôlées : ${index+1}/${config.samples}.`);await nextFrame();}
    }
    const controlsMs=performance.now()-controlsStart,captureStart=performance.now();
    const renderPixels=(result:CpuLodSelectionResult) => {
      apply(result);renderer.setRenderTarget(null);render();
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Cible de contrôle pixel incomplète.');
      const bytes=new Uint8Array(physical.x*physical.y*4);
      gl.readPixels(0,0,physical.x,physical.y,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
      const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(`Lecture de contrôle pixel invalide (WebGL ${error}).`);
      return bytes;
    };
    for(const index of [0,Math.floor(config.samples/2),config.samples-1]) {
      check();onProgress(`Contrôle pixel intégral ${physical.x}×${physical.y}, frame ${index}.`);
      const position=setCamera(index),reference=choose('reference',position),left=renderPixels(reference),referenceHash=await sha256(left);
      for(const variant of ['reference',candidate] as ComparisonVariant[]) {
        const right=renderPixels(choose(variant,position));let differentPixels=0,maxChannelError=0;
        for(let i=0;i<left.length;i+=4){let changed=false;for(let c=0;c<4;c++){const difference=Math.abs(left[i+c]-right[i+c]);if(difference)changed=true;maxChannelError=Math.max(maxChannelError,difference);}if(changed)differentPixels++;}
        captures.push({frameIndex:index,variant,width:physical.x,height:physical.y,differentPixels,maxChannelError,referenceHash,candidateHash:await sha256(right)});
        if(differentPixels)return reject(`Images différentes : ${variant}, frame ${index}, ${differentPixels} pixels.`);
      }
      await nextFrame();
    }
    renderer.setRenderTarget(null);const qualityMs=performance.now()-captureStart;
    // Actual WebGL transfer byte counts. Upload calls remain inside renderSubmitMs, not a GPU-duration estimate.
    let bufferSubDataBytes=0,bufferDataBytes=0;
    const originalSub=gl.bufferSubData,originalData=gl.bufferData;
    const transferredBytes=(source:unknown,offset=0,length?:number):number => {
      if(typeof source==='number')return source;
      if(ArrayBuffer.isView(source)){const itemSize='BYTES_PER_ELEMENT'in source?Number(source.BYTES_PER_ELEMENT):1;
        return length ? length*itemSize : Math.max(0,source.byteLength-offset*itemSize);}
      return source instanceof ArrayBuffer?source.byteLength:0;
    };
    gl.bufferSubData=((...args:unknown[])=>{bufferSubDataBytes+=transferredBytes(args[2],Number(args[3]??0),args[4]as number|undefined);Reflect.apply(originalSub,gl,args);})as typeof gl.bufferSubData;
    gl.bufferData=((...args:unknown[])=>{bufferDataBytes+=transferredBytes(args[1],Number(args[3]??0),args[4]as number|undefined);Reflect.apply(originalData,gl,args);})as typeof gl.bufferData;
    restoreUploadInstrumentation=()=>{gl.bufferSubData=originalSub;gl.bufferData=originalData;};
    const poll=()=>{
      if(!timer)return;
      if(gl.getParameter(timer.GPU_DISJOINT_EXT)){for(const item of queries.splice(0)){item.sample.gpuStatus='disjoint';gl.deleteQuery(item.query);}return;}
      while(queries.length&&gl.getQueryParameter(queries[0].query,gl.QUERY_RESULT_AVAILABLE)){
        const item=queries.shift()!,nanoseconds:unknown=gl.getQueryParameter(item.query,gl.QUERY_RESULT);
        if(typeof nanoseconds==='number'&&Number.isFinite(nanoseconds)&&nanoseconds>=0){item.sample.gpuMs=nanoseconds/1e6;item.sample.gpuStatus='measured';}
        else item.sample.gpuStatus='invalid-query-result';
        gl.deleteQuery(item.query);
      }
    };
    const blocks:ComparisonBlock[]=[],order:ComparisonVariant[]=['reference',candidate,candidate,'reference'];
    for(const variant of order) {
      onProgress(`Mesure ${variant}, bloc ${blocks.length+1}/4.`);
      const samples:ComparisonFrame[]=[],snapshots:Uint8Array[]=[],startedAt=timestamp();let previous:number|null=null;
      for(let index=-config.warmup;index<config.samples;index++) {
        const rafTimestamp=await nextFrame();check();const fullStart=performance.now();poll();const polled=performance.now();
        const position=setCamera(Math.max(index,0)),selectStart=performance.now(),selection=choose(variant,position),selectedAt=performance.now();
        const counts=apply(selection),appliedAt=performance.now();bufferSubDataBytes=bufferDataBytes=0;
        const sample:ComparisonFrame={index,rafTimestamp,rafDeltaMs:previous===null?null:rafTimestamp-previous,
          cpuSelectMs:selectedAt-selectStart,cpuApplyMs:appliedAt-selectedAt,cpuQueryPollMs:polled-fullStart,
          cpuRenderSubmitMs:0,cpuFrameWorkMs:0,gpuMs:null,gpuStatus:timer?'pending':'unsupported',lodCounts:counts,
          drawCalls:0,triangles:0,mainPassTriangles:0,shadowPassTriangles:0,mainPassDrawCalls:0,shadowPassDrawCalls:0,
          consumedInstances:config.count,uploadBytesRequested:config.count*64,bufferSubDataBytes:0,bufferDataBytes:0,selectionHash:''};
        let query:WebGLQuery|null=null;
        if(index>=0&&timer&&queries.length<16){query=gl.createQuery();if(query){activeQuery=query;activeQueryTarget=timer.TIME_ELAPSED_EXT;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}}
        if(index>=0&&timer&&!query)sample.gpuStatus='query-capacity-or-allocation';
        const renderStart=performance.now();render();const renderedAt=performance.now();
        if(query&&timer){gl.endQuery(timer.TIME_ELAPSED_EXT);activeQuery=null;activeQueryTarget=null;queries.push({query,sample});}
        sample.cpuRenderSubmitMs=renderedAt-renderStart;sample.cpuFrameWorkMs=performance.now()-fullStart;
        sample.drawCalls=renderer.info.render.calls;sample.triangles=renderer.info.render.triangles;
        sample.shadowPassTriangles=shadowPassTriangles;sample.shadowPassDrawCalls=shadowPassDrawCalls;
        sample.mainPassTriangles=sample.triangles-shadowPassTriangles;sample.mainPassDrawCalls=sample.drawCalls-shadowPassDrawCalls;
        sample.consumedInstances=counts.reduce((a,b)=>a+b,0);sample.bufferSubDataBytes=bufferSubDataBytes;sample.bufferDataBytes=bufferDataBytes;
        if(index>=0){samples.push(sample);snapshots.push(selection.selectedLods);}
        previous=rafTimestamp;
        if(index>=0&&index%60===59)onProgress(`${variant} : ${index+1}/${config.samples} frames.`);
      }
      const measuredUntil=timestamp();
      for(let i=0;queries.length&&i<120;i++){check();await nextFrame();poll();}
      for(const item of queries.splice(0)){item.sample.gpuStatus='timeout';gl.deleteQuery(item.query);}
      for(let i=0;i<samples.length;i++){samples[i].selectionHash=await sha256(snapshots[i]);if(samples[i].selectionHash!==trajectory[i].referenceHash)return reject(`IDs mesurés différents : ${variant}, frame ${i}.`);}
      blocks.push({variant,startedAt,measuredUntil,completedAt:timestamp(),samples,summary:blockSummary(samples)});
    }
    for(const block of blocks)for(let i=0;i<block.samples.length;i++){
      const left=blocks[0].samples[i],right=block.samples[i];
      if((['drawCalls','triangles','consumedInstances','mainPassTriangles','shadowPassTriangles','mainPassDrawCalls','shadowPassDrawCalls']as const).some(key=>left[key]!==right[key]))return reject(`Travail rendu différent à la frame ${i}.`);
    }
    const records:BenchResultRecord[]=(['reference',candidate]as ComparisonVariant[]).map(variant=>{
      const samples=blocks.filter(block=>block.variant===variant).flatMap(block=>block.samples),summary=blockSummary(samples);
      return {timestamp:timestamp(),test:'04-gpu-lod-scene-comparison',commit:null,status:'measured',verdict:'WATCHLIST',
        environment:{gpu:environment.gpu,browser:navigator.userAgent,threeVersion:THREE.REVISION,webgpuFeatures:null},
        scene:{objects:config.count,triangles:samples[0]?.triangles??null,materials:2,lights:3},
        cpu:{frameMs:summary.cpuFrameWorkMs.p50,submitMs:summary.cpuRenderSubmitMs.p50,p95Ms:summary.cpuFrameWorkMs.p95,p99Ms:summary.cpuFrameWorkMs.p99,fps:null},
        gpu:{frameMs:summary.gpuMs.p50},memory:{gpuBytes:null},draw:{submitted:samples[0]?.drawCalls??null,visible:null},
        customMetrics:{variant,summary,physicalWidth:physical.x,physicalHeight:physical.y,qualityPassed:true,scope:'same-renderer selector comparison; no automatic integration verdict'}};
    });
    return {timestamp:start,config,environment,scene:sceneInfo,
      preparation:{sceneAndCompileMs:preparationMs,trajectoryControlsMs:controlsMs,pixelQualityMs:qualityMs},
      quality:{passed:true,captures,trajectory,measuredFrameIdsMatch:true,correspondingDrawCountsMatch:true},blocks,records,
      limitations:['Single browser/device/configuration; no universal low-end or all-resolution claim.',
        'Historical 04B radial-size LOD is preserved; this does not certify projected geometric error.',
        'Frame CPU measures selection, matrix application and render submission, not GPU completion.',
        'GPU queries measure submitted rendering including shadows, when the extension is available; invalid queries remain null.',
        'rAF intervals precede current-row work and measure callback cadence, not actual presentation.',
        'Actual selection arrays are retained for one block and hashed after timing; retention changes GC lifetime equally for A/B.',
        'Upload byte instrumentation and GPU queries add overhead equally to both paths; there is no uninstrumented control in this run.',
        'All instances are submitted; frustum intersection and draw counts do not prove every surface is visible through occlusion.',
        'Only three trajectory images are compared pixel-for-pixel; all measured-frame selection IDs are checked.',
        ...(candidate==='guarded'?['Guarded candidate is experimental and conditional on its documented floating-point assumptions.']:[])]};
  } finally {
    if(!previewOwnsResources)cleanup();
  }
}

export async function runSceneComparison(canvas:HTMLCanvasElement,options:ComparisonOptions,onProgress?:(message:string)=>void):Promise<SceneComparisonResult>{
  const result=await executeSceneComparison(canvas,options,onProgress);
  if(typeof result==='function')throw new Error('Unexpected preview result');return result;
}
export async function startScenePreview(canvas:HTMLCanvasElement,options:ComparisonOptions,onFrame?:(metrics:PreviewMetrics)=>void):Promise<()=>void>{
  const result=await executeSceneComparison(canvas,options,undefined,{onFrame:onFrame??(()=>{})});
  if(typeof result!=='function')throw new Error('Unexpected campaign result');return result;
}
