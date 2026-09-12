import type { WorldOptions } from '../contracts.ts';
export interface WorldMatrixAxes {
  districts?:boolean; resolutions?:boolean; retina?:boolean; shadows?:boolean; methods?:boolean;
  fov?:boolean; antialias?:boolean; path?:boolean; shadowMapSize?:boolean;
}
/** Explicit Cartesian product; shadow-map sizes do not create duplicates when shadows are off. */
export function createWorldMatrix(base:WorldOptions,repeats:number,axes:WorldMatrixAxes):WorldOptions[] {
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)throw new Error('Choisir 1 à 3 répétitions.');
  let dimensions=axes.resolutions?[[1920,1080,1],[2560,1440,1],[3840,2160,1]]:[[base.width,base.height,base.pixelRatio]];
  if(axes.retina)dimensions.push([1920,1080,2]);
  dimensions=dimensions.filter((v,i,a)=>a.findIndex(other=>other.every((n,k)=>n===v[k]))===i);
  const runs:WorldOptions[]=[];
  for(let repeat=0;repeat<repeats;repeat++)
  for(const districts of axes.districts?[1,9,25] as const:[base.districts])
  for(const [width,height,pixelRatio] of dimensions)
  for(const shadows of axes.shadows?[false,true]:[base.shadows])
  for(const candidate of axes.methods?['frustum','hierarchy','shadow-cache','static-cache','adaptive-frustum','adaptive-coherent'] as const:[base.candidate])
  for(const fov of axes.fov?[45,60,90]:[base.fov??60])
  for(const antialias of axes.antialias?[false,true]:[base.antialias??false])
  for(const path of axes.path?['mixed','panorama','perimeter'] as const:[base.path??'mixed'])
  for(const shadowMapSize of axes.shadowMapSize&&shadows?[1024,2048,4096] as const:[base.shadowMapSize??2048])
    runs.push({...base,districts,width,height,pixelRatio,shadows,candidate,fov,antialias,path,shadowMapSize,order:repeat%2?'BAAB':'ABBA'});
  return runs;
}
export function worldMatrixTotals(runs:readonly WorldOptions[]) {
  const measuredFrames=runs.reduce((n,r)=>n+4*r.samples,0),warmupFrames=runs.reduce((n,r)=>n+5*r.warmup,0);
  // Each A, A-repeat and B capture has the same priming render at pose zero.
  const controlFrames=runs.reduce((n,r)=>n+6*new Set([0,Math.floor((r.samples-1)/2),r.samples-1]).size,0);
  return {campaigns:runs.length,measuredFrames,warmupFrames,controlFrames,totalFrames:measuredFrames+warmupFrames+controlFrames};
}
