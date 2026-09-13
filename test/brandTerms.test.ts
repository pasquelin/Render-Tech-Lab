import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const prohibited = new RegExp(['un','real', '|na','nite'].join(''), 'i');

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => entry.isDirectory()
    ? files(join(directory, entry.name))
    : /\.(?:ts|tsx|md|mjs)$/.test(entry.name) ? [join(directory, entry.name)] : []));
  return nested.flat();
}

test('the Lab has no third-party engine brand in source or bench text', async () => {
  const targets = [...await files('src'), ...await files('15-virtualized-integration'), 'README.md'];
  const matches = await Promise.all(targets.map(async file => ({ file, text: await readFile(file, 'utf8') })));
  assert.deepEqual(matches.filter(({ text }) => prohibited.test(text)).map(({ file }) => file), []);
});
