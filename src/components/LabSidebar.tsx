import { EmeraldReportBody, EmeraldRunBody, EmeraldMetricsBody, EmeraldModeFields, IntegrationSceneChoice } from './EmeraldPanels.tsx';
import { CampaignSidebar } from './CampaignSidebar.tsx';
import type { RefObject } from 'react';
import { FileText, Flame, Folder, Play } from 'lucide-react';
import { HINT_BASE, MODULE_NAV, STATUS_BASE } from '../lab/catalog.ts';
import { useLab } from './LabContext.tsx';
import { isIntegratedRunnerId } from '../../bench/runners.ts';
import { LabStats } from './LabStats.tsx';
import { LabSection } from './ui/LabSection.tsx';
import { Select } from './ui/Select.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { Button } from './ui/Button.tsx';
import { ChartPanel } from './ui/ChartPanel.tsx';
import { ChoiceCard } from './ui/ChoiceCard.tsx';

type LabSidebarProps = {
  chartRef: RefObject<HTMLCanvasElement | null>;
};

const ACCESS_META: Record<string, { category: string; status: string }> = {
  '01-indirect-draw': { category: 'Rendu indirect', status: 'Mesurable' },
  '02-gpu-frustum-culling': { category: 'Visibilité GPU', status: 'Mesurable' },
  '03-gpu-scene': { category: 'Scène GPU', status: 'Mesurable' },
  '04-gpu-lod': { category: 'Niveaux de détail', status: 'Mesurable' },
  '05-meshlets': { category: 'Géométrie', status: 'Contrôle CPU' },
  '06-meshlet-culling': { category: 'Visibilité', status: 'Contrôle CPU' },
  '07-hiz': { category: 'Profondeur', status: 'Contrôle CPU' },
  '08-occlusion-culling': { category: 'Occlusion', status: 'Contrôle CPU' },
  '09-gpu-compaction': { category: 'Compaction', status: 'Préparation GPU' },
  '10-material-batching': { category: 'Matériaux', status: 'Contrôle CPU' },
  '11-geometry-streaming': { category: 'Streaming', status: 'Contrôle CPU' },
  '12-visibility-buffer': { category: 'Visibilité', status: 'Contrôle CPU' },
  '13-full-gpu-driven': { category: 'Architecture', status: 'Préparation' },
  '14-open-world': { category: 'Monde ouvert', status: 'Mesurable' },
  '15-virtualized-integration': { category: 'Géométrie virtualisée', status: 'Intégration' },
};

const MODE_CHOICE = new Set(['01-indirect-draw', '03-gpu-scene', '04-gpu-lod', '14-open-world']);

export function LabSidebar({ chartRef }: LabSidebarProps) {
  const { state, actions, emerald, onIntegrationScene } = useLab();
  const baseline = state.moduleId === '00-baseline';
  const integrationPending = state.moduleId === '15-virtualized-integration' && !isIntegratedRunnerId(state.moduleId);
  const hasModeChoice = MODE_CHOICE.has(state.moduleId);

  return (
    <div className="drawer-side h-full overflow-hidden border-l border-base-content/10 z-30 lg:!w-full">
      <label htmlFor="sidebar-drawer" aria-label="Fermer le panneau de contrôle" className="drawer-overlay" />
      <aside id="sidebar" className="w-80 lg:w-full h-full bg-base-200 p-3.5 overflow-y-auto space-y-3 shrink-0 flex flex-col">
        <LabSection
          id="lab-mode-card"
          number={1}
          title="Configuration / mode d’exécution"
          badge={emerald || baseline ? undefined : hasModeChoice ? 'Bascule' : 'Mode unique'}
          help={emerald || baseline ? undefined : state.modeHint}
        >
          {emerald ? <EmeraldModeFields /> : baseline ? (
            <>
              <p className="text-sm leading-relaxed">Référence de consultation · Three.js standard. Cette référence décrit six configurations de charge internes ; cette page ne lance aucune campagne.</p>
              <p className="text-xs leading-relaxed text-base-content/70">Les bancs spécialisés 01 à 15 utilisent leurs propres protocoles et s’y comparent lorsque la configuration est équivalente. Consigner le matériel, le navigateur et la résolution.</p>
            </>
          ) : (
            <>
              <div className={hasModeChoice ? '' : 'hidden'}>
                <SegmentedControl value={state.mode} label="Mode d’exécution" disabled={state.running} onChange={actions.setMode} options={[{ id: 'btn-classic', value: 'classic', label: 'Test A (Three.js)' }, { id: 'btn-gpu-driven', value: 'gpu-driven', label: 'Test B (GPU-Driven)' }]} />
              </div>
              {!hasModeChoice ? <p className="text-[10px] text-base-content/55">Mode unique : le bouton central exécute les variantes prévues par ce contrôle, sans bascule A/B décorative.</p> : null}
              {state.moduleId === '15-virtualized-integration' ? <IntegrationSceneChoice /> : null}
              {state.moduleId === '04-gpu-lod' ? <p id="mode-preview-hint" className="text-[10px] leading-snug text-base-content/50">Aperçu uniquement — la comparaison complète se lance avec le bouton ci-dessous.</p> : null}
              {state.moduleId === '15-virtualized-integration' ? (
                <Select id="select-diagnostic-view" label="Vue de diagnostic" help="Le coût des diagnostics est exclu des mesures officielles." defaultValue="beauty" disabled={state.running}>
                  <option value="beauty">Rendu final</option>
                  {['Triangles / fil de fer', 'Clusters', 'Niveau de détail', 'Erreur écran', 'Visibilité / culling', 'Pages / streaming', 'Textures / mips'].map(label => <option key={label} disabled>{label} · backend indisponible</option>)}
                </Select>
              ) : null}
              <Select
                id="select-count"
                label={state.countLabel}
                disabled={state.running || integrationPending}
                className="select-sm w-full font-mono text-xs focus:outline-none focus:border-primary border-base-content/15"
                aria-label={state.moduleId === '15-virtualized-integration' ? 'Scène du banc 15' : undefined}
                value={state.scenarioVal}
                onChange={event => state.moduleId === '15-virtualized-integration' && event.target.value === 'emerald-square' ? onIntegrationScene?.('emerald') : actions.setScenario(event.target.value)}
              >
                {state.scenarioOptions.map(option => (
                  <option key={option.val} value={option.val} disabled={option.disabled} className={option.selected ? 'active' : undefined}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {state.moduleId === '15-virtualized-integration' ? <p className="text-[10px] text-base-content/55">Scène active : fixture procédurale de validation, indépendante d’Emerald Square.</p> : null}
            </>
          )}
        </LabSection>

        <LabSection id="lab-metrics-card" number={2} title="Métriques en direct" badge={baseline ? undefined : emerald ? undefined : '350ms MA'}>
          {emerald ? <EmeraldMetricsBody /> : (
            <>
              <LabStats stats={state.stats} />
              {baseline ? <p className="text-[10px] text-base-content/50">Consultation : aucune télémétrie en direct. Les valeurs vérifiées restent dans les rapports datés.</p> : (
                <div className="text-[11px] text-base-content/70 flex items-center justify-between px-1">
                  <span>Pipeline : <strong id="stat-mode" className="text-primary font-medium">{state.stats.modeLabel}</strong></span>
                  <span className="badge badge-sm badge-neutral font-mono text-[10px]" id="stat-objects">{state.stats.objects}</span>
                </div>
              )}
            </>
          )}
        </LabSection>

        <LabSection id="lab-run-card" number={3} title="Campagne / comparaison">
          {emerald ? <EmeraldRunBody /> : baseline ? (
            <>
              <p className="text-xs text-base-content/65">Aucune commande sur le Dashboard. Ouvrez un banc 01–15 pour lancer une campagne.</p>
              <div aria-labelledby="bench-access-title" className="space-y-2 min-h-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="bench-access-title" className="text-xs font-mono text-primary">Accès aux bancs</h2>
                  <span className="text-[10px] text-base-content/45">01–15</span>
                </div>
                <ul className="grid grid-cols-1 2xl:grid-cols-2 gap-1.5">
                  {MODULE_NAV.filter(module => module.id !== '00-baseline').map(module => {
                    const [number, ...titleParts] = module.label.split(' · ');
                    const title = titleParts.join(' · ');
                    const meta = ACCESS_META[module.id];
                    return (
                      <li key={module.id}>
                        <ChoiceCard
                          data-bench-access={module.id}
                          title={`Ouvrir ${module.label} · ${meta.status}`}
                          onClick={() => actions.switchModule(module.id)}
                          className="group px-2.5 py-2"
                        >
                          <span className="flex items-start gap-2 min-w-0">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/75 group-hover:bg-primary" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-1.5 min-w-0">
                                <strong className="font-mono text-[11px] text-primary shrink-0">{number}</strong>
                                <span className="text-[11px] font-medium truncate" title={title}>{title}</span>
                              </span>
                              <span className="mt-0.5 flex items-center justify-between gap-2 text-[9px] text-base-content/50">
                                <span className="truncate">{meta.category}</span>
                                <span className="shrink-0">{meta.status}</span>
                              </span>
                            </span>
                          </span>
                        </ChoiceCard>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className={state.showChart ? '' : 'hidden'}>
                <ChartPanel label="Graphe de campagne">
                  <canvas id="canvas-chart" ref={chartRef} className="w-full h-full block rounded-box" />
                </ChartPanel>
              </div>
              <div className="flex flex-col gap-1.5">
                <a
                  id="btn-lod-comparison"
                  href={state.running || state.moduleId !== '04-gpu-lod' ? undefined : '/04-gpu-lod/comparison.html'}
                  aria-disabled={state.running}
                  tabIndex={state.running ? -1 : undefined}
                  onClick={event => { if (state.running) event.preventDefault(); }}
                  className={`btn btn-sm btn-outline w-full ${state.showLodComparison ? '' : 'hidden'}`}
                >
                  Comparer les calculs sur une scène détaillée
                </a>
                <Button id="btn-benchmark" className="w-full shadow-xs gap-2" disabled={state.running || integrationPending} onClick={actions.runBenchmark}>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{state.benchLabel}</span>
                </Button>
                <Button
                  id="btn-pain-benchmark"
                  variant="danger"
                  className={`w-full shadow-xs gap-2 ${state.showPain && state.execution.status !== 'idle' ? '' : 'hidden'}`}
                  disabled={state.running && state.moduleId !== '04-gpu-lod' && state.moduleId !== '14-open-world'}
                  onClick={actions.runPain}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{state.painLabel}</span>
                </Button>
              </div>
              <div id="bench-status" className={`${STATUS_BASE} ${state.benchTone}`}>
                {integrationPending ? 'Intégration du moteur en cours' : state.benchStatus}
              </div>
              <CampaignSidebar />
            </>
          )}
        </LabSection>

        <LabSection id="lab-report-card" number={4} title="Rapports et suivi">
          {emerald ? <EmeraldReportBody /> : baseline ? (
            <>
              <p className="text-xs text-base-content/65">Rapport historique non vérifié : ses estimations ne constituent pas des mesures utilisables.</p>
              <Button onClick={() => actions.openReport('00-baseline')}><FileText className="w-3.5 h-3.5" />Voir le rapport</Button>
            </>
          ) : (
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
    </div>
  );
}
