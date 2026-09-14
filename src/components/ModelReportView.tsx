import { aaControlReason, summarizeModel, segmentNames, enginesInStills, type ModelReport } from '../lab/modelCampaign.ts';
import { modelNumber as number } from './modelFormat.ts';
import { ModelCaptureCompare, ModelStillCard } from './ModelCaptureCompare.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';
import { modelById } from '../../15-virtualized-integration/index.ts';

function engineLabel(id:string){return BENCH_ENGINES.find(engine=>engine.id===id)?.label??id;}

export function captureGridColumns(engineCount:number){
  if(engineCount>=4)return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
  if(engineCount===3)return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';
  if(engineCount===2)return 'grid-cols-1 sm:grid-cols-2';
  return 'grid-cols-1';
}

export function ModelReportView({ report, history = [] }: { report: ModelReport; history?: ModelReport[] }) {
  const engines = report.pathEngines?.length ? report.pathEngines : enginesInStills(report);
  const modelLabel = (report.configuration.modelId ? modelById(report.configuration.modelId)?.label : undefined) ?? report.configuration.modelId ?? 'Modèle';
  const global = summarizeModel(report.samples);
  return (
    <div className="space-y-4" data-model-report={report.id}>
      <ReportSummary title={`Résumé de navigation · ${modelLabel}`}>
        {report.error ? <p role="alert" className="text-sm text-error">{report.error}</p> : null}
        <p className="text-xs">{new Date(report.timestamp).toLocaleString('fr-FR')} · {report.configuration.cities} instance(s) du modèle · géométrie partagée · instances ×{report.multipliedInstances ?? report.configuration.cities} · {report.configuration.lodQuality ?? report.configuration.detail} · {(engines.length?engines: [report.configuration.engine]).map(engineLabel).join(' · ')} · {report.configuration.diagnostic} · {report.resolution.join(' × ')} px</p>
        <MetricGrid items={[
          { label: 'Première image depuis le clic', value: number(report.firstImageMs, 1), unit: 'ms' },
          { label: 'Préparation SDK', value: number(report.preparationMs, 1), unit: 'ms' },
          { label: 'Moteurs enchaînés', value: String((engines.length?engines:[report.configuration.engine]).length) },
          { label: 'Images observées', value: String(global.frames) },
          { label: 'Préchauffage exclu', value: String(report.warmupFrames), unit: 'images' },
          { label: 'Mode debug', value: report.configuration.debug ? 'Actif' : 'Désactivé / non enregistré' },
          { label: 'Journal moteur', value: String(report.engineEvents.length), unit: 'événements' },
          { label: 'GPU / VRAM', value: report.engineEvents.some(event=>event.phase==='engine:gpu-timing') ? 'Passes GPU dans le journal / VRAM non mesurée' : 'Non mesuré' },
        ]} />
      </ReportSummary>
      {(engines.length?engines:[report.configuration.engine]).map(engine=>{
        const samples=report.samples.filter(sample=>sample.backend===engine);
        const summary=summarizeModel(samples);
        return (
          <ReportSummary key={engine} title={`Moteur · ${engineLabel(engine)}`}>
            <MetricGrid items={[
              {label:'Images',value:String(samples.length)},
              {label:'CPU submit p50 / p95',value:summary.cpuSubmit?`${number(summary.cpuSubmit.p50,2)} / ${number(summary.cpuSubmit.p95,2)}`:'Non mesuré',unit:'ms'},
              {label:'CPU p50 / p95 / p99',value:summary.cpu?`${number(summary.cpu.p50,2)} / ${number(summary.cpu.p95,2)} / ${number(summary.cpu.p99,2)}`:'Non mesuré',unit:'ms'},
              {label:'rAF p50 / p95 / p99',value:summary.raf?`${number(summary.raf.p50,2)} / ${number(summary.raf.p95,2)} / ${number(summary.raf.p99,2)}`:'Non mesuré',unit:'ms'},
              {label:'FPS minimum',value:number(summary.minFps,1)},
            ]} />
          </ReportSummary>
        );
      })}
      {segmentNames.map((name, index) => {
        const samples = report.samples.filter(sample => sample.segment === index);
        const stills = report.captures.filter(item => item.segment === index);
        if (!samples.length && !stills.length) return null;
        return (
          <ReportSummary key={name} title={name}>
            <p className="text-xs">{samples.length} images mesurées · {stills.length} capture(s)</p>
            <div className={`grid ${captureGridColumns(engines.length)} gap-3 min-w-0`}>
              {stills.map(still => <ModelStillCard key={`${name}-${still.engine}`} still={still} title={`${name} · ${engineLabel(still.engine)}`} />)}
            </div>
          </ReportSummary>
        );
      })}
      <ModelCaptureCompare report={report} history={history} />
      <ReportSummary title="Provenance et limites">
        <p className="text-xs break-all">Source : {report.sourceKey} · trajet v{report.pathVersion} · {report.environment}</p>
        <p className="text-xs">CPU : durée de l’appel de rendu. Cadence : intervalles requestAnimationFrame. Chaque photo conserve pose, moteur, backend, résolution et compteurs. Les surcoûts des captures peuvent affecter l’intervalle rAF suivant.</p>
        {report.configuration.debug ? <p className="text-xs">Mode debug actif : l’instrumentation affecte les temps observés. Ces images sont des mesures de diagnostic.</p> : null}
        <p className="text-xs">{aaControlReason(report)}</p>
        {report.retainedSamplesOnly ? <p className="text-xs">Résumé limité aux 3 600 dernières images de l’exploration.</p> : null}
        {report.fallbacks.length ? <p className="text-xs">Replis observés : {report.fallbacks.join(' · ')}</p> : null}
        {report.error ? <p role="alert" className="text-xs">{report.error}</p> : null}
      </ReportSummary>
    </div>
  );
}
