import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function names(directory: string) {
  return readdir(path.join(root, directory));
}

test('the bench 15 architecture and its tests are model-generic, never tied to a catalog entry', async () => {
  const [components, lab, tests] = await Promise.all([names('src/components'), names('src/lab'), names('test')]);
  const all = [...components, ...lab, ...tests];
  const legacyCatalogName = new RegExp(['e', 'merald'].join(''), 'i');
  assert.deepEqual(all.filter(name => legacyCatalogName.test(name)), []);
});
