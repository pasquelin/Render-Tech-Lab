import { EmeraldViewport } from './EmeraldPanels.tsx';
import { PreparationStation } from './PreparationStation.tsx';
import type { RefObject } from 'react';
import { ViewportCanvases } from './ViewportCanvases.tsx';
import { useLab } from './LabContext.tsx';
import { LoadingState } from './ui/LoadingState.tsx';
import { ProgressPanel } from './ui/ProgressPanel.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { ChoiceCard } from './ui/ChoiceCard.tsx';

type LabViewportProps = {
  webglRef: RefObject<HTMLCanvasElement | null>;
  webgpuRef: RefObject<HTMLCanvasElement | null>;
};

const isMeasured = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase('fr-FR');
  return normalized !== '' && !/^(?:--|—|non mesur)/.test(normalized);
};

export const hasPresentedFrame = (state: Pick<ReturnType<typeof useLab>['state'], 'framePresented' | 'stats'>) =>
  state.framePresented || [state.stats.submit, state.stats.cpuFrame, state.stats.fps, state.stats.drawCalls].some(isMeasured);

export function LabViewport({ webglRef, webgpuRef }: LabViewportProps) {
  const { state, emerald } = useLab();
  if (emerald) return <EmeraldViewport webglRef={webglRef} />;
  const algorithmic = new Set(['05-meshlets', '06-meshlet-culling', '07-hiz', '08-occlusion-culling', '09-gpu-compaction', '10-material-batching', '11-geometry-streaming', '12-visibility-buffer', '13-full-gpu-driven', '15-virtualized-integration']).has(state.moduleId);
  const sceneVisible = state.moduleId !== '00-baseline' && state.execution.status === 'running' && (algorithmic || state.showWebgl || state.showWebgpu);
  const renderReady = hasPresentedFrame(state);
  const progress = state.progress;
  const progressCount = progress?.completed !== undefined && progress.total !== undefined ? ` ${progress.completed}/${progress.total}` : '';
  const progressBytes = progress?.bytesLoaded !== undefined && progress.bytesTotal !== undefined ? ` · ${(progress.bytesLoaded / 1_048_576).toFixed(1)}/${(progress.bytesTotal / 1_048_576).toFixed(1)} Mio` : '';
  const loadingMessage = progress ? `${progress.itemType}${progressCount}${progress.itemName ? ` · ${progress.itemName}` : ''}${progressBytes}` : 'scène · préparation du banc';
  return (
    <main className="flex-1 min-w-0 min-h-0 w-full relative overflow-hidden bg-base-100 flex flex-col p-0">
      <div id="viewport-container" className="relative min-w-0 min-h-0 w-full h-full bg-base-100 overflow-hidden flex flex-col p-0">
        <div id="scene-container" className={`relative min-w-0 min-h-0 w-full p-0 ${sceneVisible ? 'flex-1' : 'hidden'}`}>
          {state.moduleId === '00-baseline' ? null : (
            <ViewportCanvases
              webglRef={webglRef}
              webgpuRef={webgpuRef}
              showWebgl={!algorithmic && state.showWebgl}
              showWebgpu={!algorithmic && state.showWebgpu}
            />
          )}

          {algorithmic && state.execution.status === 'running' && renderReady ? (
            <section data-algorithm-visualization={state.moduleId} className="absolute inset-0 flex items-center justify-center p-6 bg-base-100">
              <div className="w-full max-w-2xl rounded-box border border-base-content/10 bg-base-200 p-5 space-y-4">
                <p className="text-xs font-mono text-primary">{state.moduleId === '15-virtualized-integration' ? 'WebGPU · surface de mesure séparée' : `${progress?.itemType ?? 'calcul'} · contrôle algorithmique CPU`}</p>
                <h2 className="text-lg font-semibold">{progress?.message ?? state.execution.phase}</h2>
                {state.moduleId === '15-virtualized-integration' ? (
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono" aria-label="Scénarios du banc 15">
                    {['exact-resident', 'lod-resident', 'streaming-pressure'].map(name => (
                      <ChoiceCard key={name} pressed={progress?.phase === name} disabled className="p-2 text-center font-mono">
                        {name}
                      </ChoiceCard>
                    ))}
                  </div>
                ) : null}
                {(progress?.details ?? []).length ? <MetricGrid items={(progress?.details ?? []).map(detail => ({ label: detail.label, value: detail.value, ratio: detail.ratio }))} /> : null}
                {progress?.completed !== undefined && progress.total !== undefined ? <ProgressPanel message={progress.message ?? state.execution.phase} value={progress.completed} max={progress.total} /> : null}
              </div>
            </section>
          ) : null}

          {state.execution.status === 'running' && !renderReady ? (
            <div data-render-loading="true" className="absolute inset-0 z-20 flex items-center justify-center bg-base-100">
              <LoadingState message={`Préparation du rendu · ${loadingMessage}. ${progress?.message || state.execution.phase || state.benchStatus || 'Initialisation du moteur et de la scène…'} Les métriques restent non mesurées jusqu’à la première frame.`} />
            </div>
          ) : null}

          <div className="absolute bottom-3 left-3 bg-base-200/90 backdrop-blur-md border border-base-content/10 px-3 py-1.5 rounded-box text-[11px] font-mono text-base-content/80 flex items-center gap-2 shadow-lg pointer-events-none z-10">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
            <span id="viewport-telemetry-mode">{state.telemetryMode}</span>
            <span className="text-base-content/30">|</span>
            <span id="viewport-telemetry-detail" className="text-primary font-medium">{state.telemetryDetail}</span>
          </div>
        </div>
        <div id="viewport-workbench" className="hidden" />
        <div id="view-baseline" className="hidden" />
        <PreparationStation />
      </div>
    </main>
  );
}
