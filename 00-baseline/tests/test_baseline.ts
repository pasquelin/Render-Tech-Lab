import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BASELINE_SCENARIOS, ReferenceEngineScene } from '../implementation/referenceEngine.ts';

export function runBaselineSuite() {
  const snapshot = (reference: ReferenceEngineScene): number[][] => reference.objects.flatMap(object => {
    if (object instanceof THREE.InstancedMesh) {
      const matrix = new THREE.Matrix4();
      return Array.from({ length: object.count }, (_, index) => {
        object.getMatrixAt(index, matrix);
        return matrix.toArray();
      });
    }
    return [object.matrix.toArray()];
  });
  assert.equal(BASELINE_SCENARIOS.length, 6);
  for (const scenario of BASELINE_SCENARIOS) {
    const reference = new ReferenceEngineScene(scenario);
    const repeated = new ReferenceEngineScene(scenario);
    assert(reference.scene);
    assert(reference.objects.length > 0);
    assert.deepEqual(
      snapshot(reference),
      snapshot(repeated),
      `${scenario.id} doit être déterministe`,
    );
    reference.dispose();
    repeated.dispose();
    assert.equal(reference.objects.length, 0);
  }
  console.log('Scènes S0–S5 vérifiées sur CPU ; aucun coude de performance déduit.');
}
if (import.meta.url === `file://${process.argv[1]}`) runBaselineSuite();
