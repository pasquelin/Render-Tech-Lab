import type { RefObject } from 'react';
import { useLab } from './LabContext.tsx';
import { ModelLaunchFields } from './ModelLaunchFields.tsx';
import { PreparationStation } from './PreparationStation.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { Button } from './ui/Button.tsx';
import { LoadingState } from './ui/LoadingState.tsx';
import { ProgressPanel } from './ui/ProgressPanel.tsx';
import { benchEngine } from '../../15-virtualized-integration/implementation/engines.ts';
import type { ModelConfig } from '../lab/modelCampaign.ts';

const DIAGNOSTIC_LABELS: Record<ModelConfig['diagnostic'], string> = {
  beauty: 'Rendu texturé',
  wireframe: 'Couleur stable par triangle soumis, sans éclairage',
  clusters: 'Couleur stable par cluster ; gris : géométrie transparente non clusterisée',
  lod: 'Bleu : détail exact ; orange : réduction LOD',
  pages: 'Vert : pages d’indices attachées ; les pages absentes ne sont pas dessinées',
  visibility: 'Vert : pages visibles après sélection ; rejets dans les métriques',
  'screen-error': 'Erreur projetée : vert à 0 px, rouge au seuil de sélection',
};

export function ModelViewport({ webglRef }: { webglRef: RefObject<HTMLCanvasElement | null> }) {
  const { model: view, state, actions } = useLab();
  if (!view) return null;
  const runAction = <Button disabled={view.availability.status !== 'ready'} onClick={actions.runBenchmark}>{state.benchLabel}</Button>;
  const diagnostic = DIAGNOSTIC_LABELS[view.config.diagnostic];
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
                  <p className="bg-base-200/90 p-3 rounded-box text-xs">Exploration libre · {benchEngine(view.config.engine).label} · {diagnostic}{view.config.camera === 'game' ? ' · Jeu : clic pour entrer, WASD pour marcher, Espace pour sauter, Échap pour libérer la souris · collisions sur la géométrie' : view.config.camera === 'free' ? ' · Libre : WASD, R/F pour l’altitude, glisser pour regarder' : ''}</p>
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
                  {view.archiveReport ? <Button variant="secondary" onClick={view.archiveReport}>Enregistrer le rapport</Button> : null}
                  <Button variant="ghost" onClick={view.exportReport}>Exporter le rapport JSON</Button>
                </>
              ) : view.history[0] ? <Button variant="secondary" onClick={() => actions.openReport()}>Voir le rapport</Button> : null}
            </ActionBar>
          )}
        >
          <p className="text-xs" data-model-availability={view.availability.status}>
            {view.report ? view.message : <>
              {view.availability.message}
              {view.availability.status === 'error' ? <Button onClick={view.retryAvailability}>Réessayer la disponibilité</Button> : null}
            </>}
          </p>
        </PreparationStation>
      ) : null}
    </main>
  );
}
