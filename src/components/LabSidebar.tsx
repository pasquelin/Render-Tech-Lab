import { EmeraldReportBody } from './EmeraldReportBody.tsx';
import { EmeraldRunBody } from './EmeraldRunBody.tsx';
import { EmeraldMetricsBody } from './EmeraldMetricsBody.tsx';
import { EmeraldLiveFields } from './EmeraldLiveFields.tsx';
import { CampaignSidebar } from './CampaignSidebar.tsx';
import type { RefObject } from 'react';
import { FileText, Flame, Folder, Play } from 'lucide-react';
import { HINT_BASE, MODULE_NAV } from '../lab/catalog.ts';
import { useLab } from './LabContext.tsx';
import { isIntegratedRunnerId } from '../../bench/runners.ts';
import { moduleUi } from '../lab/moduleUi.ts';
import { LabStats } from './LabStats.tsx';
import { LabSection } from './ui/LabSection.tsx';
import { Select } from './ui/Select.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { Button } from './ui/Button.tsx';
import { ChartPanel } from './ui/ChartPanel.tsx';
import { ChoiceCard } from './ui/ChoiceCard.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { StatusBadge } from './ui/StatusBadge.tsx';
import { ErrorState } from './ui/ErrorState.tsx';

type LabSidebarProps = {
  chartRef: RefObject<HTMLCanvasElement | null>;
};

export function LabSidebar({ chartRef }: LabSidebarProps) {
  const { state, actions, emerald } = useLab();
  const ui = moduleUi(state.moduleId);
  const baseline = state.moduleId === '00-baseline';
  const integrationFixture = state.moduleId === '15-virtualized-integration' && !emerald;
  const integrationPending = ui.sceneChoice && !isIntegratedRunnerId(state.moduleId);
  const chartUnavailable = state.moduleId === '02-gpu-frustum-culling' && state.execution.status === 'error';
  const showChart = (ui.showChart && state.showChart) || chartUnavailable;
  const pathCampaign = emerald?.config.mode === 'path';

  if (baseline) return (
      <aside id="sidebar" className="min-w-0 h-full min-h-0 bg-base-200 p-3.5 pr-0.5 overflow-y-auto overflow-x-hidden space-y-3 flex flex-col border-l border-base-content/10">
        <LabSection id="dashboard-intro-card" number={1} title="Bienvenue">
          <p className="text-sm leading-relaxed">Choisissez un banc pour explorer une technique, lancer son protocole et consulter ses résultats.</p>
          <p className="text-xs leading-relaxed text-base-content/60">Les mesures sont produites uniquement dans les bancs 01 à 15.</p>
        </LabSection>
        <LabSection id="dashboard-benches-card" number={2} title="Bancs d’essai">
          <ul className="grid grid-cols-2 gap-2" aria-label="Accès aux bancs 01 à 15">
            {MODULE_NAV.filter(module => module.id !== '00-baseline').map(module => {
              const [number, ...titleParts] = module.label.split(' · ');
              const title = titleParts.join(' · ');
              const meta = moduleUi(module.id);
              return <li key={module.id} className="w-full">
                <ChoiceCard data-bench-access={module.id} title={`Ouvrir ${module.label}`} onClick={() => actions.switchModule(module.id)} className="group w-full px-2.5 py-2 min-h-12">
                  <span className="flex items-start gap-2 min-w-0">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/75 group-hover:bg-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5 min-w-0"><strong className="font-mono text-[11px] text-primary shrink-0">{number}</strong><span className="text-[11px] font-medium truncate" title={title}>{title}</span></span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[9px] text-base-content/50"><span className="truncate">{meta.category}</span><span className="shrink-0">{meta.status}</span></span>
                    </span>
                  </span>
                </ChoiceCard>
              </li>;
            })}
          </ul>
        </LabSection>
      </aside>
  );

  return (
    <aside id="sidebar" className="min-w-0 h-full min-h-0 bg-base-200 p-3.5 pr-0.5 overflow-y-auto overflow-x-hidden space-y-3 flex flex-col border-l border-base-content/10">
        {pathCampaign ? null : <LabSection
          id="lab-mode-card"
          number={1}
          title={emerald ? 'Contrôles pendant le rendu' : 'Configuration / mode d’exécution'}
          badge={emerald || integrationFixture ? undefined : ui.hasModeChoice ? 'Bascule' : 'Mode unique'}
          help={emerald ? 'Pendant le rendu, seuls les réglages encore actifs restent ici.' : integrationFixture ? 'La scène se choisit dans le panneau principal. Pendant la fixture, étendue et caméra sont imposées.' : ui.modeHint}
        >
          {emerald ? <EmeraldLiveFields /> : integrationFixture ? (
            <>
              <Select id="select-diagnostic-view" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." defaultValue="beauty" disabled={state.running}>
                {(ui.diagnostics ?? []).map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.disabled ? `${option.label} · backend indisponible` : option.label}</option>)}
              </Select>
              <p className="text-[10px] text-base-content/55">La scène se choisit dans le panneau principal. Étendue, détail et caméra sont imposés par les trois contrôles procéduraux.</p>
            </>
          ) : (
            <>
              {ui.hasModeChoice ? (
                <SegmentedControl value={state.mode} label="Mode d’exécution" disabled={state.running} onChange={actions.setMode} options={ui.modeOptions.map(option => ({ ...option, value: option.value as typeof state.mode }))} />
              ) : <p className="text-[10px] text-base-content/55">Mode unique : le bouton central exécute les variantes prévues par ce contrôle, sans bascule A/B décorative.</p>}
              {ui.previewHint ? <p id="mode-preview-hint" className="text-[10px] leading-snug text-base-content/50">{ui.previewHint}</p> : null}
              {ui.diagnostics ? (
                <Select id="select-diagnostic-view" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." defaultValue="beauty" disabled={state.running}>
                  {ui.diagnostics.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.disabled ? `${option.label} · backend indisponible` : option.label}</option>)}
                </Select>
              ) : null}
              {ui.sceneChoice ? <p className="text-[10px] text-base-content/55">Scène active : fixture procédurale de validation, indépendante d’Emerald Square.</p> : (
                <Select
                  id="select-count"
                  label={ui.countLabel}
                  disabled={state.running || integrationPending}
                  className="select-sm w-full font-mono text-xs focus:outline-none focus:border-primary border-base-content/15"
                  value={state.scenarioVal}
                  onChange={event => actions.setScenario(event.target.value)}
                >
                  {state.scenarioOptions.map(option => (
                    <option key={option.val} value={option.val} disabled={option.disabled} className={option.selected ? 'active' : undefined}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}
        </LabSection>}

        <LabSection id="lab-metrics-card" number={2} title="Métriques en direct" badge={emerald ? undefined : '350ms MA'}>
          {emerald ? <EmeraldMetricsBody /> : (
            <>
              <LabStats stats={state.stats} />
              <MetricGrid label="Contexte de soumission" items={[
                { id: 'stat-mode', label: 'Pipeline', value: state.stats.modeLabel },
                { id: 'stat-objects', label: 'Objets', value: state.stats.objects },
              ]} />
            </>
          )}
        </LabSection>

        <LabSection id="lab-run-card" number={3} title="Campagne / comparaison">
          {emerald ? <EmeraldRunBody /> : (
            <>
              {showChart ? (
                <ChartPanel label="Graphe de campagne">
                  {chartUnavailable ? <ErrorState message={state.execution.phase || 'WebGPU indisponible : aucune mesure ni courbe produite.'} /> : <canvas id="canvas-chart" ref={chartRef} className="w-full h-full block rounded-box" />}
                </ChartPanel>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Button
                  id="btn-lod-comparison"
                  variant="outline"
                  href={ui.comparisonHref ?? ''}
                  disabled={state.running || !ui.comparisonHref}
                  className={`w-full ${ui.comparisonHref && !state.running ? '' : 'hidden'}`}
                >
                  {ui.comparisonLabel ?? 'Comparer les calculs sur une scène détaillée'}
                </Button>
                <Button id="btn-benchmark" className="w-full shadow-xs gap-2" disabled={state.running || integrationPending} onClick={actions.runBenchmark}>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{['completed', 'stopped', 'error'].includes(state.execution.status) ? 'Relancer' : state.benchLabel}</span>
                </Button>
                <Button
                  id="btn-pain-benchmark"
                  variant="danger"
                  className={`w-full shadow-xs gap-2 ${state.showPain && state.execution.status !== 'idle' ? '' : 'hidden'}`}
                  disabled={state.running && !ui.canStop}
                  onClick={actions.runPain}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{state.painLabel}</span>
                </Button>
              </div>
              <StatusBadge id="bench-status" tone="neutral" className={`w-full justify-start font-mono text-[10px] h-auto py-2 whitespace-nowrap truncate ${state.benchTone}`}>
                {integrationPending ? 'Intégration du moteur en cours' : state.benchStatus}
              </StatusBadge>
              <CampaignSidebar />
            </>
          )}
        </LabSection>

        <LabSection id="lab-report-card" number={4} title="Rapports et suivi">
          {emerald ? <EmeraldReportBody /> : (
            <>
              <div className="text-xs text-base-content/60 leading-tight">
                Résultats archivés dans le fichier unique :{' '}
                <code className="text-[11px] bg-base-100 px-1.5 py-0.5 rounded font-mono text-primary border border-base-content/10">REPORT.md</code>
              </div>
              <p className="text-[10px] text-base-content/50">5 derniers rapports conservés.</p>
              <div className="flex gap-2">
                <Button id="btn-view-report" disabled={state.running} className="flex-1 gap-1.5 shadow-xs whitespace-nowrap text-xs px-2" onClick={() => actions.openReport()}>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Voir rapport</span>
                </Button>
                <Button id="btn-open-reports" variant="secondary" disabled={state.running} className="flex-1 gap-1.5 shadow-xs whitespace-nowrap text-xs px-2" onClick={actions.openFinder}>
                  <Folder className="w-3.5 h-3.5" />
                  <span>Révéler Finder</span>
                </Button>
              </div>
              <div id="open-report-hint" className={`${HINT_BASE} text-base-content/40`}>{state.reportHint}</div>
            </>
          )}
        </LabSection>
      </aside>
  );
}
