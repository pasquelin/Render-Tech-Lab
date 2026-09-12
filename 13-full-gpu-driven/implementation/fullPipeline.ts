import type { BenchId, PipelineBlocker, PipelineDependency, PipelineStage, FullPipelineReport } from '../contracts.ts';
export interface FullPipelineInput { instanceCount: number; trianglesPerInstance: number; viewportWidth: number; viewportHeight: number; dependencies?: PipelineDependency[] }
export const REQUIRED_DEPENDENCIES: readonly BenchId[] = ['01-indirect-draw','02-gpu-frustum-culling','03-gpu-scene','04-gpu-lod','05-meshlets','06-meshlet-culling','07-hiz','08-occlusion-culling','09-gpu-compaction','10-material-batching','11-geometry-streaming','12-visibility-buffer'];
export const STAGES: readonly PipelineStage[] = ['gpu-scene', 'frustum', 'lod', 'meshlets', 'meshlet-culling', 'hiz', 'occlusion', 'compaction', 'indirect-draw', 'shading'];
export function inspectPipelineReadiness(dependencies: PipelineDependency[]): PipelineBlocker[] {
  const byTest = new Map(dependencies.map(item => [item.test, item]));
  const blockers: PipelineBlocker[] = [];
  for (const test of REQUIRED_DEPENDENCIES) {
    const item = byTest.get(test);
    if (!item || item.status !== 'measured') blockers.push({ test, reason: 'not-measured' });
    else if (item.verdict === 'REJECT') blockers.push({ test, reason: 'rejected' });
    else if (item.verdict === 'not-yet-decided') blockers.push({ test, reason: 'not-decided' });
  }
  return blockers;
}
/** Readiness orchestrator only. It refuses to impersonate a physical pipeline. */
export function executeFullPipeline(input: FullPipelineInput): FullPipelineReport {
  const dimensions = [input.instanceCount, input.trianglesPerInstance, input.viewportWidth, input.viewportHeight];
  if (dimensions.some(v => !Number.isSafeInteger(v) || v < 1)) throw new Error('Invalid pipeline input');
  const blockers = inspectPipelineReadiness(input.dependencies ?? []);
  if (blockers.length === 0) throw new Error('Dépendances prêtes, mais le pipeline physique 13 n’est pas encore branché.');
  return { status: 'blocked', blockers, stages: STAGES.map(stage => ({ stage, durationMs: null, inputCount: null, outputCount: null, verdict: 'not-yet-decided' })),
    baselineReference: null, totalGainMs: null, verdict: 'not-yet-decided' };
}
