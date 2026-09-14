import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { sdkDistPath, readSdkProvenance } from '../shared/campaign/sdkProvenance.ts';

const run = promisify(execFile);

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sdk-provenance-'));
  await run('git', ['-C', dir, 'init', '-q']);
  await run('git', ['-C', dir, 'config', 'user.email', 'lab@example.test']);
  await run('git', ['-C', dir, 'config', 'user.name', 'Lab Test']);
  return dir;
}

async function commitAll(dir: string, message: string): Promise<string> {
  await run('git', ['-C', dir, 'add', '-A']);
  await run('git', ['-C', dir, 'commit', '-q', '-m', message]);
  const head = await run('git', ['-C', dir, 'rev-parse', 'HEAD']);
  return head.stdout.trim();
}

test('sdkDistPath : SDK_DIST prime sur le checkout lié, sinon <checkout>/dist', () => {
  const checkout = path.join(os.tmpdir(), 'some-engine-checkout');
  assert.equal(sdkDistPath({}, checkout), path.join(path.resolve(checkout), 'dist'));
  assert.equal(sdkDistPath({ SDK_DIST: '/custom/other-dist' }, checkout), path.resolve('/custom/other-dist'));
});

test('readSdkProvenance : la provenance vient du dépôt git qui contient le dist donné, pas du checkout par défaut', async () => {
  const repo = await initRepo();
  await mkdir(path.join(repo, 'dist'), { recursive: true });
  await writeFile(path.join(repo, 'README.md'), 'sdk\n');
  const commit = await commitAll(repo, 'initial');

  const provenance = await readSdkProvenance(path.join(repo, 'dist'));
  assert.deepEqual(
    { commit: provenance.commit, dirty: provenance.dirty, checkout: provenance.checkout },
    { commit: commit, dirty: false, checkout: repo },
  );

  await writeFile(path.join(repo, 'README.md'), 'sdk modifié\n');
  const dirtyProvenance = await readSdkProvenance(path.join(repo, 'dist'));
  assert.deepEqual(
    { commit: dirtyProvenance.commit, dirty: dirtyProvenance.dirty },
    { commit: commit, dirty: true },
  );
});

test('readSdkProvenance : le drapeau dirty ignore les fichiers suivis sous orchestration/ et docs/', async () => {
  const repo = await initRepo();
  await mkdir(path.join(repo, 'dist'), { recursive: true });
  await mkdir(path.join(repo, 'orchestration'), { recursive: true });
  await mkdir(path.join(repo, 'docs'), { recursive: true });
  await writeFile(path.join(repo, 'orchestration', 'log.txt'), 'journal\n');
  await writeFile(path.join(repo, 'docs', 'notes.md'), 'notes\n');
  await writeFile(path.join(repo, 'src.js'), 'export const x = 1;\n');
  await commitAll(repo, 'initial');

  await appendFile(path.join(repo, 'orchestration', 'log.txt'), 'ligne ajoutée\n');
  await appendFile(path.join(repo, 'docs', 'notes.md'), 'ligne ajoutée\n');
  const stillClean = await readSdkProvenance(path.join(repo, 'dist'));
  assert.equal(stillClean.dirty, false);

  await appendFile(path.join(repo, 'src.js'), 'export const y = 2;\n');
  const nowDirty = await readSdkProvenance(path.join(repo, 'dist'));
  assert.equal(nowDirty.dirty, true);
});
