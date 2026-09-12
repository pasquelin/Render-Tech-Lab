import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import test from 'node:test';
import { checkImports } from './benchStructure.ts';
import { LAB_MANIFESTS } from '../src/lab/manifests.ts';

test('workspace contains exactly one numbered directory for every bench 00 through 15', async () => {
  const actual = (await readdir('.')).filter(name => /^\d\d-/.test(name)).sort();
  assert.deepEqual(actual.map(name => name.slice(0, 2)), Array.from({ length: 16 }, (_, i) => String(i).padStart(2, '0')));
  assert.equal(new Set(actual.map(name => name.slice(0, 2))).size, 16);
});

async function filesBelow(root: string): Promise<string[]> {
  try { await stat(root); } catch { return []; }
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesBelow(path)); else files.push(path);
  }
  return files;
}

test('Rust asset cores live in root packages and packages stay UI and bench independent', async () => {
  for (const bench of (await readdir('.')).filter(name => /^\d\d-/.test(name))) {
    const forbidden = (await filesBelow(bench)).filter(path => path.endsWith('.rs') || path.endsWith('/Cargo.toml'));
    assert.deepEqual(forbidden, [], `${bench} contient un cœur Rust; le déplacer sous packages/`);
  }
  for (const path of (await filesBelow('packages')).filter(path => /\.(?:rs|ts|tsx|js|mjs)$/.test(path))) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /(?:from\s+|require\()['"](?:react|vite|electron|\.\.\/\.\.\/\d\d-)/, `${path} dépend d'une UI ou d'un banc`);
  }
  for (const bench of (await readdir('.')).filter(name => /^\d\d-/.test(name))) {
    for (const path of (await filesBelow(bench)).filter(path => /\.(?:ts|tsx|js|mjs)$/.test(path))) {
      const source = await readFile(path, 'utf8');
      assert.doesNotMatch(source, /packages\/(?:sdk-core|sdk-node|sdk-browser|sdk-react|sdk-electron)\/(?:src|internal)\//, `${path} contourne un point d'entrée SDK public`);
    }
  }
});

test('all manifests are versioned and src/lab uses only public bench entries', async () => {
  assert.equal(LAB_MANIFESTS.length, 16);
  assert.deepEqual(LAB_MANIFESTS.map(item => item.number), Array.from({ length: 16 }, (_, i) => String(i).padStart(2, '0')));
  assert.ok(LAB_MANIFESTS.every(item => item.contractVersion === 1));
  checkImports('src/lab');
});

test('canonical docs separate Lab evidence from Web Geometry product requirements', async () => {
  const principles = await readFile('docs/PRINCIPES_DU_LAB.md', 'utf8');
  const readme = await readFile('README.md', 'utf8');
  assert.match(principles, /webGeometry\/docs\/architecture\/PRINCIPES_DU_PRODUIT\.md/);
  assert.match(readme, /webGeometry\/docs\/architecture\/PRINCIPES_DU_PRODUIT\.md/);
  for (const term of ['Provenance réelle', 'Comparaisons équivalentes', 'Avant/après et golden', 'Petits budgets']) {
    assert.ok(principles.includes(term));
  }
  assert.match(principles, /CONTRATS_DONNEES_ET_TESTS\.md#9-contrat-des-résultats/);
  assert.doesNotMatch(principles, /aucun manifeste de package/);
  assert.doesNotMatch(readme, /has no package manifest/);
});

test('shared orchestration and archive consume public bench APIs', () => {
  checkImports('shared/benchmark');
  checkImports('shared/archive');
});
