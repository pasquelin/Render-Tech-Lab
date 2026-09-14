import { useEffect, useState, type ReactNode } from 'react';
import { FileText, Play } from 'lucide-react';
import { useLab } from './LabContext.tsx';
import { MODULE_DESCRIPTORS } from '../lab/modules.ts';
import { moduleDescription } from '../lab/modulePresentation.ts';
import { moduleUi } from '../lab/moduleUi.ts';
import { moduleTitle } from '../lab/catalog.ts';
import { executionSteps, type CampaignSummary } from '../lab/execution.ts';
import { campaignSummary } from '../lab/campaignSummary.ts';
import { isIntegratedRunnerId } from '../../bench/runners.ts';
import { Button } from './ui/Button.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { EmptyState } from './ui/EmptyState.tsx';
import { BenchStart } from './BenchStart.tsx';
import { BenchEnd } from './BenchEnd.tsx';
import { useReportAvailability } from './useReportAvailability.ts';
import { StatusBadge } from './ui/StatusBadge.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { DashboardReports } from './DashboardReports.tsx';

export function CampaignResult({ summary }: { summary: CampaignSummary | null }) {
  if (!summary) return <EmptyState title="Aucun résultat de test disponible"><p className="text-sm text-base-content/60">Lancez le test pour enregistrer ses résultats.</p></EmptyState>;
  return <section className="space-y-3" aria-label="Dernier test mesuré">
    <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70"><time dateTime={summary.timestamp}>{new Date(summary.timestamp).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</time><StatusBadge tone="outline">{summary.status}</StatusBadge><span className="basis-full sm:basis-auto break-words [overflow-wrap:anywhere]">{summary.configuration}</span></div>
    {summary.scenarioChecks?.length ? <div className="grid grid-cols-1 md:grid-cols-3 gap-2" aria-label="Résumé des scénarios du banc 15">{summary.scenarioChecks.map(check => <article key={check.id} className="min-w-0 rounded-box border border-base-content/10 bg-base-200 p-3 space-y-1"><h3 className="text-xs font-semibold break-words">{check.label}</h3><p className="text-[11px] text-base-content/65">Contrôles A : {check.a} · B : {check.b}</p><p className="text-[11px] font-mono text-primary">{check.quality}</p></article>)}</div> : null}
    {summary.series.length ? <MetricGrid items={summary.series.map(series => ({ label: series.label, value: series.values.at(-1)?.toFixed(2) ?? 'Non mesuré', unit: series.unit, provenance: series.values.length > 1 ? series.values.map(value => value.toFixed(2)).join(' → ') : undefined }))} /> : null}
  </section>;
}

export type PreparationPresentation={description:string;question:string;protocol:string;steps:string[];metadata:Array<[string,string]>};
export function PreparationStation({presentation,controls,children,footer}:{presentation?:PreparationPresentation;controls?:ReactNode;children?:ReactNode;footer?:ReactNode}={}) {
  const { state, actions } = useLab();
  const [history, setHistory] = useState<{ moduleId: string; summary: CampaignSummary | null } | null>(null);
  useEffect(() => {
    if(presentation) return;
    if (state.moduleId === '00-baseline') {
      setHistory(null);
      return;
    }
    const api = state.moduleId === '04-gpu-lod' ? '/api/lod-comparison' : '/api/world-comparison';
    const abort = new AbortController();
    void (async () => {
      try {
        if (state.moduleId !== '04-gpu-lod' && state.moduleId !== '14-open-world') {
          const saved = await fetch(`/api/get-latest?testId=${encodeURIComponent(state.moduleId)}`, { signal: abort.signal });
          if (saved.ok && saved.status !== 204) {
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
  const reportAvailable = useReportAvailability(state.moduleId, state.execution.status, state.moduleId !== '00-baseline' && !state.running && !footer);
  const execution = state.execution;
  const exploration = execution.kind === 'exploration';
  const ui = moduleUi(state.moduleId);
  const integrationPending = ui.sceneChoice && !isIntegratedRunnerId(state.moduleId);
  const terminal = execution.status === 'completed' || execution.status === 'stopped' || execution.status === 'error';
  const description = presentation?.description ?? moduleDescription(state.moduleId);
  const desc = MODULE_DESCRIPTORS[state.moduleId];
  const archivedSummary = history?.moduleId === state.moduleId ? history.summary : null;
  const summary = execution.lastCampaign ?? archivedSummary;
  const actionLabel = terminal ? 'Relancer' : state.benchLabel;
  const backend = ui.backend || state.telemetryMode;
  const comparison = ui.protocol;
  const canvasKind = ui.holdSurfaces && !ui.showChart || state.mode === 'classic' ? 'WebGL' : 'WebGPU';
  if (state.moduleId === '00-baseline') return <section className="w-full h-full min-w-0 min-h-0 flex-1 bg-base-100 overflow-auto p-6 md:p-10" aria-label="Accueil du laboratoire">
    <div className="w-full space-y-3">
      <div className="space-y-3">
        <p className="text-xs font-mono text-primary">Laboratoire de rendu temps réel</p>
        <h1 className="text-2xl md:text-3xl font-semibold">Dashboard</h1>
        <p className="text-base leading-relaxed text-base-content/80">Mesurez, comparez et améliorez les briques du pipeline de rendu sur des protocoles reproductibles.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3" aria-label="Fonctionnement du laboratoire">
        {[
          ['1', 'Choisir un banc', 'Sélectionnez une expérience depuis la colonne de droite.'],
          ['2', 'Lancer le protocole', 'Le banc exécute ses variantes avec la même configuration.'],
          ['3', 'Lire le résultat', 'Les mesures, leur provenance et leurs limites sont archivées.'],
        ].map(([number, title, text]) => <article key={number} className="rounded-box border border-base-content/10 bg-base-200/60 p-4 space-y-2">
          <span className="font-mono text-xs text-primary">{number}</span>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs leading-relaxed text-base-content/65">{text}</p>
        </article>)}
      </div>
      <div id="dashboard-reports" className="pt-2"><DashboardReports onOpenReport={actions.openReport} /></div>
    </div>
  </section>;
  if (execution.status === 'running') return null;
  const executionActions = footer ?? <ActionBar onNewExecution={terminal ? actions.newExecution : undefined}>
    <Button disabled={state.running || integrationPending} onClick={actions.runBenchmark}>
      <Play className="w-4 h-4" />{integrationPending ? 'Intégration du moteur en cours' : actionLabel}
    </Button>
    <Button variant="ghost" disabled={!reportAvailable} onClick={() => actions.openReport()}>
      <FileText className="w-4 h-4" />Voir le rapport
    </Button>
  </ActionBar>;
  if (execution.status !== 'idle') return <BenchEnd
    status={execution.status}
    title={`Rapport · ${moduleTitle(state.moduleId)}`}
    statusLabel={execution.status === 'completed' ? (exploration ? 'Exploration terminée' : 'Test terminé') : execution.status === 'stopped' ? (exploration ? 'Exploration arrêtée' : 'Test arrêté') : 'Exécution interrompue'}
    message={execution.phase || state.benchStatus}
    controls={controls}
    previousReportNotice={!execution.lastCampaign && (exploration ? reportAvailable : Boolean(archivedSummary))}
    summary={children ?? (!exploration ? <CampaignResult summary={summary} /> : null)}
    details={state.progress?.details?.map(detail => ({ label: detail.label, value: detail.value, ratio: detail.ratio }))}
    note={!exploration ? 'Les valeurs absentes restent non mesurées. Le rapport archivé détaille la configuration, la provenance et les limites de cette exécution.' : undefined}
    actions={executionActions}
  />;
  return <BenchStart
    title={moduleTitle(state.moduleId)}
    description={presentation ? description : ui.sceneChoice && ui.idleNote ? ui.idleNote : description}
    question={presentation?.question ?? desc?.subtitle ?? description}
    protocol={presentation?.protocol ?? (exploration ? 'Exploration manuelle. Les réglages de la scène sont disponibles pendant le rendu.' : comparison)}
    notes={<>
      {!presentation && ui.algorithmic ? <p className="text-xs text-base-content/60">Contrôle algorithmique CPU déterministe, potentiellement très bref. Il ne lance aucun renderer 3D et les durées GPU restent non mesurées.</p> : null}
      {ui.idleNote && !ui.sceneChoice ? <p className="text-xs text-base-content/60">{ui.idleNote}</p> : null}
    </>}
    steps={presentation?.steps ?? (exploration ? ['Configurer', 'Explorer', 'Ajuster à droite', 'Arrêter'] : executionSteps)}
    stepLabel={exploration ? 'Étapes de l’exploration' : 'Étapes du test'}
    summary={!presentation && !exploration ? (archivedSummary ? <ReportSummary title="Dernier rapport archivé"><CampaignResult summary={archivedSummary} /></ReportSummary> : <CampaignResult summary={null} />) : null}
    controls={controls}
    metadata={(presentation?.metadata ?? [['Backend', backend], ['Canvas prévu', canvasKind], ['Résolution', 'Selon le réglage du banc · non mesurée au repos'], ['Charge', state.scenarioVal || 'Non renseignée'], ['Timestamps GPU', 'Disponibilité vérifiée au lancement'], ['Décor', ui.backend]]).map(([label, value]) => ({ label, value }))}
    notice={integrationPending ? <p role="status" className="text-xs font-semibold text-warning">Intégration du moteur en cours</p> : null}
    actions={executionActions}
  >{children}</BenchStart>;
}
