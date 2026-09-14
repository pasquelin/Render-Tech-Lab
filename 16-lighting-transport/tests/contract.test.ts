import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { manifest, SCENES, MAX_ENGINE_LIGHTS, MAX_SHADOWED_LIGHTS_PER_FRAME, AUTO_LIGHT_MIN, AUTO_LIGHT_MAX, createLightingBench } from '../index.ts';
import { checkContract } from '../../test/benchStructure.ts';
import { LAB_MANIFESTS } from '../../src/lab/manifests.ts';
import { MODULE_NAV, moduleTitle } from '../../src/lab/catalog.ts';
import { moduleUi } from '../../src/lab/moduleUi.ts';
import { moduleDescription } from '../../src/lab/modulePresentation.ts';

test('16-lighting-transport is a test bench for two scenes, called through the public SDK API', () => {
  checkContract(manifest);
  assert.equal(manifest.title, 'Lumière');
  assert.deepEqual(manifest.capabilities, ['webgl2']);
  assert.equal(LAB_MANIFESTS.filter(item => item.id === manifest.id).length, 1);
  assert.deepEqual(MODULE_NAV.filter(item => item.id === manifest.id), [{ id: manifest.id, label: '16 · Lumière' }]);
  assert.equal(moduleTitle(manifest.id), '16 · Lumière');
  assert.match(moduleDescription(manifest.id), /deux scènes/i);
  assert.doesNotMatch(moduleDescription(manifest.id), /Emerald|Bistro|quartiers/);
  const ui = moduleUi(manifest.id);
  assert.doesNotMatch(JSON.stringify(ui), /Emerald|Bistro|quartiers|préparés|sélection LOD/);
  assert.equal(ui.showChart, false);
  assert.equal(ui.canStop, true);
  assert.equal(typeof createLightingBench, 'function');
  assert.deepEqual(SCENES.map(scene => scene.id), ['house', 'emerald-night']);
  assert.equal(MAX_ENGINE_LIGHTS, 64);
  assert.equal(MAX_SHADOWED_LIGHTS_PER_FRAME, 4);
  assert.equal(AUTO_LIGHT_MIN, 1);
  assert.equal(AUTO_LIGHT_MAX, 30);
});

test('16-lighting-transport public metadata leaves execution behind a lazy runner entry point', async () => {
  const entry = await readFile(new URL('../index.ts', import.meta.url), 'utf8');
  const metadata = await readFile(new URL('../manifest.ts', import.meta.url), 'utf8');
  assert.match(entry, /await import\('\.\/runner\/index\.ts'\)/);
  assert.doesNotMatch(entry, /(?:from|export\s+\*)\s*['"][^'"]*runner\//);
  assert.doesNotMatch(entry + metadata, /from\s*['"](?:three|vite|react|@web-geometry\/sdk)/);
});
