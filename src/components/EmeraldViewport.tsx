import type { RefObject } from 'react';
import { useLab } from './LabContext.tsx';
import { EmeraldLaunchFields } from './EmeraldLaunchFields.tsx';
import { EmeraldReportView } from './EmeraldReportView.tsx';
import { PreparationStation } from './PreparationStation.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { Button } from './ui/Button.tsx';
import { LoadingState } from './ui/LoadingState.tsx';
import { ProgressPanel } from './ui/ProgressPanel.tsx';

export function EmeraldViewport({ webglRef }: { webglRef: RefObject<HTMLCanvasElement | null> }) {
  const { emerald: view, state, actions } = useLab();
  if (!view) return null;
  const runAction = <Button disabled={view.availability.status !== 'ready'} onClick={actions.runBenchmark}>{state.benchLabel}</Button>;
  const diagnostic = view.config.diagnostic === 'beauty' ? 'Rendu texturé' : view.config.diagnostic === 'pages' ? 'Vert : pages d’indices réellement attachées' : view.config.diagnostic === 'clusters' ? 'Couleurs : identifiants réels de clusters' : view.config.diagnostic === 'wireframe' ? 'Une couleur par triangle réellement soumis' : 'Triangles réellement soumis';
  return (
    <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-base-100 flex flex-col" data-emerald-status={view.status} data-rendered-mode={view.config.diagnostic}>
      {state.running ? (
        <div className="relative flex-1 min-h-0">
          <div className="relative min-w-0 min-h-0 h-full">
            <canvas id="canvas-emerald" ref={webglRef} tabIndex={0} aria-label="Vue interactive Emerald Square" data-emerald-surface={view.surfaceKey} className={`absolute inset-0 block w-full h-full outline-none ${view.status === 'ready' ? '' : 'invisible'}`} />
            {view.status === 'ready' ? (
              <div className="absolute left-3 bottom-3 right-3 pointer-events-none">
                {view.progress ? (
                  <ProgressPanel message={`${view.message} · ${diagnostic}`} value={view.progress.completed} max={view.progress.total} />
                ) : (
                  <p className="bg-base-200/90 p-3 rounded-box text-xs">Exploration libre · {view.config.engine} · {diagnostic}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {view.status === 'loading' ? (
        <div className="absolute inset-0 bg-base-100/95 p-6 flex items-center justify-center">
          {view.progress ? <ProgressPanel message={view.message} value={view.progress.completed} max={view.progress.total} /> : <LoadingState message={view.message} />}
        </div>
      ) : null}
      {!state.running ? (
        <PreparationStation
          controls={<EmeraldLaunchFields />}
          presentation={{
            description: `Emerald Square : ${view.config.mode === 'path' ? 'un parcours urbain reproductible. Un lancement enchaîne Three.js, WebGeometry et THREE.LOD.' : 'une exploration libre de la ville réelle. Caméra, diagnostic et moteur se règlent à droite pendant le rendu.'}`,
            question: 'Comment la navigation se comporte-t-elle à cette étendue et à ce niveau de détail ?',
            protocol: view.config.mode === 'path' ? 'Test automatique : mêmes poses pour chaque moteur, une photo technique par segment. Pas un verdict de performance.' : 'Exploration manuelle. Un seul moteur à l’écran, changeable pendant la navigation. Le verdict de performance reste bloqué.',
            steps: view.config.mode === 'path' ? ['Configurer', 'Lancer le parcours', 'Three.js', 'WebGeometry', 'THREE.LOD', 'Rapport'] : ['Configurer', 'Explorer', 'Ajuster à droite', 'Arrêter', 'Rapport'],
            metadata: [],
          }}
          footer={(
            <ActionBar onNewExecution={view.status !== 'idle' ? actions.newExecution : undefined}>
              {runAction}
              {view.report ? (
                <>
                  <Button variant="secondary" onClick={() => document.querySelector('[data-emerald-report]')?.scrollIntoView({ behavior: 'smooth' })}>Voir le rapport</Button>
                  <Button variant="ghost" onClick={view.exportReport}>Exporter le rapport JSON</Button>
                </>
              ) : view.history[0] ? <Button variant="secondary" onClick={() => view.showReport(view.history[0].id)}>Voir le rapport</Button> : null}
            </ActionBar>
          )}
        >
          {view.report ? <EmeraldReportView report={view.report} history={view.history} /> : (
            <p className="text-xs" data-emerald-availability={view.availability.status}>
              {view.availability.message}
              {view.availability.status === 'error' ? <Button onClick={view.retryAvailability}>Réessayer la disponibilité</Button> : null}
            </p>
          )}
        </PreparationStation>
      ) : null}
    </main>
  );
}
