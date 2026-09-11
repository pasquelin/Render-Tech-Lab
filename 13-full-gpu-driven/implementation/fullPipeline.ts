import type { PipelineStage, FullPipelineReport } from '../types.ts';
export interface FullPipelineInput { instanceCount: number; trianglesPerInstance: number; viewportWidth: number; viewportHeight: number }
const STAGES: PipelineStage[] = ['gpu-scene', 'frustum', 'lod', 'meshlets', 'meshlet-culling', 'hiz', 'occlusion', 'compaction', 'indirect-draw', 'shading'];
/** Pending integration contract. No physical pipeline has executed here. */
export function executeFullPipeline(input: FullPipelineInput): FullPipelineReport {
  if (Object.values(input).some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error('Invalid pipeline input');
  return { stages: STAGES.map(stage => ({ stage, durationMs: null, inputCount: null, outputCount: null, verdict: 'not-yet-decided' })),
    baselineReference: null, totalGainMs: null, verdict: 'not-yet-decided' };
}
