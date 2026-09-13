import type { RefObject } from 'react';
import { useLab } from './LabContext.tsx';
import { ModelLaunchFields } from './ModelLaunchFields.tsx';
import { PreparationStation } from './PreparationStation.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { Button } from './ui/Button.tsx';
import { LoadingState } from './ui/LoadingState.tsx';
import { ProgressPanel } from './ui/ProgressPanel.tsx';
import { benchEngine } from '../../15-virtualized-integration/implementation/engines.ts';

export function ModelViewport({ webglRef }: { webglRef: RefObject<HTMLCanvasElement | null> }) {
  const { model: view, state, actions } = useLab();
  if (!view) return null;
  const runAction = <Button disabled={view.availability.status !== 'ready'} onClick={actions.runBenchmark}>{state.benchLabel}</Button>;
  const diagnostic = view.config.diagnostic === 'beauty' ? 'Rendu texturé' : view.config.diagnostic === 'pages' ? 'Vert : pages d’indices réellement attachées' : view.config.diagnostic === 'clusters' ? 'Couleurs : identifiants réels de clusters' : view.config.diagnostic === 'wireframe' ? 'Une couleur par triangle réellement soumis' : 'Triangles réellement soumis';
  return (
    <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-base-100 flex flex-col" data-model-status={view.status} data-rendered-mode={view.config.diagnostic}>
      {state.running ? (
        <div className="relative flex-1 min-h-0">
          <div className="relative min-w-0 min-h-0 h-full">
            <canvas id="canvas-model" ref={webglRef} tabIndex={0} aria-label="Vue interactive 3D" data-model-surface={view.surfaceKey} className={`absolute inset-0 block w-full h-full outline-none bg-base-100 ${view.status === 'ready' ? '' : 'invisible'}`} />
            {view.status === 'ready' ? (
              <div className="absolute left-3 bottom-3 right-3 pointer-events-none">
                {view.progress ? (
                  <ProgressPanel message={`${view.message} · ${diagnostic}`} value={view.progress.completed} max={view.progress.total} />
                ) : (
                  <p className="bg-base-200/90 p-3 rounded-box text-xs">Exploration libre · {benchEngine(view.config.engine).label} · {diagnostic}</p>
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
          controls={<ModelLaunchFields />}
          presentation={{
            description: view.config.mode === 'path'
              ? 'Parcours reproductible du modèle : THREE.js basic, THREE.js LOD, WebGeometry WebGL, puis WebGeometry WebGPU.'
              : 'Exploration libre du modèle : caméra, diagnostic et moteur se règlent à droite pendant le rendu.',
            question: 'Comment la navigation se comporte-t-elle à cette étendue et à ce niveau de détail ?',
            protocol: view.config.mode === 'path' ? 'Test automatique : mêmes poses pour chaque moteur, une photo technique par segment. Pas un verdict de performance.' : 'Exploration manuelle. Un seul moteur à l’écran, changeable pendant la navigation. Le verdict de performance reste bloqué.',
            steps: view.config.mode === 'path' ? ['Configurer', 'Lancer le parcours', 'THREE.js basic', 'THREE.js LOD', 'WebGeometry WebGL', 'WebGeometry WebGPU', 'Rapport'] : ['Configurer', 'Explorer', 'Ajuster à droite', 'Arrêter', 'Rapport'],
            metadata: [],
          }}
          footer={(
            <ActionBar onNewExecution={view.status !== 'idle' ? actions.newExecution : undefined}>
              {runAction}
              {view.report ? (
                <>
                  <Button variant="secondary" onClick={() => actions.openReport()}>Voir le rapport</Button>
                  <Button variant="ghost" onClick={view.exportReport}>Exporter le rapport JSON</Button>
                </>
              ) : view.history[0] ? <Button variant="secondary" onClick={() => actions.openReport()}>Voir le rapport</Button> : null}
            </ActionBar>
          )}
        >
          <p className="text-xs" data-model-availability={view.availability.status}>
            {view.report ? 'Rapport archivé. Ouvrez « Voir le rapport » pour les captures et le diagnostic.' : <>
              {view.availability.message}
              {view.availability.status === 'error' ? <Button onClick={view.retryAvailability}>Réessayer la disponibilité</Button> : null}
            </>}
          </p>
        </PreparationStation>
      ) : null}
    </main>
  );
}
