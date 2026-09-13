import { summarizeEmerald, segmentNames, enginesInStills, type EmeraldReport } from '../lab/emeraldCampaign.ts';
import { emeraldNumber as number } from './emeraldFormat.ts';
import { EmeraldCaptureCompare, EmeraldStillCard } from './EmeraldCaptureCompare.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { BENCH_ENGINES } from '../../15-virtualized-integration/implementation/engines.ts';
import { modelById } from '../../15-virtualized-integration/index.ts';

function engineLabel(id:string){return BENCH_ENGINES.find(engine=>engine.id===id)?.label??id;}

export function EmeraldReportView({ report, history = [] }: { report: EmeraldReport; history?: EmeraldReport[] }) {
  const engines = report.pathEngines?.length ? report.pathEngines : enginesInStills(report);
  const modelLabel = modelById(report.configuration.modelId ?? 'emerald-square')?.label ?? report.configuration.modelId ?? 'Modèle inconnu';
  const global = summarizeEmerald(report.samples);
  return (
    <div className="space-y-4" data-emerald-report={report.id}>
      <ReportSummary title={`Résumé de navigation · ${modelLabel}`}>
        {report.error ? <p role="alert" className="text-sm text-error">{report.error}</p> : null}
        <p className="text-xs">{new Date(report.timestamp).toLocaleString('fr-FR')} · {report.configuration.cities} instance(s) du modèle · géométrie partagée · instances ×{report.multipliedInstances ?? report.configuration.cities} · {report.configuration.lodQuality ?? report.configuration.detail} · {(engines.length?engines: [report.configuration.engine]).map(engineLabel).join(' · ')} · {report.configuration.diagnostic} · {report.resolution.join(' × ')} px</p>
        <MetricGrid items={[
          { label: 'Première image depuis le clic', value: number(report.firstImageMs, 1), unit: 'ms' },
          { label: 'Préparation SDK', value: number(report.preparationMs, 1), unit: 'ms' },
          { label: 'Moteurs enchaînés', value: String((engines.length?engines:[report.configuration.engine]).length) },
          { label: 'Images observées', value: String(global.frames) },
          { label: 'Préchauffage exclu', value: String(report.warmupFrames), unit: 'images' },
          { label: 'GPU / VRAM', value: 'Non mesuré' },
          { label: 'CPU submit', value: 'Non mesuré', provenance: 'Soumission seule non instrumentée ; CPU frame couvre l’appel complet de rendu.' },
        ]} />
      </ReportSummary>
      {(engines.length?engines:[report.configuration.engine]).map(engine=>{
        const samples=report.samples.filter(sample=>sample.backend===engine);
        const summary=summarizeEmerald(samples);
        return (
          <ReportSummary key={engine} title={`Moteur · ${engineLabel(engine)}`}>
            <MetricGrid items={[
              {label:'Images',value:String(samples.length)},
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
            <div className={`grid grid-cols-1 ${stills.length>2?'xl:grid-cols-3':stills.length>1?'xl:grid-cols-2':''} gap-3 min-w-0`}>
              {stills.map(still => <EmeraldStillCard key={`${name}-${still.engine}`} still={still} title={`${name} · ${engineLabel(still.engine)}`} />)}
            </div>
          </ReportSummary>
        );
      })}
      <EmeraldCaptureCompare report={report} history={history} />
      <ReportSummary title="Provenance et limites">
        <p className="text-xs break-all">Source : {report.sourceKey} · trajet v{report.pathVersion} · {report.environment}</p>
        <p className="text-xs">CPU : durée de l’appel de rendu. Cadence : intervalles requestAnimationFrame. Chaque photo conserve pose, moteur, backend, résolution et compteurs. Les surcoûts des captures peuvent affecter l’intervalle rAF suivant.</p>
        <p className="text-xs">{report.comparisonReason ?? 'Comparaison visuelle uniquement. Aucun gain n’est déduit. GPU et VRAM restent non mesurés.'}</p>
        {report.retainedSamplesOnly ? <p className="text-xs">Résumé limité aux 3 600 dernières images de l’exploration.</p> : null}
        {report.fallbacks.length ? <p className="text-xs">Replis observés : {report.fallbacks.join(' · ')}</p> : null}
        {report.error ? <p role="alert" className="text-xs">{report.error}</p> : null}
      </ReportSummary>
    </div>
  );
}
