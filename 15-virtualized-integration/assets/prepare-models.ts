import { createHash } from 'node:crypto';
import { access, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';
import { prepare } from '@web-geometry/sdk/node';
import { benchmarkModels } from './modelCatalog.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ramBudgetMb = Math.floor(totalmem() / 1024 / 1024 * 0.9);
const selectedIds = process.argv.slice(2);
const selected = selectedIds.length === 0
  ? benchmarkModels
  : selectedIds.map(id => {
      const model = benchmarkModels.find(candidate => candidate.id === id);
      if (!model) throw new Error(`Modèle inconnu : ${id}. Modèles valides : ${benchmarkModels.map(candidate => candidate.id).join(', ')}`);
      return model;
    });

async function sha256(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function ensureRuntimeManifest(sourceDirectory: string, runtimeFile: string) {
  const runtimePath = resolve(root, sourceDirectory, runtimeFile);
  await access(runtimePath);
  const manifestPath = resolve(root, sourceDirectory, 'manifest.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (existing.status === 'ready' && typeof existing.runtime === 'object' && existing.runtime !== null) return;
  } catch {
    existing = {};
  }
  {
    const runtime = await stat(runtimePath);
    const sidecars = runtimeFile.endsWith('.gltf')
      ? (JSON.parse(await readFile(runtimePath, 'utf8')).buffers ?? []).flatMap(async (buffer: { uri?: unknown }) => {
          if (typeof buffer.uri !== 'string' || !buffer.uri || buffer.uri.startsWith('data:') || buffer.uri.includes('/') || buffer.uri.includes('..')) return [];
          const path = resolve(root, sourceDirectory, buffer.uri);
          return [{ file: buffer.uri, sha256: await sha256(path) }];
        })
      : [];
    await writeFile(manifestPath, `${JSON.stringify({
      ...existing,
      status: 'ready',
      formatVersion: 1,
      runtime: { file: runtimeFile, sha256: await sha256(runtimePath), sidecars: await Promise.all(sidecars).then(values => values.flat()), trianglesAcrossNodes: null, meshNodes: null, bytes: runtime.size },
    }, null, 2)}\n`);
  }
}

/** Affichage façon pnpm : une ligne vivante par modèle sur un terminal, des lignes simples sinon. */
function createProgress(id: string, index: number, total: number) {
  const tty = process.stderr.isTTY;
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const started = performance.now();
  let frame = 0;
  let primitives = 0;
  let label = 'manifeste source, nettoyage du dossier dérivé';
  let ratio: number | null = null;
  let lastPlain = '';
  let plainKey = '';
  const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1)}s`;
  const bar = () => {
    if (ratio === null) return '';
    const width = 24;
    const filled = Math.round(ratio * width);
    return ` [${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${Math.round(ratio * 100).toString().padStart(3)}%`;
  };
  const draw = () => {
    const line = `${spinner[frame++ % spinner.length]} ${index + 1}/${total} ${id}  ${label}${bar()}  ${elapsed()}`;
    if (tty) process.stderr.write(`\r\x1b[K${line}`);
    else if (plainKey !== lastPlain) { process.stderr.write(`${line}\n`); lastPlain = plainKey; }
  };
  const timer = tty ? setInterval(draw, 80) : null;
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(0)} Mo`;
  return {
    event(event: Record<string, unknown>) {
      if (event.event === 'complete') return;
      const phase = event.phase as string | undefined;
      const completed = Number(event.completed ?? 0);
      const totalCount = Number(event.total ?? 0);
      plainKey = `${event.event}:${phase ?? ''}:${event.step ?? ''}`;
      if (event.event === 'accepted') { label = 'lecture de la source'; ratio = null; }
      else if (phase === 'import-source') {
        const step = event.step as string;
        if (step === 'parse') { label = `import ${event.file} ${mb(completed)}/${mb(totalCount)}`; ratio = totalCount ? completed / totalCount : null; }
        else if (step === 'meshes') { label = `conversion des maillages ${completed}/${totalCount}`; ratio = totalCount ? completed / totalCount : null; }
        else if (step === 'write') { label = `écriture du glTF (${mb(Number(event.bytes ?? 0))})`; ratio = null; }
        else if (step === 'reused') { label = 'import réutilisé'; ratio = null; }
      }
      else if (phase === 'import') { label = 'géométrie source écrite, clusters…'; ratio = null; }
      else if (phase === 'primitive') { primitives += 1; label = `clusters : ${primitives} primitives`; ratio = null; }
      else if (phase === 'bootstrap') { label = `paquets racine ${completed}/${totalCount}`; ratio = totalCount ? completed / totalCount : null; }
      else if (phase === 'complete') { label = 'écriture du pointeur'; ratio = 1; }
      else if (event.event === 'error' || event.event === 'cancelled') { label = `erreur ${event.code ?? ''}`; ratio = null; }
      draw();
    },
    get primitives() { return primitives; },
    done(summary: string) {
      if (timer) clearInterval(timer);
      const line = `✔ ${index + 1}/${total} ${id}  ${summary}  ${elapsed()}`;
      process.stderr.write(tty ? `\r\x1b[K${line}\n` : `${line}\n`);
    },
    fail(message: string) {
      if (timer) clearInterval(timer);
      const line = `✖ ${index + 1}/${total} ${id}  ${message}  ${elapsed()}`;
      process.stderr.write(tty ? `\r\x1b[K${line}\n` : `${line}\n`);
    },
  };
}

for (const [index, model] of selected.entries()) {
  const progress = createProgress(model.id, index, selected.length);
  const sourceDirectory = resolve(root, model.sourceDirectory);
  const derivedDirectory = resolve(root, model.derivedDirectory);
  await ensureRuntimeManifest(model.sourceDirectory, model.runtimeFile);
  await rm(derivedDirectory, { recursive: true, force: true });
  const result = await prepare(sourceDirectory, derivedDirectory, 'full', 150000, {
    threads: 8,
    ramBudgetMb,
    resourceBaseUrl: `/${model.sourceDirectory.replace(/^public\//, '')}/`,
    simplification: 'qem-endpoints',
    onProgress: event => progress.event(event),
  }).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
  if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`${model.id} : préparation incomplète (${result.status})`); }
  progress.done(`${result.selectedTriangles.toLocaleString('fr-FR')} triangles, ${progress.primitives} primitives, ${Math.round(result.metrics.wallMs)} ms compilateur`);
  console.log(JSON.stringify({ model: model.id, status: result.status, triangles: result.selectedTriangles, scope: result.scope }));
}
