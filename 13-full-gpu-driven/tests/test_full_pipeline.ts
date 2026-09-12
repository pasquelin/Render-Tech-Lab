import assert from 'node:assert/strict';
import { executeFullPipeline, inspectPipelineReadiness, REQUIRED_DEPENDENCIES } from '../implementation/fullPipeline.ts';
export function runFullPipelineSuite() {
  const result = executeFullPipeline({ instanceCount: 100000, trianglesPerInstance: 384, viewportWidth: 1920, viewportHeight: 1080, dependencies: [] });
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockers.length, REQUIRED_DEPENDENCIES.length);
  assert.equal(result.stages.length, 10);
  assert.equal(result.totalGainMs, null);
  assert.equal(result.verdict, 'not-yet-decided');
  assert(result.stages.every(s => s.durationMs === null && s.outputCount === null));
  const ready = REQUIRED_DEPENDENCIES.map(test => ({ test, status: 'measured' as const, verdict: 'INTEGRATE' as const }));
  assert.deepEqual(inspectPipelineReadiness(ready), []);
  assert.throws(() => executeFullPipeline({ instanceCount: 1, trianglesPerInstance: 1, viewportWidth: 1, viewportHeight: 1, dependencies: ready }), /pas encore branché/);
}
if (import.meta.url === `file://${process.argv[1]}`) runFullPipelineSuite();
