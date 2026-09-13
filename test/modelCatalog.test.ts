import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkModels, modelById } from '../15-virtualized-integration/assets/modelCatalog.ts';
import packageJson from '../package.json' with { type: 'json' };

test('the bench 15 model catalogue has stable unique ids and a prepared-cache location per model', () => {
  assert.ok(benchmarkModels.length >= 6);
  assert.equal(new Set(benchmarkModels.map(model => model.id)).size, benchmarkModels.length);
  for (const model of benchmarkModels) {
    assert.match(model.id, /^[a-z0-9-]+$/);
    assert.match(model.sourceDirectory, /^public\/benchmark-assets\/[a-z0-9-]+$/);
    assert.match(model.derivedDirectory, /^public\/benchmark-assets\/[a-z0-9-]+-derived$/);
    assert.equal(modelById(model.id), model);
  }
});

test('the model catalogue has no per-model preparation ceiling', () => {
  assert.equal('ramBudgetMb' in modelById('bistro-exterior')!, false);
  assert.equal('ramBudgetMb' in modelById('emerald-square')!, false);
});

test('the historic Emerald source is an ordinary model catalogue entry', () => {
  const emerald = modelById('emerald-square');
  assert.ok(emerald);
  assert.equal(emerald.label, 'Emerald Square');
  assert.equal(emerald.runtimeFile, 'emerald-day-smoke.glb');
});

test('one generic command prepares every bench 15 model', () => {
  assert.equal(packageJson.scripts['prepare:models'], 'node --experimental-strip-types 15-virtualized-integration/assets/prepare-models.ts');
  assert.equal('prepare:emerald' in packageJson.scripts, false);
});
