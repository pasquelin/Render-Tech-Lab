import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
import { atomicWrite, directoryRetention, writeReportPackage } from '../shared/archive/index.ts';

const RUN_ID = /^\d{8}T\d{9}Z-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const COMMON_SOURCE_FILES = ['benchmarks/lodComparisonPlugin.ts', 'package.json', 'pnpm-lock.yaml'] as const;
const LOD_SOURCE_FILES = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/style.css',
  'src/components/UnifiedLab.tsx',
  'src/components/LabShell.tsx',
  'src/components/LabViewport.tsx',
  'src/components/ViewportCanvases.tsx',
  'src/components/LabSidebar.tsx',
  'src/common/gpuContext.ts',
  'shared/gpu/timing.ts',
  '04-gpu-lod/implementation/gpuLodShader.ts',
  '04-gpu-lod/implementation/nativeLodRenderer.ts',
  '04-gpu-lod/implementation/nativeLodShaders.ts',
  '04-gpu-lod/runner/nativeComparison.ts',
  '04-gpu-lod/runner/nativePage.ts',
  '04-gpu-lod/implementation/cpuLodSelector.ts',
  'shared/math/screenSpaceError.ts',
  'shared/scene/random.ts',
  '04-gpu-lod/runner/variants.ts',
  '04-gpu-lod/runner/sceneComparison.ts',
  '04-gpu-lod/runner/comparisonTypes.ts',
  '04-gpu-lod/runner/comparisonReporter.ts',
  '04-gpu-lod/runner/comparisonPage.ts',
  '04-gpu-lod/runner/ComparisonApp.tsx',
  '04-gpu-lod/runner/comparisonMain.tsx',
  '04-gpu-lod/comparison.html',
  ...COMMON_SOURCE_FILES,
] as const;
const WORLD_SOURCE_FILES = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/style.css',
  'src/components/UnifiedLab.tsx',
  'src/components/LabShell.tsx',
  'src/components/LabViewport.tsx',
  'src/components/ViewportCanvases.tsx',
  'src/components/LabSidebar.tsx',
  '14-open-world/implementation/worldScene.ts',
  '14-open-world/implementation/adaptiveCulling.ts',
  '14-open-world/contracts.ts',
  '14-open-world/implementation/worldPage.ts',
  '14-open-world/scenarios/worldMatrix.ts',
  '14-open-world/index.html',
  '14-open-world/runner/reporter.ts',
  'public/benchmark-assets/bistro/manifest.json',
  ...COMMON_SOURCE_FILES,
] as const;
const runCommand = promisify(execFile);

export type ComparisonModuleId = '04-gpu-lod' | '14-open-world';

// Paths and report identities are fixed by the server, never supplied by HTTP clients.
function moduleConfiguration(id: ComparisonModuleId) {
  switch (id) {
    case '04-gpu-lod':
      return { id, test: '04-gpu-lod-comparison' as const, apiBase: '/api/lod-comparison',
        pluginName: 'lod-comparison-reports', sourceFiles: LOD_SOURCE_FILES };
    case '14-open-world':
      return { id, test: '14-open-world' as const, apiBase: '/api/world-comparison',
        pluginName: 'world-comparison-reports', sourceFiles: WORLD_SOURCE_FILES };
    default:
      throw new ComparisonRequestError('Module de comparaison inconnu.');
  }
}

export class ComparisonRequestError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface ComparisonReport extends Record<string, unknown> {
  test: '04-gpu-lod-comparison' | '14-open-world';
  timestamp: string;
  config: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validatePayload(value: unknown, expectedTest: ComparisonReport['test']): { report: ComparisonReport; markdown: string } {
  if (!isRecord(value) || !isRecord(value.report)) {
    throw new ComparisonRequestError('Un rapport de comparaison est requis.');
  }
  const report = value.report;
  if (report.test !== expectedTest || typeof report.timestamp !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(report.timestamp)
      || !Number.isFinite(Date.parse(report.timestamp))
      || new Date(report.timestamp).toISOString().slice(0, 19) !== report.timestamp.slice(0, 19)
      || !isRecord(report.config) || typeof value.markdown !== 'string' || !value.markdown.trim()) {
    throw new ComparisonRequestError('Rapport, timestamp UTC, configuration ou Markdown invalide.');
  }
  return { report: report as ComparisonReport, markdown: value.markdown };
}

function runInfo(id: string, report: ComparisonReport, apiBase: string, hasSources = true) {
  return {
    id,
    timestamp: report.timestamp,
    config: report.config,
    jsonUrl: `${apiBase}?run=${id}`,
    markdownUrl: `${apiBase}?run=${id}&format=markdown`,
    sourcesUrl: hasSources ? `${apiBase}?run=${id}&format=sources` : null,
  };
}

async function captureSources(root: string, moduleId: ComparisonModuleId, report: ComparisonReport) {
  const config = moduleConfiguration(moduleId);
  const files = Object.fromEntries(await Promise.all(config.sourceFiles.map(async file => {
    try {
      const bytes = await readFile(path.join(root, file));
      const text = bytes.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(bytes)) {
        throw new ComparisonRequestError(`Source non textuelle UTF-8 : ${file}.`, 409);
      }
      return [file, { text, sha256: createHash('sha256').update(bytes).digest('hex') }];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [file, { text: null, sha256: null }];
      throw error;
    }
  })));
  let provenanceVerification = 'unavailable';
  let publishLatest = true;
  if (report.provenance !== undefined) {
    const provenance = report.provenance;
    if (!isRecord(provenance)) {
      throw new ComparisonRequestError('Provenance absente ou instable : sauvegarde refusée.', 409);
    }
    const stable = provenance.sourcesStable === true;
    for (const phase of ['before', 'after']) {
      const metadata = provenance[phase];
      const hashes = isRecord(metadata) ? metadata.sourceHashes : undefined;
      if (!isRecord(hashes) || Object.keys(hashes).length !== config.sourceFiles.length
          || config.sourceFiles.some(file => !Object.hasOwn(hashes, file))) {
        throw new ComparisonRequestError(`Sources modifiées ou empreintes incomplètes (${phase}) : sauvegarde refusée.`, 409);
      }
      if (stable && config.sourceFiles.some(file => hashes[file] !== files[file].sha256)) {
        throw new ComparisonRequestError(`Sources modifiées ou empreintes incomplètes (${phase}) : sauvegarde refusée.`, 409);
      }
    }
    if (stable) provenanceVerification = 'matched-before-and-after';
    else {
      provenanceVerification = 'unstable-archived';
      publishLatest = false;
    }
  }
  return { schemaVersion: 1, moduleId, capturedAt: new Date().toISOString(), provenanceVerification, publishLatest,
    sourceSetSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}

/** Comparison evidence uses the same isolated report package as every other bench. */
export function createLodComparisonStore(root: string, moduleId: ComparisonModuleId = '04-gpu-lod') {
  const config = moduleConfiguration(moduleId);
  const reportRoot = path.join(root, 'reports', config.test);
  // Serialize latest publication so concurrent requests cannot mix two campaigns.
  let pending: Promise<unknown> = Promise.resolve();

  async function save(value: unknown) {
    const payload = validatePayload(value, config.test);
    const serialized = JSON.stringify(payload);
    const snapshot = validatePayload(JSON.parse(serialized), config.test);
    const operation = pending.then(async () => {
      // Hash the exact retained text; compare before any archive/latest publication.
      const sources = await captureSources(root, config.id, snapshot.report);
      const id = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID()}`;
      const { publishLatest, ...archivedSources } = sources;
      const packageReport = await writeReportPackage(root, { testId: config.test, id: `campaign-${id}`, humanMarkdown: snapshot.markdown, result: { report: snapshot.report, sources: archivedSources }, archivedAt: snapshot.report.timestamp });
      if (publishLatest) {
        await atomicWrite(path.join(reportRoot, 'latest.json'), `${JSON.stringify({ archivedAt: snapshot.report.timestamp, reportPackage: path.basename(packageReport.directory) }, null, 2)}\n`);
      }
      await directoryRetention(reportRoot, 'campaign-', true);
      return { ...runInfo(id, snapshot.report, config.apiBase), published: publishLatest };
    });
    pending = operation.catch(() => undefined);
    return operation;
  }

  async function read(id: string, format: 'json' | 'markdown' | 'sources' = 'json') {
    if (!RUN_ID.test(id)) throw new ComparisonRequestError('Identifiant de campagne invalide.');
    try {
      const directory = path.join(reportRoot, `campaign-${id}`);
      if (format === 'markdown') return await readFile(path.join(directory, 'REPORT.md'), 'utf8');
      const stored = JSON.parse(gunzipSync(await readFile(path.join(directory, 'objects', 'result.json.gz'))).toString('utf8')) as { report?: unknown; sources?: unknown };
      return `${JSON.stringify(format === 'sources' ? stored.sources : stored.report, null, 2)}\n`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ComparisonRequestError('Campagne introuvable.', 404);
      }
      throw error;
    }
  }

  async function history() {
    await pending;
    let names: string[];
    try { names = await readdir(reportRoot); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const runs = [];
    for (const name of names.sort().reverse()) {
      if (!name.startsWith('campaign-') || !RUN_ID.test(name.slice('campaign-'.length))) continue;
      const stored = JSON.parse(gunzipSync(await readFile(path.join(reportRoot, name, 'objects', 'result.json.gz'))).toString('utf8')) as { report?: unknown };
      const report: unknown = stored.report;
      const validated = validatePayload({ report, markdown: 'archive' }, config.test);
      const id = name.slice('campaign-'.length);
      runs.push(runInfo(id, validated.report, config.apiBase));
    }
    return runs;
  }
  return { save, read, history };
}

export async function readLodComparisonMetadata(root: string, moduleId: ComparisonModuleId = '04-gpu-lod') {
  const config = moduleConfiguration(moduleId);
  const sourceHashes = Object.fromEntries(await Promise.all(config.sourceFiles.map(async file => {
    try { return [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')]; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [file, null];
      throw error;
    }
  })));
  let commit: string | null = null;
  try {
    const result = await runCommand('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 2000, maxBuffer: 1024 });
    commit = /^[a-f0-9]{40,64}$/.test(result.stdout.trim()) ? result.stdout.trim() : null;
  } catch { /* A source archive need not contain a Git repository. */ }
  const cpus = os.cpus();
  return {
    timestamp: new Date().toISOString(), node: process.version,
    os: { platform: process.platform, release: os.release(), arch: process.arch },
    cpu: { model: cpus[0]?.model ?? null, logicalCount: cpus.length },
    memoryBytes: os.totalmem(), commit, sourceHashes,
  };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(bytes);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ComparisonRequestError('JSON invalide.')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new ComparisonRequestError('Envoi interrompu.')));
  });
}

function jsonResponse(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

export function createLodComparisonPlugin(options: { id?: ComparisonModuleId } = {}): Plugin {
  const config = moduleConfiguration(options.id ?? '04-gpu-lod');
  return {
    name: config.pluginName,
    configureServer(server) {
      const store = createLodComparisonStore(server.config.root, config.id);
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (![config.apiBase, `${config.apiBase}/meta`, `${config.apiBase}/history`, `${config.apiBase}/system`].includes(url.pathname)) {
          next(); return;
        }
        void (async () => {
          if (req.method === 'GET' && url.pathname.endsWith('/system')) {
            const cpus = os.cpus();
            const cpuTimes = cpus.reduce((sum, cpu) => ({
              idle: sum.idle + cpu.times.idle,
              total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
            }), { idle: 0, total: 0 });
            jsonResponse(res, 200, { sampledAtMs: Date.now(), cpuTimes, freeMemoryBytes: os.freemem(),
              totalMemoryBytes: os.totalmem(), loadAverage: os.loadavg(), cpuModel: cpus[0]?.model ?? null,
              logicalCpuCount: cpus.length });
          } else if (req.method === 'GET' && url.pathname.endsWith('/meta')) {
            jsonResponse(res, 200, await readLodComparisonMetadata(server.config.root, config.id));
          } else if (req.method === 'GET' && url.pathname.endsWith('/history')) {
            jsonResponse(res, 200, { runs: await store.history() });
          } else if (req.method === 'GET' && url.pathname === config.apiBase) {
            const format = url.searchParams.get('format') ?? 'json';
            if (format !== 'json' && format !== 'markdown' && format !== 'sources') throw new ComparisonRequestError('Format invalide.');
            const content = await store.read(url.searchParams.get('run') ?? '', format);
            res.setHeader('Content-Type', format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(content);
          } else if (req.method === 'POST' && url.pathname === config.apiBase) {
            if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
              throw new ComparisonRequestError('Content-Type application/json requis.', 415);
            }
            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
              throw new ComparisonRequestError('Origine de requête invalide.', 403);
            }
            jsonResponse(res, 201, { success: true, ...await store.save(await readBody(req)) });
          } else jsonResponse(res, 405, { error: 'Méthode non autorisée.' });
        })().catch(error => {
          jsonResponse(res, error instanceof ComparisonRequestError ? error.statusCode : 500,
            { error: error instanceof ComparisonRequestError ? error.message : 'Impossible de traiter la campagne.' });
        });
      });
    },
  };
}
