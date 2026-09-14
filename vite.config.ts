import { createModelAssetsPlugin } from './15-virtualized-integration/assets/vite.ts';
import { createLightingAssetsPlugin } from './16-lighting-transport/assets/vite.ts';
import { createLightingArchivePlugin } from './16-lighting-transport/assets/archive.ts';
import { createIntegrationArchivePlugin } from './shared/archive/integration.ts';
import { createLodComparisonPlugin } from './benchmarks/lodComparisonPlugin.ts';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { writeReportArchive, writeStreamedReportArchive } from './shared/archive/index.ts';

async function streamedReportRequest(req: NodeJS.ReadableStream) {
  const iterator = req[Symbol.asyncIterator]();
  let header = Buffer.alloc(0), rest: Buffer | null = null;
  for (;;) {
    const next = await iterator.next();
    if (next.done) throw new Error('En-tête de rapport manquant.');
    header = Buffer.concat([header, Buffer.from(next.value)]);
    const newline = header.indexOf(10);
    if (newline < 0) {
      if (header.byteLength > 1024 * 1024) throw new Error('En-tête de rapport trop volumineux.');
      continue;
    }
    rest = header.subarray(newline + 1);
    header = header.subarray(0, newline);
    break;
  }
  const metadata = JSON.parse(header.toString('utf8')) as { testId?: unknown; markdown?: unknown };
  if (typeof metadata.testId !== 'string' || typeof metadata.markdown !== 'string') throw new Error('En-tête de rapport invalide.');
  async function* body() { if (rest?.byteLength) yield rest; for (;;) { const next = await iterator.next(); if (next.done) return; yield Buffer.from(next.value); } }
  return { header: { testId: metadata.testId, humanMarkdown: metadata.markdown }, result: Readable.from(body()) };
}

function saveReportPlugin(): Plugin {
  return {
    name: 'save-report-plugin',
    configureServer(server) {
      // 1. Sauvegarde du rapport Markdown sur disque
      server.middlewares.use('/api/save-report', (req, res) => {
        if (req.method === 'POST') {
          if (req.headers['content-type'] === 'application/x-rtl-streamed-report') {
            void (async () => {
              try {
                const { header, result } = await streamedReportRequest(req);
                const saved = await writeStreamedReportArchive(server.config.root, header, result);
                res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, ...saved }));
              } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
            })();
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const testId = data.testId || '01-indirect-draw';
              const markdown = data.markdown;

              if (markdown) {
                const saved = await writeReportArchive(server.config.root, { testId, markdown, latest: data.latest && typeof data.latest === 'object' ? data.latest : undefined, engineEvents: Array.isArray(data.engineEvents) ? data.engineEvents : undefined });

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, ...saved }));
                return;
              }
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing markdown content' }));
          });
        } else {
          res.statusCode = 404;
          res.end();
        }
      });

      server.middlewares.use('/api/emerald-archive', (req, res) => {
        if (req.method === 'GET') {
          try {
            const file = path.resolve(server.config.root, 'benchmark-runs/checks/emerald-path/latest.json');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(fs.readFileSync(file, 'utf-8'));
          } catch {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Aucun parcours de modèle archivé.' }));
          }
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const report = JSON.parse(body);
            if (!report || report.version !== 1 || typeof report.id !== 'string' || !Array.isArray(report.samples)) {
              throw new Error('Invalid benchmark report');
            }
            const dir = path.resolve(server.config.root, 'benchmark-runs/checks/emerald-path');
            fs.mkdirSync(dir, { recursive: true });
            const stamp = String(report.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '');
            const file = path.join(dir, `${stamp}-${report.id}.json`);
            const json = `${JSON.stringify(report)}\n`;
            fs.writeFileSync(file, json);
            fs.writeFileSync(path.join(dir, 'latest.json'), json);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, file }));
          } catch (err: unknown) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      });

      // 2. Lecture du rapport pour affichage dans l'application
      const handleGetReport = (req: any, res: any) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const rawId = url.searchParams.get('testId') || '01-indirect-draw';
          const testId = path.basename(rawId);
          const indexPath = path.resolve(server.config.root, 'reports', testId, 'latest.json');
          const latest = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')).reportPackage : null;
          const reportPath = typeof latest === 'string' && /^[A-Za-z0-9-]+$/.test(latest) ? path.resolve(server.config.root, 'reports', testId, latest, 'REPORT.md') : null;
          const requestedPreview = Number(url.searchParams.get('previewBytes'));

          const existing = reportPath && fs.existsSync(reportPath) ? reportPath : null;
          if (req.method === 'HEAD') {
            res.statusCode = 200;
            res.setHeader('X-Report-Available', existing ? 'true' : 'false');
            res.end();
            return;
          }
          if (existing) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            const size = fs.statSync(existing).size;
            const preview = Number.isSafeInteger(requestedPreview) && requestedPreview > 0 ? Math.min(requestedPreview, size) : size;
            if (preview < size) res.setHeader('X-Report-Truncated', 'true');
            fs.createReadStream(existing, { start: 0, end: Math.max(0, preview - 1) }).on('error', error => { if (!res.writableEnded) { res.statusCode = 500; res.end(`Erreur serveur : ${error.message}`); } }).pipe(res);
          } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(`Rapport "${testId}" non trouvé. Exécutez d'abord le benchmark.`);
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(`Erreur serveur : ${err.message}`);
        }
      };

      server.middlewares.use('/api/get-report', handleGetReport);
      server.middlewares.use('/api/read-report', handleGetReport);
      server.middlewares.use('/api/report-artifact', (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const packagePath = String(url.searchParams.get('package') || '');
          const file = String(url.searchParams.get('file') || '');
          if (!/^\d\d-[a-z0-9-]+\/campaign-[a-z0-9-]+$/.test(packagePath) || !/^(objects|logs|media)\/[a-zA-Z0-9._-]+$/.test(file)) throw new Error('Chemin de rapport invalide');
          const base = path.resolve(server.config.root, 'reports', packagePath);
          const target = path.resolve(base, file);
          if (!target.startsWith(`${base}${path.sep}`) || !fs.statSync(target).isFile()) throw new Error('Artefact absent');
          const extension = path.extname(target).toLowerCase();
          const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.gz': 'application/gzip', '.jsonl': 'application/x-ndjson' };
          res.statusCode = 200;
          res.setHeader('Content-Type', types[extension] || 'application/octet-stream');
          fs.createReadStream(target).pipe(res);
        } catch {
          res.statusCode = 404;
          res.end('Artefact de rapport introuvable.');
        }
      });

      // 3. Lecture des métriques latest.json pour le module
      server.middlewares.use('/api/get-latest', (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const rawId = url.searchParams.get('testId') || '01-indirect-draw';
          const testId = path.basename(rawId);
          const jsonPath = path.resolve(server.config.root, testId, 'results', 'latest.json');

          if (fs.existsSync(jsonPath)) {
            const data = fs.readFileSync(jsonPath, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Fichier latest.json non trouvé pour ${testId}` }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // 3. Révélation du dossier ou fichier dans le Finder / Explorer de l'OS
      server.middlewares.use('/api/open-folder', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const rawId = data.testId || '01-indirect-draw';
              const testId = path.basename(rawId);
              const folderType = data.folder || 'reports';

              const targetDir =
                folderType === 'local'
                  ? path.resolve(server.config.root, testId, 'results')
                  : path.resolve(server.config.root, 'reports');

              const targetFile =
                folderType === 'local'
                  ? path.resolve(targetDir, 'REPORT.md')
                  : path.resolve(targetDir, `${testId}.md`);

              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

              import('node:child_process').then(({ exec }) => {
                let cmd = '';
                if (process.platform === 'darwin') {
                  // Sur macOS : si le fichier cible existe, on le révèle dans Finder avec -R
                  // Sinon on ouvre directement le dossier.
                  if (fs.existsSync(targetFile)) {
                    cmd = `open -R "${targetFile}"`;
                  } else {
                    cmd = `open "${targetDir}"`;
                  }
                } else if (process.platform === 'win32') {
                  cmd = fs.existsSync(targetFile)
                    ? `explorer.exe /select,"${targetFile}"`
                    : `explorer.exe "${targetDir}"`;
                } else {
                  cmd = `xdg-open "${targetDir}"`;
                }

                exec(cmd, (error) => {
                  if (error) {
                    console.error('Erreur ouverture Finder/Explorer :', error.message);
                  }
                });
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  targetDir,
                  targetFile: fs.existsSync(targetFile) ? targetFile : null,
                })
              );
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          });
        } else {
          res.statusCode = 404;
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [createLightingAssetsPlugin(),createLightingArchivePlugin(),createModelAssetsPlugin(),createIntegrationArchivePlugin(), react(), tailwindcss(), saveReportPlugin(), createLodComparisonPlugin(), createLodComparisonPlugin({ id: '14-open-world' })],
  resolve: { dedupe: ['three', 'react', 'react-dom'] },
  optimizeDeps: { exclude: ['@web-geometry/sdk'] },
  cacheDir: '.vite',
  server: {
    port: 5174, // Port explicite pour éviter tout conflit avec d'autres apps
    open: false,
    watch: {
      // Les campagnes écrivent leurs rapports dans l'arborescence surveillée.
      // Sans cette exclusion, /api/save-report déclenche un rechargement complet
      // à la fin de chaque benchmark et efface les résultats tout juste mesurés.
      ignored: ['**/results/**', '**/reports/**', '**/benchmark-runs/**', '**/public/benchmark-assets/**'],
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: { input: { integrationSmoke: path.resolve('15-virtualized-integration/smoke.html'), app: path.resolve('index.html'), bench: path.resolve('bench/index.html'), lodComparison: path.resolve('04-gpu-lod/comparison.html'), worldComparison: path.resolve('14-open-world/index.html') } },
  },
  assetsInclude: ['**/*.wgsl'],
});
