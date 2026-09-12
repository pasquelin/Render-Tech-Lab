import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { LabManifest } from '../shared/contracts/index.ts';
import { resolve, relative, dirname } from 'node:path';

export function checkStructure(id: string) {
  const allowedDirectories = new Set(['docs', 'scenarios', 'runner', 'implementation', 'fixtures', 'assets', 'tests', 'results']);
  const allowedFiles = new Set(['index.ts', 'manifest.ts', 'contracts.ts', 'README.md', 'index.html', 'comparison.html', 'smoke.html']);
  for (const entry of readdirSync(id, { withFileTypes: true })) {
    assert.ok((entry.isDirectory() ? allowedDirectories : allowedFiles).has(entry.name), `${id}/${entry.name} is outside the canonical layout`);
  }
  for (const file of sources(id)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /@deprecated Compatibility entry;/, `${file} is a legacy forwarding module`);
  }
  for (const entry of ['index.ts', 'manifest.ts', 'contracts.ts', 'README.md', 'docs/hypothesis.md', 'docs/protocol.md', 'docs/limits.md', 'docs/migration.md', 'scenarios/index.ts', 'scenarios/fixtures.ts', 'runner/index.ts', 'implementation', 'tests/contract.test.ts', 'tests/structure.test.ts', 'results/REPORT.md', 'results/latest.json']) {
    assert.ok(existsSync(resolve(id, entry)), `${id}/${entry} missing`);
  }
}
export function checkContract(manifest: LabManifest) {
  assert.equal(manifest.contractVersion, 1);
  assert.equal(manifest.id.slice(0, 2), manifest.number);
  assert.equal(manifest.publicEntry, `${manifest.id}/index.ts`);
  assert.ok(manifest.title.trim());
  assert.ok(manifest.description.trim());
  assert.ok(manifest.capabilities.length);
  assert.ok(['experimental', 'blocked'].includes(manifest.status));
  assert.ok(manifest.scenarios.length);
  assert.equal(new Set(manifest.scenarios.map(item => item.id)).size, manifest.scenarios.length);
  assert.ok(manifest.scenarios.every(item => item.id && item.title && typeof item.disabled === 'boolean'));
}
export function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (entry.name === 'results' ? [] : sources(`${dir}/${entry.name}`)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
}
export function checkImports(dir: string, bench?: string) {
  for (const file of sources(dir)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const path = relative(process.cwd(), resolve(dirname(file), match[1]));
      const target = /^(\d\d-[^/]+)\/(.*)$/.exec(path);
      if (!target || target[1] === bench) continue;
      assert.ok(['index.ts', 'manifest.ts'].includes(target[2]), `${file} imports private ${path}`);
    }
  }
}
