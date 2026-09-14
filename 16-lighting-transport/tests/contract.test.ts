import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { manifest, LIGHTING_PROTOCOL, createLightingBench, runLightingComparison } from '../index.ts';
import { checkContract } from '../../test/benchStructure.ts';
import { LAB_MANIFESTS } from '../../src/lab/manifests.ts';
import { MODULE_NAV, moduleTitle } from '../../src/lab/catalog.ts';
import { moduleUi } from '../../src/lab/moduleUi.ts';
import { moduleDescription } from '../../src/lab/modulePresentation.ts';

test('16-lighting-transport has one public route with its own light protocol', () => {
  checkContract(manifest);
  assert.equal(manifest.title, 'Lumière');
  assert.deepEqual(manifest.capabilities, ['webgl2']);
  assert.equal(LAB_MANIFESTS.filter(item => item.id === manifest.id).length, 1);
  assert.deepEqual(MODULE_NAV.filter(item => item.id === manifest.id), [{ id: manifest.id, label: '16 · Lumière' }]);
  assert.equal(moduleTitle(manifest.id), '16 · Lumière');
  assert.match(moduleDescription(manifest.id), /trois sources colorées/);
  const ui = moduleUi(manifest.id);
  assert.match(ui.protocol, /A\/A puis A\/B exactes/);
  assert.match(ui.backend, /WebGL2.*expérimental/);
  assert.doesNotMatch(JSON.stringify(ui), /Bistro|Emerald|quartiers|préparés|sélection LOD/);
  assert.equal(ui.showChart, false);
  assert.equal(ui.canStop, true);
  assert.equal(typeof createLightingBench, 'function');
  assert.equal(typeof runLightingComparison, 'function');
});

test('16-lighting-transport public metadata leaves execution behind lazy entry points', async () => {
  const entry = await readFile(new URL('../index.ts', import.meta.url), 'utf8');
  const metadata = await readFile(new URL('../manifest.ts', import.meta.url), 'utf8');
  assert.equal((entry.match(/await import\('\.\/runner\/index\.ts'\)/g) ?? []).length, 2);
  assert.doesNotMatch(entry, /(?:from|export\s+\*)\s*['"][^'"]*runner\//);
  assert.doesNotMatch(entry + metadata, /from\s*['"](?:three|vite|react|@web-geometry\/sdk)/);
  assert.equal(Object.isFrozen(LIGHTING_PROTOCOL), true);
  assert.deepEqual([LIGHTING_PROTOCOL.width, LIGHTING_PROTOCOL.height, LIGHTING_PROTOCOL.pixelRatio], [1280, 720, 1]);
  assert.deepEqual([LIGHTING_PROTOCOL.patches, LIGHTING_PROTOCOL.sourceTriangles], [282, 4158]);
  assert.deepEqual([LIGHTING_PROTOCOL.raysPerPatch, LIGHTING_PROTOCOL.reflectionSamples, LIGHTING_PROTOCOL.directLightSamples], [256, 8, 16]);
});
