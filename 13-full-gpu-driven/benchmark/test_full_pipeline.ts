import assert from 'node:assert/strict';
import { executeFullPipeline } from '../implementation/fullPipeline.ts';
export function runFullPipelineSuite() {
  const result = executeFullPipeline({ instanceCount: 100000, trianglesPerInstance: 384, viewportWidth: 1920, viewportHeight: 1080 });
  assert.equal(result.stages.length, 10);
  assert.equal(result.totalGainMs, null);
  assert.equal(result.verdict, 'not-yet-decided');
  assert(result.stages.every(s => s.durationMs === null && s.outputCount === null));
}
if (import.meta.url === `file://${process.argv[1]}`) runFullPipelineSuite();
