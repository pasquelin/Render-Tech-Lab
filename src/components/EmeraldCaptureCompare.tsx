import { segmentNames, stillsComparable, type EmeraldReport, type EmeraldStill } from '../lab/emeraldCampaign.ts';
import { emeraldNumber as number } from './emeraldFormat.ts';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';

function engineLabel(id:string){return BENCH_ENGINES.find(engine=>engine.id===id)?.label??id;}

export function stillFacts(still:EmeraldStill){
 return [
  {label:'Moteur',value:engineLabel(still.engine)},
  {label:'Backend',value:still.backend},
  {label:'Vue',value:still.diagnostic},
  {label:'LOD',value:still.lodQuality},
  {label:'Étendue',value:`${still.cities} instance(s) du modèle`},
  {label:'Résolution',value:`${still.resolution.join(' × ')} px`},
  {label:'FOV / near / far',value:`${number(still.fov,1)}° / ${number(still.near,3)} / ${number(still.far,1)}`},
  {label:'Position',value:still.pose.position.map(value=>number(value,2)).join(' · ')},
  {label:'Cible',value:still.pose.target.map(value=>number(value,2)).join(' · ')},
  {label:'CPU frame',value:number(still.cpuFrameMs,2),unit:'ms'},
  {label:'rAF',value:number(still.rafIntervalMs,2),unit:'ms'},
  {label:'Draw calls',value:number(still.drawCalls)},
  {label:'Triangles soumis',value:number(still.triangles)},
  {label:'Triangles sélectionnés',value:number(still.selectedTriangles)},
  {label:'Clusters',value:number(still.clusters)},
  {label:'Pages résidentes',value:number(still.residentPages)},
  {label:'Évictions',value:number(still.pageEvictions)},
  {label:'Frustum rejeté',value:number(still.frustumRejected)},
  {label:'GPU / VRAM',value:'Non mesuré'},
  {label:'Prise',value:new Date(still.takenAt).toLocaleString('fr-FR')},
  {label:'Cache',value:still.sourceKey},
 ];
}

export function EmeraldStillCard({still,title}:{still:EmeraldStill;title:string}){
 return (
  <figure className="space-y-2 min-w-0">
   <img src={still.image} alt={title} className="w-full max-w-full rounded-box" />
   <figcaption className="text-xs font-medium">{title}</figcaption>
   <MetricGrid items={stillFacts(still)} />
  </figure>
 );
}

export function EmeraldCaptureCompare({report,history}:{report:EmeraldReport;history:EmeraldReport[]}){
 const peer=history.find(other=>other.id!==report.id&&stillsComparable(report,other).status==='comparable');
 if(!peer)return null;
 const comparison=stillsComparable(report,peer);
 return (
  <ReportSummary title="Comparaison visuelle des captures">
   <p className="text-xs">{engineLabel(report.configuration.engine)} · {engineLabel(peer.configuration.engine)}. {comparison.reason}</p>
   {comparison.segments.map(segment=>{
    const left=report.captures.find(item=>item.segment===segment)!;
    const right=peer.captures.find(item=>item.segment===segment)!;
    const name=segmentNames[segment]??left.name;
    return (
     <div key={segment} className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
      <EmeraldStillCard still={left} title={`${name} · ${engineLabel(left.engine)}`} />
      <EmeraldStillCard still={right} title={`${name} · ${engineLabel(right.engine)}`} />
     </div>
    );
   })}
  </ReportSummary>
 );
}
