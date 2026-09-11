import assert from 'node:assert/strict';
import { BASELINE_SCENARIOS, ReferenceEngineScene } from '../baseline/referenceEngine.ts';

export function runBaselineSuite() {
  assert.equal(BASELINE_SCENARIOS.length, 6);
  for (const scenario of BASELINE_SCENARIOS) {
    const reference = new ReferenceEngineScene(scenario);
    assert(reference.scene);
    assert(reference.objects.length > 0);
  }
  console.log('Scènes S0–S5 vérifiées sur CPU ; aucun coude de performance déduit.');
}
if (import.meta.url === `file://${process.argv[1]}`) runBaselineSuite();
