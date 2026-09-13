import { createEmeraldAssetsPlugin } from './15-virtualized-integration/assets/vite.ts';
import { createIntegrationArchivePlugin } from './shared/archive/integration.ts';
import { createLodComparisonPlugin } from './benchmarks/lodComparisonPlugin.ts';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { directoryRetention } from './shared/archive/index.ts';

function saveReportPlugin(): Plugin {
  return {
    name: 'save-report-plugin',
    configureServer(server) {
      // 1. Sauvegarde du rapport Markdown sur disque
      server.middlewares.use('/api/save-report', (req, res) => {
        if (req.method === 'POST') {
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
                // Sauvegarde locale au module
                const testReportPath = path.resolve(server.config.root, testId, 'results', 'REPORT.md');
                fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
                fs.writeFileSync(testReportPath, markdown, 'utf-8');

                // Sauvegarde synchronisée dans reports/
                const globalReportPath = path.resolve(server.config.root, 'reports', `${testId}.md`);
                fs.mkdirSync(path.dirname(globalReportPath), { recursive: true });
                fs.writeFileSync(globalReportPath, markdown, 'utf-8');

                if (data.latest && typeof data.latest === 'object') {
                  const campaignsDir = path.resolve(server.config.root, testId, 'results', 'campaigns');
                  const campaignDir = path.join(campaignsDir, `campaign-${randomUUID()}`);
                  fs.mkdirSync(campaignDir, { recursive: true });
                  fs.writeFileSync(path.join(campaignDir, 'raw.json'), `${JSON.stringify({ archivedAt: data.latest.timestamp ?? new Date().toISOString(), result: data.latest }, null, 2)}\n`, 'utf-8');
                  fs.writeFileSync(path.join(campaignDir, 'report.md'), markdown, 'utf-8');
                  const latestPath = path.resolve(server.config.root, testId, 'results', 'latest.json');
                  const temporaryLatest = `${latestPath}.${randomUUID()}.tmp`;
                  fs.writeFileSync(temporaryLatest, `${JSON.stringify(data.latest, null, 2)}\n`, 'utf-8');
                  fs.renameSync(temporaryLatest, latestPath);
                  await directoryRetention(campaignsDir, 'campaign-', true);
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, testReportPath, globalReportPath }));
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
            res.end(JSON.stringify({ error: 'Aucun parcours Emerald archivé.' }));
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
              throw new Error('Invalid emerald report');
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
          const reportPath = path.resolve(server.config.root, 'reports', `${testId}.md`);
          const localReportPath = path.resolve(server.config.root, testId, 'results', 'REPORT.md');

          let content = '';
          if (fs.existsSync(reportPath)) {
            content = fs.readFileSync(reportPath, 'utf-8');
          } else if (fs.existsSync(localReportPath)) {
            content = fs.readFileSync(localReportPath, 'utf-8');
          }

          if (content) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(content);
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
  plugins: [createEmeraldAssetsPlugin(),createIntegrationArchivePlugin(), react(), tailwindcss(), saveReportPlugin(), createLodComparisonPlugin(), createLodComparisonPlugin({ id: '14-open-world' })],
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
      ignored: ['**/results/**', '**/reports/**', '**/public/benchmark-assets/**'],
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: { input: { integrationSmoke: path.resolve('15-virtualized-integration/smoke.html'), app: path.resolve('index.html'), bench: path.resolve('bench/index.html'), lodComparison: path.resolve('04-gpu-lod/comparison.html'), worldComparison: path.resolve('14-open-world/index.html') } },
  },
  assetsInclude: ['**/*.wgsl'],
});
