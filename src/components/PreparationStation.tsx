import { IntegrationSceneCards } from './IntegrationSceneCards.tsx';
import { useEffect, useState, type ReactNode } from 'react';
import { Activity, FileText, Play } from 'lucide-react';
import { useLab } from './LabContext.tsx';
import { MODULE_DESCRIPTORS } from '../lab/modules.ts';
import { moduleDescription } from '../lab/modulePresentation.ts';
import { moduleTitle } from '../lab/catalog.ts';
import { executionSteps, type CampaignSummary } from '../lab/execution.ts';
import { campaignSummary } from '../lab/campaignSummary.ts';
import { isIntegratedRunnerId } from '../../bench/runners.ts';
import { Button } from './ui/Button.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { EmptyState } from './ui/EmptyState.tsx';
import { StatusBadge } from './ui/StatusBadge.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';

export function CampaignResult({ summary }: { summary: CampaignSummary | null }) {
  if (!summary) return <EmptyState title="Aucune campagne mesurée disponible"><p className="text-sm text-base-content/60">Lancez une campagne depuis le panneau de droite pour archiver des mesures.</p></EmptyState>;
  return <section className="space-y-3" aria-label="Dernière campagne mesurée">
    <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70"><time dateTime={summary.timestamp}>{new Date(summary.timestamp).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</time><StatusBadge tone="outline">{summary.status}</StatusBadge><span className="basis-full sm:basis-auto break-words [overflow-wrap:anywhere]">{summary.configuration}</span></div>
    {summary.scenarioChecks?.length ? <div className="grid grid-cols-1 md:grid-cols-3 gap-2" aria-label="Résumé des scénarios du banc 15">{summary.scenarioChecks.map(check => <article key={check.id} className="min-w-0 rounded-box border border-base-content/10 bg-base-200 p-3 space-y-1"><h3 className="text-xs font-semibold break-words">{check.label}</h3><p className="text-[11px] text-base-content/65">Contrôles A : {check.a} · B : {check.b}</p><p className="text-[11px] font-mono text-primary">{check.quality}</p></article>)}</div> : null}
    <div className="grid min-w-0 grid-cols-1 xl:grid-cols-2 gap-4">{summary.series.map(series => {
      const max = Math.max(...series.values, 0.001);
      const points = series.values.map((v, i) => `${10 + i * 180 / Math.max(1, series.values.length - 1)},${45 - 35 * v / max}`).join(' ');
      return <div key={series.label} className="min-w-0 max-w-full border-l-2 border-primary/60 pl-3 break-words [overflow-wrap:anywhere]">
        <p className="text-xs font-mono truncate" title={series.label}>{series.label}</p>
        <p className="text-lg font-mono text-primary">{series.values.at(-1)?.toFixed(2) ?? 'Non mesuré'} <span className="text-xs text-base-content/60">{series.unit}</span></p>
        {series.values.length > 0 && <svg viewBox="0 0 200 50" className="block w-full max-w-full h-12 text-primary" role="img" aria-label={`${series.label} : ${series.values.join(', ')} ${series.unit}`}>
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
          {series.values.map((value, point) => <circle key={`${series.label}-${point}`} cx={10 + point * 180 / Math.max(1, series.values.length - 1)} cy={45 - 35 * value / max} r="2" fill="currentColor" />)}
        </svg>}
      </div>;
    })}</div>
  </section>;
}

export type PreparationPresentation={description:string;question:string;protocol:string;steps:string[];metadata:Array<[string,string]>};
export function PreparationStation({presentation,children,footer}:{presentation?:PreparationPresentation;children?:ReactNode;footer?:ReactNode}={}) {
  const { state, actions } = useLab();
  const [history, setHistory] = useState<{ moduleId: string; summary: CampaignSummary | null } | null>(null);
  useEffect(() => {
    if(presentation) return;
    const api = state.moduleId === '04-gpu-lod' ? '/api/lod-comparison' : '/api/world-comparison';
    const abort = new AbortController();
    void (async () => {
      try {
        if (state.moduleId !== '04-gpu-lod' && state.moduleId !== '14-open-world') {
          const saved = await fetch(`/api/get-latest?testId=${encodeURIComponent(state.moduleId)}`, { signal: abort.signal });
          if (saved.ok) {
            const summary = campaignSummary(await saved.json());
            if (!abort.signal.aborted) setHistory({ moduleId: state.moduleId, summary });
          }
          return;
        }
        const response = await fetch(`${api}/history`, { signal: abort.signal });
        if (!response.ok) return;
        const data = await response.json();
        const candidates = (data.runs ?? []).filter((run: { config?: { backend?: string } }) => state.moduleId !== '04-gpu-lod' || run.config?.backend === 'webgpu-native');
        for (const candidate of candidates) {
          if (typeof candidate.jsonUrl !== 'string' || !candidate.jsonUrl.startsWith(`${api}?`)) continue;
          const saved = await fetch(candidate.jsonUrl, { signal: abort.signal });
          if (!saved.ok) continue;
          const summary = campaignSummary(await saved.json());
          if (summary) {
            if (!abort.signal.aborted) setHistory({ moduleId: state.moduleId, summary });
            return;
          }
        }
      } catch { /* No available archive is never replaced with simulated values. */ }
    })();
    return () => abort.abort();
  }, [state.moduleId,Boolean(presentation)]);
  const execution = state.execution;
  const integrationPending = state.moduleId === '15-virtualized-integration' && !isIntegratedRunnerId(state.moduleId);
  const terminal = execution.status === 'completed' || execution.status === 'stopped' || execution.status === 'error';
  const description = presentation?.description ?? moduleDescription(state.moduleId);
  const desc = MODULE_DESCRIPTORS[state.moduleId];
  const archivedSummary = history?.moduleId === state.moduleId ? history.summary : null;
  const summary = execution.lastCampaign ?? archivedSummary;
  const native = state.moduleId === '04-gpu-lod';
  const algorithmic = new Set(['05-meshlets', '06-meshlet-culling', '07-hiz', '08-occlusion-culling', '10-material-batching', '11-geometry-streaming', '12-visibility-buffer', '13-full-gpu-driven']).has(state.moduleId);
  const actionLabel = state.benchLabel;
  const backend = native ? 'WebGPU natif · calcul CPU / WGSL' : state.moduleId === '14-open-world' ? 'Three.js WebGL2 résident' : state.telemetryMode;
  const comparison = native ? 'A : sélection CPU de référence · B : sélection WGSL · même raster WebGPU' : state.moduleId === '01-indirect-draw' ? 'A : Three.js WebGL · B : rendu indirect WebGPU natif' : state.moduleId === '03-gpu-scene' ? 'A : multi-maillages Three.js · B : scène hétérogène WebGPU' : state.moduleId === '14-open-world' ? 'A : référence Three.js · B : variante sélectionnée dans les réglages, même backend WebGL2' : 'Variantes et protocole : consulter le rapport du banc.';
  if (state.moduleId === '00-baseline') return <section className="w-full h-full min-w-0 min-h-0 flex-1 bg-base-100 overflow-auto p-6 md:p-10 space-y-5" aria-label="Référence de consultation">
    <p className="text-xs font-mono text-primary">Référence de consultation · Three.js</p>
    <h1 className="text-2xl font-semibold">Dashboard</h1>
    <p className="text-sm leading-relaxed w-full">{description}</p>
    <p className="text-sm text-base-content/70">La baseline sert de témoin pour comparer les autres bancs à configuration équivalente. Cette page consulte les résultats ; elle ne lance pas de campagne.</p>
    <div className="grid sm:grid-cols-3 gap-3 w-full text-xs">
      <div className="rounded-box border border-base-content/10 p-3"><p className="text-base-content/50">Moteur de référence</p><p>Three.js · WebGL</p></div>
      <div className="rounded-box border border-base-content/10 p-3"><p className="text-base-content/50">Environnement / résolution</p><p>{summary ? 'Configuration détaillée dans le rapport source' : 'Aucune campagne vérifiée disponible'}</p></div>
      <div className="rounded-box border border-base-content/10 p-3"><p className="text-base-content/50">Statut des mesures</p><p>{summary?.status ?? 'Aucune mesure archivée vérifiée'}</p></div>
    </div>
    <CampaignResult summary={summary} />
    <section className="space-y-2 w-full"><h2 className="text-sm font-semibold">Mesures de référence</h2><p className="text-xs text-base-content/60">CPU, GPU, FPS, draw calls, mémoire et distributions p50 / p95 / p99 : {summary ? 'consulter les champs disponibles dans le rapport daté ci-dessus.' : 'indisponibles sans campagne physique vérifiée. Aucun remplacement par les valeurs descriptives.'}</p></section>
    <section className="space-y-3 w-full"><h2 className="text-sm font-semibold">Configurations de charge de la référence</h2>
      <p className="text-xs text-base-content/60">Ces six configurations sont internes au banc de référence. Les bancs spécialisés 01 à 15 sont accessibles depuis le sélecteur global et comparent leur propre protocole à cette référence lorsque la configuration est équivalente.</p>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{MODULE_DESCRIPTORS['00-baseline'].options.map((option, index) => <li key={option.val} className="border border-base-content/10 rounded-box p-3 text-xs">{`Configuration interne ${index + 1} · données disponibles uniquement dans une campagne vérifiée`}</li>)}</ul>
    </section>
    <p className="text-xs text-base-content/60">Limites : aucun chiffre de performance n’est déduit de la description ou des scénarios. Les configurations et les mesures disponibles figurent dans le rapport archivé.</p>
    <section className="space-y-2 w-full"><h2 className="text-sm font-semibold">Comparer aux autres bancs</h2><p className="text-xs text-base-content/70">Utiliser la même scène, la même résolution et le même matériel pour comparer les soumissions (01), le culling (02), les scènes hétérogènes (03) et les niveaux de détail (04). Le sélecteur du header permet de consulter chacun de ces bancs.</p></section>
    <Button onClick={() => actions.openReport('00-baseline')}><FileText className="w-4 h-4" />Consulter le rapport de référence</Button>
  </section>;
  if (execution.status === 'running') return null;
  if (terminal) return <div data-execution-view={execution.status} className="w-full h-full min-w-0 min-h-0 flex-1 overflow-auto bg-base-100 p-5 md:p-6">
    <section className="w-full min-w-0 break-words [overflow-wrap:anywhere] space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-primary"><Activity className="w-4 h-4" /><span>{execution.status === 'completed' ? 'Campagne terminée' : execution.status === 'stopped' ? 'Campagne arrêtée' : 'Exécution interrompue'}</span></div>
      <h1 className="text-xl md:text-2xl font-semibold">Rapport · {moduleTitle(state.moduleId)}</h1>
      <p className="text-sm leading-relaxed text-base-content/80">{execution.phase || state.benchStatus}</p>
      {!execution.lastCampaign && archivedSummary ? <p className="text-xs font-semibold text-warning">Dernier rapport archivé, antérieur à cette exécution</p> : null}
      {children ?? <CampaignResult summary={summary} />}
      {state.progress?.details?.length ? <MetricGrid items={state.progress.details.map(detail => ({ label: detail.label, value: detail.value, ratio: detail.ratio }))} /> : null}
      <p className="text-xs text-base-content/60">Les valeurs absentes restent non mesurées. Le rapport archivé détaille la configuration, la provenance et les limites de cette exécution.</p>
      {footer ?? <ActionBar onNewExecution={terminal ? actions.newExecution : undefined}><Button disabled={state.running || integrationPending} onClick={actions.runBenchmark}><Play className="w-4 h-4" />{integrationPending ? 'Intégration du moteur en cours' : actionLabel}</Button><Button variant="ghost" disabled={state.running} onClick={() => actions.openReport()}><FileText className="w-4 h-4" />Voir le rapport</Button></ActionBar>}
    </section>
  </div>;
  return <div data-execution-view="idle" className="w-full h-full min-w-0 min-h-0 flex-1 overflow-auto bg-base-100 p-5 md:p-6">
    <section className="w-full min-w-0 break-words [overflow-wrap:anywhere] space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-primary"><Activity className="w-4 h-4" /><span>Aucun test en cours</span></div>
      <h1 className="text-xl md:text-2xl font-semibold">{moduleTitle(state.moduleId)}</h1>
      {!presentation && state.moduleId === '15-virtualized-integration' ? <IntegrationSceneCards /> : null}
      <p className="text-sm leading-relaxed text-base-content/80">{presentation ? description : state.moduleId === '15-virtualized-integration' ? 'La fixture vérifie le rendu et les mécanismes de sélection sur trois scènes contrôlées. Ses résultats ne constituent pas une mesure de performance de la ville réelle.' : description}</p>
      <p className="text-xs text-base-content/65">Question du banc : {presentation?.question ?? desc?.subtitle ?? description}</p>
      <p className="text-xs font-mono">{presentation?.protocol ?? comparison}</p>
      {algorithmic ? <p className="text-xs text-base-content/60">Contrôle algorithmique CPU déterministe, potentiellement très bref. Il ne lance aucun renderer 3D et les durées GPU restent non mesurées.</p> : null}
      {state.moduleId === '09-gpu-compaction' ? <p className="text-xs text-base-content/60">Ce banc exécute trois stratégies de calcul WebGPU sans scène 3D. Le centre affichera leur progression, la charge réellement traitée et les résultats partiels mesurés.</p> : null}
      <ol className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-mono text-base-content/50" aria-label="Étapes attendues de la campagne">
        {(presentation?.steps ?? executionSteps).map(label => <li key={label}>{label}</li>)}
      </ol>
      {!presentation && (archivedSummary ? <ReportSummary title="Dernier rapport archivé"><CampaignResult summary={archivedSummary}/></ReportSummary> : <CampaignResult summary={null}/>)} 
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-base-content/10 pt-4 text-xs">
        {(presentation?.metadata ?? [['Backend', backend], ['Canvas prévu', state.moduleId === '14-open-world' || state.mode === 'classic' && !native ? 'WebGL' : 'WebGPU'], ['Résolution', 'Selon le réglage du banc · non mesurée au repos'], ['Charge', state.scenarioVal || 'Non renseignée'], ['Timestamps GPU', 'Disponibilité vérifiée au lancement'], ['Décor', state.moduleId === '14-open-world' ? 'Bistro résident' : native ? 'Géométrie détaillée du banc 04' : 'Scène du banc · voir description']]).map(([label, value]) => <div key={label}><dt className="text-base-content/50 mb-1">{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {children}
      {integrationPending ? <p role="status" className="text-xs font-semibold text-warning">Intégration du moteur en cours</p> : null}
      {footer ?? <ActionBar onNewExecution={terminal ? actions.newExecution : undefined}><Button disabled={state.running || integrationPending} onClick={actions.runBenchmark}><Play className="w-4 h-4" />{integrationPending ? 'Intégration du moteur en cours' : actionLabel}</Button><Button variant="ghost" disabled={state.running} onClick={() => actions.openReport()}><FileText className="w-4 h-4" />Voir le rapport</Button></ActionBar>}
    </section>
  </div>;
}
