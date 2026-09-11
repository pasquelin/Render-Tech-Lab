import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BenchResultRecord } from '../shared/benchmark/types.ts';
import type { WorldOptions, WorldMode, WorldFrame, WorldBlock, WorldReport, WorldCapture, WorldSummary, WorldPreviewMetrics } from './worldTypes.ts';
export type { WorldOptions, WorldReport, WorldPreviewMetrics } from './worldTypes.ts';
const ASSET = '/benchmark-assets/bistro/bistro-exterior.glb';
const nowISO = () => new Date().toISOString();
const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
/** Valid only for a sphere enclosing every static descendant; shadow frusta are a union, never an intersection. */
export function districtIntersectsViews(sphere: THREE.Sphere, camera: THREE.Frustum, shadows: readonly THREE.Frustum[]): boolean {
  // Unknown bounds retain the district, as does a sphere tangent to a plane.
  if (!Number.isFinite(sphere.radius) || sphere.radius < 0 || !sphere.center.toArray().every(Number.isFinite)) return true;
  return camera.intersectsSphere(sphere) || shadows.some(frustum => frustum.intersectsSphere(sphere));
}
async function hash(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
}
function summary(values: Array<number | null>): WorldSummary {
  const a = values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a,b) => a-b);
  const q = (p: number) => a.length ? a[Math.floor((a.length-1)*p)] : null;
  return { p50:q(.5),p95:q(.95),p99:q(.99),mean:a.length?a.reduce((x,y)=>x+y,0)/a.length:null,validSamples:a.length };
}
export function validateWorldOptions(o: WorldOptions) {
  if(o.order!==undefined&&!['ABBA','BAAB'].includes(o.order))throw new Error('Ordre de comparaison invalide.');
  if ([o.wireframe,o.showBounds].some(v=>v!==undefined&&typeof v!=='boolean')) throw new Error('Options filaire/limites invalides.');
  if(o.previewDurationSeconds!==undefined&&(!Number.isFinite(o.previewDurationSeconds)||o.previewDurationSeconds<10||o.previewDurationSeconds>180)) throw new Error('Durée de prévisualisation : 10 à 180 secondes.');
  if (o.fov!==undefined&&(!Number.isFinite(o.fov)||o.fov<10||o.fov>120)) throw new Error('Champ de vision : 10 à 120 degrés.');
  if (o.antialias!==undefined&&typeof o.antialias!=='boolean') throw new Error('Anticrénelage invalide.');
  if (o.shadowMapSize!==undefined&&![1024,2048,4096].includes(o.shadowMapSize)) throw new Error('Résolution des ombres invalide.');
  if (o.path!==undefined&&!['mixed','panorama','perimeter'].includes(o.path)) throw new Error('Parcours inconnu.');
  if (![1,9,25].includes(o.districts)) throw new Error('Nombre de quartiers : 1, 9 ou 25.');
  if (![o.width,o.height].every(v=>Number.isInteger(v)&&v>0&&v<=4096) || !Number.isFinite(o.pixelRatio) || o.pixelRatio<=0) throw new Error('Dimensions physiques invalides (maximum 4096 par axe).');
  if (!Number.isInteger(o.samples)||o.samples<1||o.samples>600||!Number.isInteger(o.warmup)||o.warmup<1||o.warmup>600) throw new Error('Échantillonnage invalide (1 à 600).');
  if (!['frustum','hierarchy','shadow-cache','static-cache','adaptive-frustum','adaptive-coherent'].includes(o.candidate) || (o.previewMode&&!['brute','frustum','hierarchy','shadow-cache','static-cache','adaptive-frustum','adaptive-coherent'].includes(o.previewMode))) throw new Error('Variante inconnue.');
}
async function execute(canvas: HTMLCanvasElement, options: WorldOptions, progress: (message: string)=>void,
  signal?: AbortSignal, preview?: (metrics: WorldPreviewMetrics)=>void, onPreviewError?: (error: Error)=>void,
  onMetrics?: (metrics: WorldPreviewMetrics)=>void): Promise<WorldReport | (()=>void)> {
  validateWorldOptions(options);
  const config = {...options,fov:options.fov??60,antialias:options.antialias??false,shadowMapSize:options.shadowMapSize??2048,path:options.path??'mixed',wireframe:options.wireframe??false,showBounds:options.showBounds??false,previewDurationSeconds:options.previewDurationSeconds??60}, timestamp = nowISO(), preparationStart=performance.now();
  signal?.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({canvas,antialias:config.antialias,alpha:false});
  const gl=renderer.getContext() as WebGL2RenderingContext, scene=new THREE.Scene();
  const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
  const queries:Array<{query:WebGLQuery;sample:WorldFrame}>=[];
  let activeQuery:WebGLQuery|null=null, queryTarget:number|null=null;
  let environmentTarget:THREE.WebGLRenderTarget|null=null;
  let disposed=false, ownsPreview=false, request=0, hidden=document.visibilityState!=='visible';
  const visibility=()=>{if(document.visibilityState!=='visible')hidden=true;};
  document.addEventListener('visibilitychange',visibility);
  const cleanup=()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',visibility);
    signal?.removeEventListener('abort',cleanup);
    if(activeQuery){if(queryTarget!==null&&!gl.isContextLost())gl.endQuery(queryTarget);gl.deleteQuery(activeQuery);activeQuery=null;}
    queries.splice(0).forEach(item=>gl.deleteQuery(item.query));scene.environment=null;environmentTarget?.dispose();
    scene.traverse(o=>{if(o instanceof THREE.DirectionalLight||o instanceof THREE.SpotLight||o instanceof THREE.PointLight)o.shadow.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());const bitmaps=new Set<ImageBitmap>();
    textures.forEach(t=>{const data:unknown=t.source.data;
      for(const image of Array.isArray(data)?data:[data])if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap)bitmaps.add(image);
      t.dispose();});bitmaps.forEach(image=>image.close());renderer.dispose();
  };
  const check=()=>{signal?.throwIfAborted();if(disposed||gl.isContextLost())throw new Error('Contexte WebGL perdu ou arrêté.');
    if(!preview&&(hidden||document.visibilityState!=='visible'))throw new Error('Campagne interrompue : onglet masqué.');};
  const register=(root:THREE.Object3D)=>root.traverse(o=>{
    if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){
      materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);
    }}
  });
  try {
    check();
    if(gl.getContextAttributes()?.antialias!==config.antialias)throw new Error('Anticrénelage demandé indisponible ou contexte déjà créé avec une autre valeur : utiliser un canvas neuf.');
    const actualSamples=gl.getParameter(gl.SAMPLES) as number;
    const actualShadowMapSize=Math.min(config.shadowMapSize,THREE.MathUtils.floorPowerOfTwo(Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))));
    renderer.setPixelRatio(config.pixelRatio);renderer.setSize(config.width/config.pixelRatio,config.height/config.pixelRatio,false);
    const physical=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(physical.x!==config.width||physical.y!==config.height)throw new Error('Dimensions du drawing buffer incorrectes.');
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=config.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.info.autoReset=false;
    let shadowTriangles=0,shadowCalls=0,shadowLines=0,inShadow=false;
    const originalShadow=renderer.shadowMap.render;
    renderer.shadowMap.render=(...args)=>{const t=renderer.info.render.triangles,c=renderer.info.render.calls,l=renderer.info.render.lines;
      inShadow=true;
      try{originalShadow.apply(renderer.shadowMap,args);}finally{inShadow=false;}
      shadowTriangles=renderer.info.render.triangles-t;shadowCalls=renderer.info.render.calls-c;shadowLines=renderer.info.render.lines-l;};
    progress('Chargement du décor Bistro et de ses textures originales.');
    const response=await fetch(ASSET,{signal});if(!response.ok)throw new Error(`Chargement Bistro : HTTP ${response.status}.`);
    const buffer=await response.arrayBuffer();check();const assetHash=await hash(buffer);check();
    const gltf=await new GLTFLoader().parseAsync(buffer,'/benchmark-assets/bistro/');
    const source=gltf.scene;register(source);check();
    if(gltf.animations.length)throw new Error('Ce banc exige un décor statique sans animation.');
    source.traverse(o=>{if(o instanceof THREE.SkinnedMesh || (o instanceof THREE.Mesh&&o.morphTargetInfluences?.length))throw new Error('Déformation non prise en charge par les bornes statiques.');});
    source.updateMatrixWorld(true);
    const sourceBounds=new THREE.Box3().setFromObject(source,true),size=sourceBounds.getSize(new THREE.Vector3()),center=sourceBounds.getCenter(new THREE.Vector3());
    if(sourceBounds.isEmpty()||![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0))throw new Error('Bornes du décor invalides.');
    // Preserve glTF scale. Translation only: no invented conversion to metres.
    const shift=new THREE.Vector3(-center.x,-sourceBounds.min.y,-center.z),side=Math.sqrt(config.districts);
    const spacingX=size.x*1.08,spacingZ=size.z*1.08;
    const districts:Array<{group:THREE.Group;sphere:THREE.Sphere}>=[],meshes:THREE.Mesh[]=[];
    let sourceTrianglesPerDistrict=0,sourceMeshesPerDistrict=0;
    source.traverse(o=>{if(o instanceof THREE.Mesh){sourceMeshesPerDistrict++;sourceTrianglesPerDistrict+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
    for(let i=0;i<config.districts;i++){
      const group=new THREE.Group(),clone=i===0?source:source.clone(true);
      group.position.set((i%side-(side-1)/2)*spacingX,0,(Math.floor(i/side)-(side-1)/2)*spacingZ);
      const translation=new THREE.Group();translation.position.copy(shift);translation.add(clone);group.add(translation);scene.add(group);
      clone.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=config.shadows;o.receiveShadow=config.shadows;meshes.push(o);}
        if(o instanceof THREE.Light&&'castShadow'in o)o.castShadow=false;});
      group.updateMatrixWorld(true);const sphere=new THREE.Box3().setFromObject(group,true).getBoundingSphere(new THREE.Sphere());
      // Small outward numerical padding; no shrinking, no approximate occlusion test.
      sphere.radius+=64*Number.EPSILON*(sphere.radius+sphere.center.length()+1);districts.push({group,sphere});
      if(i%3===2){progress(`Décor résident : ${i+1}/${config.districts} quartiers.`);await nextFrame();check();}
    }
    const worldBounds=new THREE.Box3().setFromObject(scene,true),worldSize=worldBounds.getSize(new THREE.Vector3());
    const extent=Math.max(worldSize.x,worldSize.z,size.y),eyeHeight=size.y*.20;
    // Shared preparation only: procedural room lighting supplies the reflections required by metallic PBR materials.
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
    try{environmentTarget=pmrem.fromScene(room,.04);scene.environment=environmentTarget.texture;}
    finally{room.dispose();pmrem.dispose();}
    scene.background=new THREE.Color(0x9eb8ca);scene.add(new THREE.HemisphereLight(0xd6e6ff,0x80715b,2));
    const light=new THREE.DirectionalLight(0xffe5bd,3);light.position.set(extent*.3,extent,extent*.4);light.target.position.set(0,0,0);
    light.castShadow=config.shadows;light.shadow.mapSize.set(actualShadowMapSize,actualShadowMapSize);light.shadow.normalBias=size.y*.0003;
    Object.assign(light.shadow.camera,{left:-extent,right:extent,bottom:-extent,top:extent,near:.01,far:extent*4});light.shadow.camera.updateProjectionMatrix();
    scene.add(light,light.target);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(extent*3,extent*3),new THREE.MeshStandardMaterial({color:0x72726a,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-size.y*.001;ground.receiveShadow=config.shadows;scene.add(ground);register(ground);
    for(const material of materials)if(material instanceof THREE.MeshStandardMaterial)material.wireframe=config.wireframe;
    if(config.showBounds)for(const district of districts){
      const helper=new THREE.Box3Helper(new THREE.Box3().setFromObject(district.group,true),0xffff00);
      helper.castShadow=false;helper.frustumCulled=false;scene.add(helper);geometries.add(helper.geometry);
      for(const material of Array.isArray(helper.material)?helper.material:[helper.material])materials.add(material);
    }
    scene.updateMatrixWorld(true);light.shadow.updateMatrices(light);
    const shadowFrusta=config.shadows?[light.shadow.getFrustum().clone()]:[];
    const camera=new THREE.PerspectiveCamera(config.fov,config.width/config.height,Math.max(.01,size.y*.0003),extent*6);
    const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
    const pose=(index:number)=>{
      const t=(index%config.samples)/Math.max(1,config.samples-1);
      if(config.path==='panorama'||(config.path==='mixed'&&t<.4)){const u=config.path==='panorama'?t:t/.4;const angle=Math.PI*.2+u*Math.PI*.9;
        camera.position.set(Math.sin(angle)*extent*1.05,extent*.65,Math.cos(angle)*extent*1.05);camera.lookAt(0,size.y*.25,0);
      }else{const u=config.path==='perimeter'?t:(t-.4)/.6;camera.position.set((u-.5)*worldSize.x,eyeHeight,worldBounds.max.z+size.z*.12);
        camera.lookAt(camera.position.x+Math.sin(u*Math.PI*2)*size.x*.25,eyeHeight*.9,0);
      }
      camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
    };
    const sphereEntries=meshes.map(mesh=>{
      if(mesh.geometry.boundingSphere===null)mesh.geometry.computeBoundingSphere();
      const sphere=mesh.geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
      return {mesh,sphere,lastPlane:0,margin:-Infinity,centerLength:sphere.center.length()*(1+16*Number.EPSILON)+16*Number.EPSILON,mask:mesh.layers.mask,test:mesh.layers.test};
    });
    let mode:WorldMode|null=null,activeDistricts=config.districts as number,shadowMapReused=false;
    let adaptivePlaneTests=0,adaptiveRejectedMeshes=0,adaptiveCertifiedMeshes=0,selectionMismatches=0;
    const isAdaptive=(value:WorldMode|null)=>value==='adaptive-frustum'||value==='adaptive-coherent';
    const previousPlanes=new Float64Array(24);let havePreviousPlanes=false,deltaNormal=0,deltaConstant=0,constantScale=1;
    const prepareCoherence=()=>{
      deltaNormal=deltaConstant=0;constantScale=1;
      for(let i=0;i<6;i++){
        const p=frustum.planes[i],k=i*4;
        if(havePreviousPlanes){deltaNormal=Math.max(deltaNormal,Math.hypot(p.normal.x-previousPlanes[k],p.normal.y-previousPlanes[k+1],p.normal.z-previousPlanes[k+2]));deltaConstant=Math.max(deltaConstant,Math.abs(p.constant-previousPlanes[k+3]));}
        constantScale=Math.max(constantScale,Math.abs(p.constant),Math.abs(previousPlanes[k+3]));
        previousPlanes[k]=p.normal.x;previousPlanes[k+1]=p.normal.y;previousPlanes[k+2]=p.normal.z;previousPlanes[k+3]=p.constant;
      }
      deltaNormal+=64*Number.EPSILON;deltaConstant+=64*Number.EPSILON*constantScale;havePreviousPlanes=true;
    };
    const adaptiveVisible=(entry:typeof sphereEntries[number])=>{
      const {sphere}=entry,rounding=64*Number.EPSILON*(entry.centerLength+sphere.radius+constantScale+1);
      if(mode==='adaptive-coherent'){
        entry.margin-=deltaNormal*entry.centerLength+deltaConstant+rounding;
        if(entry.margin>0){adaptiveCertifiedMeshes++;return true;}
      }
      let margin=Infinity;const first=entry.lastPlane;
      for(let j=0;j<6;j++){
        const i=j===0?first:j<=first?j-1:j;adaptivePlaneTests++;
        const distance=frustum.planes[i].distanceToPoint(sphere.center);
        if(distance < -sphere.radius){entry.lastPlane=i;entry.margin=-Infinity;return false;}
        margin=Math.min(margin,distance+sphere.radius);
      }
      entry.margin=margin-rounding;return true;
    };
    const cachesShadow=(value:WorldMode)=>value==='shadow-cache'||value==='static-cache';
    const setMode=(next:WorldMode)=>{
      if(next===mode)return;
      // The scene has no animations, skinning, morphs, callbacks or mutable lights/materials.
      // Every configuration owns a fresh renderer. Mode switches invalidate the shadow map.
      scene.updateMatrixWorld(true);
      scene.matrixWorldAutoUpdate=next!=='static-cache';
      renderer.shadowMap.autoUpdate=!cachesShadow(next);
      renderer.shadowMap.needsUpdate=true;
      light.shadow.needsUpdate=true;
      mode=next;
      for(const entry of sphereEntries){
        const {mesh}=entry;mesh.layers.mask=entry.mask;mesh.layers.test=entry.test;
        Object.defineProperty(mesh,'frustumCulled',{value:next!=='brute',writable:true,configurable:true,enumerable:true});
        entry.margin=-Infinity;
        if(isAdaptive(next)){
          // Main visibility is computed below. Shadows retain the original layers and Three.js culling.
          Object.defineProperty(mesh,'frustumCulled',{get:()=>inShadow,configurable:true,enumerable:true});
          mesh.layers.test=layers=>((inShadow?entry.mask:mesh.layers.mask)&layers.mask)!==0;
        }
      }
      ground.frustumCulled=next!=='brute';
    };
    const cull=()=>{activeDistricts=0;adaptivePlaneTests=adaptiveRejectedMeshes=adaptiveCertifiedMeshes=0;
      if(mode==='adaptive-coherent')prepareCoherence();
      for(const d of districts){d.group.visible=mode!=='hierarchy'||districtIntersectsViews(d.sphere,frustum,shadowFrusta);if(d.group.visible)activeDistricts++;}
      if(isAdaptive(mode))for(const entry of sphereEntries){const visible=adaptiveVisible(entry);entry.mesh.layers.mask=visible?entry.mask:0;if(!visible)adaptiveRejectedMeshes++;}
    };
    const render=()=>{renderer.info.reset();shadowTriangles=shadowCalls=shadowLines=0;
      shadowMapReused=config.shadows&&!renderer.shadowMap.autoUpdate&&!renderer.shadowMap.needsUpdate;
      renderer.render(scene,camera);};
    const counts=()=>({triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,mainPassLines:renderer.info.render.lines-shadowLines,shadowPassLines:shadowLines,drawCalls:renderer.info.render.calls,
      mainPassTriangles:renderer.info.render.triangles-shadowTriangles,shadowPassTriangles:shadowTriangles,
      mainPassDrawCalls:renderer.info.render.calls-shadowCalls,shadowPassDrawCalls:shadowCalls,activeDistricts,shadowMapReused,
      adaptivePlaneTests:isAdaptive(mode)?adaptivePlaneTests:null,adaptiveRejectedMeshes:isAdaptive(mode)?adaptiveRejectedMeshes:null,adaptiveCertifiedMeshes:mode==='adaptive-coherent'?adaptiveCertifiedMeshes:null});
    const debug=gl.getExtension('WEBGL_debug_renderer_info'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;
    const environment={browser:navigator.userAgent,threeVersion:THREE.REVISION,backend:'WebGL2',gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
      renderer:gl.getParameter(gl.RENDERER),glVersion:gl.getParameter(gl.VERSION),timerQueryAvailable:!!timer,visibility:document.visibilityState,
      devicePixelRatio,physicalWidth:physical.x,physicalHeight:physical.y,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,
      rendererLogicalWidth:config.width/config.pixelRatio,rendererLogicalHeight:config.height/config.pixelRatio,displaySizing:'shared viewport; object-fit contain; physical drawing buffer fixed independently',
      antialiasRequested:config.antialias,antialiasActual:gl.getContextAttributes()?.antialias,defaultFramebufferSamples:actualSamples,renderPixelRatio:config.pixelRatio,performanceTimeOrigin:performance.timeOrigin,
      thermalState:'not measured',telemetry:'same UI callbacks in A/B; system CPU and OS memory sampled every 2 seconds'};
    const sceneInfo={asset:ASSET,assetSha256:assetHash,assetBytes:buffer.byteLength,fixture:'static-resident-bistro-exterior-district-grid',districts:config.districts,wireframe:config.wireframe,showBounds:config.showBounds,debugLinesIncluded:config.showBounds,debugBoundsHelpers:config.showBounds?config.districts:0,previewDurationSeconds:config.previewDurationSeconds,
      sourceMeshesPerDistrict,sourceTrianglesPerDistrict,sourceTriangles:sourceTrianglesPerDistrict*config.districts,
      optimizationDomain:'static resident scene; fixed directional light, shadow projection, geometry, materials, alpha, textures and camera layers; only main camera pose changes',
      reference:'unchanged Three.js per-mesh frustum culling, world matrices and shadow map recomputed each render',
      shadowCacheInvalidation:'fresh renderer per configuration; forced rebuild on mode entry; not valid for changing casters/lights/materials/visibility/layers without invalidation',
      matrixCacheProof:'W_i = W_parent * L_i; immutable local transforms and parent links imply immutable world matrices by induction; camera remains updated',
      sharedGeometryCount:geometries.size,sharedMaterialCount:materials.size,sharedTextureCount:textures.size,
      sourceBounds:{min:sourceBounds.min.toArray(),max:sourceBounds.max.toArray()},translation:shift.toArray(),uniformScale:1,
      unit:'glTF asset units at scale 1; exporter unit conversion recorded in asset manifest',districtSpacing:[spacingX,spacingZ],eyeHeight,eyeHeightPolicy:'20 percent of source vertical bounds above translated lowest point; verify street clearance in preview',
      fov:camera.fov,near:camera.near,far:camera.far,shadowMapSize:config.shadows?[actualShadowMapSize,actualShadowMapSize]:null,shadowMapSizeRequested:config.shadowMapSize,
      path:config.path,pathDescription:config.path==='mixed'?'elevated-wide-panorama-first-40-percent-then-perimeter-ground-level':config.path,environmentLighting:'Three RoomEnvironment PMREM generated once during preparation; identical A/B; no external texture',geometryAttributeBytes:Array.from(geometries).reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0)};
    const baseline:WorldMode=config.candidate==='frustum'?'brute':'frustum';
    setMode(preview?(config.previewMode??baseline):baseline);pose(0);cull();
    if(preview){
      let elapsedMs=0,previous:number|null=null;
      const tick=(time:number)=>{if(disposed)return;if(document.visibilityState!=='visible'){previous=null;request=requestAnimationFrame(tick);return;}
        try{check();const begin=performance.now();if(previous!==null)elapsedMs+=time-previous;
          const fraction=(elapsedMs%(config.previewDurationSeconds*1000))/(config.previewDurationSeconds*1000);
          pose(fraction*Math.max(1,config.samples-1));cull();const culled=performance.now();render();const rendered=performance.now();
          preview({...counts(),sourceTriangles:sourceTrianglesPerDistrict*config.districts,sourceMeshes:sourceMeshesPerDistrict*config.districts,cpuFrameWorkMs:rendered-begin,
            cpuCullMs:culled-begin,cpuRenderSubmitMs:rendered-culled,gpuMs:null,gpuTimerAvailable:false,variant:mode!,phase:'preview',rafDeltaMs:previous===null?null:time-previous});
          previous=time;request=requestAnimationFrame(tick);}catch(error){cleanup();const failure=error instanceof Error?error:new Error(String(error));onPreviewError?.(failure);}};
      signal?.throwIfAborted();ownsPreview=true;signal?.addEventListener('abort',cleanup,{once:true});request=requestAnimationFrame(tick);return cleanup;
    }
    // Prepare the complete camera path before testing steady-state image equality.
    // Keep cold failures archived; this does not certify first-use rendering.
    progress(`Échauffement commun avant contrôle des images : ${config.warmup} images.`);
    for(let i=0;i<config.warmup;i++){await nextFrame();check();pose(i*(config.samples-1)/Math.max(1,config.warmup-1));cull();render();}
    const preparationMs=performance.now()-preparationStart,qualityStart=performance.now(),captures:WorldCapture[]=[],blocks:WorldBlock[]=[];
    const limitations=[
      'Static resident repetitions of the original Bistro exterior, not streaming terrain or a complete game; source geometry is shared between districts.',
      'Source triangle counts are distinct from submitted main/shadow triangles; visibility and submission counts may legitimately differ between culling variants.',
      'Captures read the default canvas framebuffer immediately after render, including the same ACES tone mapping and sRGB output as measured frames.',
      'Each quality capture A, A-repeat and B is preceded by one identical priming render at pose zero. Cold first-use rendering is not certified by these steady-state controls; rejected cold captures remain archived.',
      `Common reference preparation traverses the full camera path for ${config.warmup} frames before quality captures; its cost is included in preparationMs. Per-block warmup remains separate.`,
      'Exact pixel equality is checked only at three deterministic poses and this configuration; it is not a universal correctness proof.',
      'Adaptive-coherent: a conservative visible margin is decreased by max(norm(delta plane normal))*norm(center) + max(abs(delta plane constant)), padded for roundoff. Only a strictly positive remaining margin permits reusing visibility; otherwise exact tests run. This is adaptive to every camera change, not a reuse of unverified old decisions.',
      'Adaptive-frustum uses the same transformed bounding spheres and exact six plane predicates as Three.js. The last rejecting plane is tried first; visibility is recomputed every frame. Static world bounds must be invalidated when geometry/transforms change. Shadow culling and rendering remain unchanged.',
      'rAF intervals measure callback cadence, not scanout or input latency. CPU submission time is not GPU execution time.',
      'GPU timings are null if unsupported, disjoint, invalid or still pending after the bounded drain; no synchronizing GPU finish is used.',
      'Hierarchy bounds require static geometry. Shadow-frustum union can retain every district, so no gain is presumed with shadows.',
      'No LOD, decimation, material simplification or occlusion approximation is applied. Geometry byte counts exclude textures, driver copies and full GPU residency.',
      'Shadow-cache and static-cache only reuse invariant outputs in this static fixture. First shadow production is included in preparation/warmup, not claimed as a steady-state saving. Animated scenes and streaming are not certified.',
    ];
    const checkedFrames=Array.from(new Set([0,Math.floor((config.samples-1)/2),config.samples-1]));
    const capture=(variant:WorldMode,index:number)=>{check();setMode(variant);
      // Identical priming for A, A-repeat and B. This also exercises a reused map
      // after a different main-camera pose, rather than rebuilding at the capture pose.
      pose(0);cull();renderer.setRenderTarget(null);render();
      pose(index);cull();renderer.setRenderTarget(null);render();
      if(isAdaptive(variant))for(const entry of sphereEntries){if((entry.mesh.layers.mask!==0)!==frustum.intersectsObject(entry.mesh))selectionMismatches++;}
      const out=new Uint8Array(config.width*config.height*4);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer de qualité incomplet.');
      gl.readPixels(0,0,config.width,config.height,gl.RGBA,gl.UNSIGNED_BYTE,out);
      if(gl.getError()!==gl.NO_ERROR)throw new Error('Lecture des pixels invalide.');renderer.setRenderTarget(null);return out;};
    const report=(passed:boolean,failure?:string):WorldReport=>{
      const records:BenchResultRecord[]=blocks.map(block=>({timestamp,test:`14-open-world:${block.variant}`,commit:null,status:'measured',verdict:'WATCHLIST',
        environment:{gpu:environment.gpu,browser:navigator.userAgent,threeVersion:THREE.REVISION},scene:{objects:sourceMeshesPerDistrict*config.districts,triangles:sceneInfo.sourceTriangles,materials:materials.size},
        cpu:{frameMs:block.summary.cpuFrameWorkMs.p50,p95Ms:block.summary.cpuFrameWorkMs.p95,p99Ms:block.summary.cpuFrameWorkMs.p99,fps:null},gpu:{frameMs:block.summary.gpuMs.p50},memory:{gpuBytes:null},draw:{submitted:null,visible:null},
        customMetrics:{mode:block.variant,summary:block.summary,qualityPassed:passed}}));
      if(!passed)records.push({timestamp,test:'14-open-world:quality',commit:null,status:'not-run',verdict:'REJECT',environment:{browser:navigator.userAgent,threeVersion:THREE.REVISION},scene:{triangles:sceneInfo.sourceTriangles},cpu:{frameMs:null},gpu:{frameMs:null},memory:{gpuBytes:null},draw:{submitted:null},customMetrics:{failure}});
      return {timestamp,config,environment,scene:sceneInfo,quality:{passed,captures,checkedFrames,...(failure?{failure}:{})},blocks,records,limitations,preparationMs,qualityMs:performance.now()-qualityStart};
    };
    for(const index of checkedFrames){progress(`Vérification visuelle exacte : image ${index+1}/${config.samples}.`);await nextFrame();check();
      const a=capture(baseline,index),repeat=capture(baseline,index),b=capture(config.candidate,index);
      let repeatDifferentBytes=0,candidateDifferentBytes=0,maxChannelDifference=0;
      for(let i=0;i<a.length;i++){if(a[i]!==repeat[i])repeatDifferentBytes++;if(a[i]!==b[i])candidateDifferentBytes++;maxChannelDifference=Math.max(maxChannelDifference,Math.abs(a[i]-b[i]));}
      captures.push({index,baselineHash:await hash(a),repeatHash:await hash(repeat),candidateHash:await hash(b),repeatDifferentBytes,candidateDifferentBytes,maxChannelDifference,
        candidateShadowPassTriangles:shadowTriangles,cachedShadowChecked:shadowMapReused});
    }
    const qualityMs=performance.now()-qualityStart;
    if(selectionMismatches)return report(false,`${selectionMismatches} décisions de visibilité diffèrent de Three.js : campagne rejetée.`);
    if(captures.some(c=>c.repeatDifferentBytes||c.candidateDifferentBytes))return report(false,'Différence de pixels : la campagne de performance n’a pas été exécutée.');
    const allSamples:WorldFrame[]=[];let gpuDisjointEvents=0,lastGpuMs:number|null=null;
    const poll=()=>{if(!timer)return;const disjoint=Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT));
      if(disjoint){gpuDisjointEvents++;lastGpuMs=null;allSamples.forEach(s=>s.gpuMs=null);queries.splice(0).forEach(item=>gl.deleteQuery(item.query));return;}
      for(let i=queries.length-1;i>=0;i--){const item=queries[i];if(gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){
        const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);item.sample.gpuMs=typeof ns==='number'&&Number.isFinite(ns)&&ns>=0?ns/1e6:null;
        lastGpuMs=item.sample.gpuMs;gl.deleteQuery(item.query);queries.splice(i,1);}}};
    const sequence:WorldMode[]=config.order==='BAAB'?[config.candidate,baseline,baseline,config.candidate]:[baseline,config.candidate,config.candidate,baseline];
    for(const [blockIndex,variant] of sequence.entries()){
      check();setMode(variant);progress(`Bloc ${blockIndex+1}/4 : ${variant}, échauffement puis ${config.samples} images.`);
      let warmPrevious:number|null=null;
      for(let i=0;i<config.warmup;i++){
        const raf=await nextFrame();check();const begin=performance.now();pose(i);cull();const culled=performance.now();render();const rendered=performance.now();poll();
        onMetrics?.({...counts(),sourceTriangles:sourceTrianglesPerDistrict*config.districts,sourceMeshes:sourceMeshesPerDistrict*config.districts,
          cpuFrameWorkMs:rendered-begin,cpuCullMs:culled-begin,cpuRenderSubmitMs:rendered-culled,rafDeltaMs:warmPrevious===null?null:raf-warmPrevious,
          gpuMs:null,gpuTimerAvailable:false,variant,phase:'warmup'});warmPrevious=raf;
        if(i%30===29)progress(`Bloc ${blockIndex+1}/4 : échauffement ${i+1}/${config.warmup}.`);
      }
      const block:WorldBlock={variant,startedAt:nowISO(),samples:[],summary:{}};let previous:number|null=null;
      for(let index=0;index<config.samples;index++){
        check();const raf=await nextFrame();check();poll();const begin=performance.now();pose(index);cull();const culled=performance.now();
        const query=timer&&queries.length<16?gl.createQuery():null;
        if(query&&timer){activeQuery=query;queryTarget=timer.TIME_ELAPSED_EXT;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
        const renderStart=performance.now();render();const rendered=performance.now();
        if(query&&timer){gl.endQuery(timer.TIME_ELAPSED_EXT);activeQuery=null;}
        const sample:WorldFrame={index,timestamp:nowISO(),rafTimestampMs:raf,rafDeltaMs:previous===null?null:raf-previous,cpuCullMs:culled-begin,
          cpuRenderSubmitMs:rendered-renderStart,cpuFrameWorkMs:performance.now()-begin,gpuMs:null,...counts()};
        block.samples.push(sample);allSamples.push(sample);if(query)queries.push({query,sample});previous=raf;
        onMetrics?.({...sample,gpuMs:lastGpuMs,gpuTimerAvailable:!!timer,variant,phase:'measure',sourceTriangles:sourceTrianglesPerDistrict*config.districts,sourceMeshes:sourceMeshesPerDistrict*config.districts});
        if(index%30===29)progress(`Bloc ${blockIndex+1}/4 : ${index+1}/${config.samples} images mesurées.`);
      }
      blocks.push(block);
    }
    progress('Collecte non bloquante des dernières durées GPU.');
    for(let i=0;i<120&&queries.length;i++){await nextFrame();check();poll();}
    for(const block of blocks)block.summary=Object.fromEntries((['cpuCullMs','cpuRenderSubmitMs','cpuFrameWorkMs','rafDeltaMs','gpuMs','mainPassTriangles','shadowPassTriangles','mainPassDrawCalls','shadowPassDrawCalls','lines','mainPassLines','shadowPassLines','activeDistricts'] as const).map(key=>[key,summary(block.samples.map(s=>s[key]))]));
    const result=report(true);result.qualityMs=qualityMs;result.environment.gpuDisjointEvents=gpuDisjointEvents;result.environment.gpuUnresolvedQueries=queries.length;return result;
  } finally {if(!ownsPreview)cleanup();}
}
export async function runWorldComparison(canvas:HTMLCanvasElement,options:WorldOptions,onProgress:(message:string)=>void=()=>{},signal?:AbortSignal,onMetrics?:(metrics:WorldPreviewMetrics)=>void):Promise<WorldReport>{
  return await execute(canvas,options,onProgress,signal,undefined,undefined,onMetrics) as WorldReport;
}
export async function startWorldPreview(canvas:HTMLCanvasElement,options:WorldOptions,onFrame:(metrics:WorldPreviewMetrics)=>void=()=>{},signal?:AbortSignal,onError?:(error:Error)=>void):Promise<()=>void>{
  return await execute(canvas,options,()=>{},signal,onFrame,onError) as ()=>void;
}
