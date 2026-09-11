import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

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
          req.on('end', () => {
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

      // 4. Exécution du benchmark d'un module sur le serveur Node
      server.middlewares.use('/api/run-bench', (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const rawId = url.searchParams.get('testId') || '02-gpu-frustum-culling';
          const testId = path.basename(rawId);
          const benchDir = path.resolve(server.config.root, testId, 'benchmark');

          if (!fs.existsSync(benchDir)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Dossier benchmark introuvable pour ${testId}` }));
            return;
          }

          const benchFiles = fs.readdirSync(benchDir).filter((f) => f.startsWith('test_') && f.endsWith('.ts'));
          if (benchFiles.length === 0) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Aucun script test_*.ts trouvé pour ${testId}` }));
            return;
          }

          const scriptPath = path.resolve(benchDir, benchFiles[0]);
          import('node:child_process').then(({ exec }) => {
            exec(`node --experimental-strip-types "${scriptPath}"`, { cwd: server.config.root }, (error, stdout, stderr) => {
              if (error) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
              }

              // Lecture du latest.json régénéré
              const jsonPath = path.resolve(server.config.root, testId, 'results', 'latest.json');
              let latestData = null;
              if (fs.existsSync(jsonPath)) {
                try {
                  latestData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                } catch {}
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, testId, output: stdout, latest: latestData }));
            });
          });
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
  plugins: [tailwindcss(), saveReportPlugin()],
  server: {
    port: 5174, // Port explicite pour éviter tout conflit avec d'autres apps
    open: false,
    watch: {
      // Les campagnes écrivent leurs rapports dans l'arborescence surveillée.
      // Sans cette exclusion, /api/save-report déclenche un rechargement complet
      // à la fin de chaque benchmark et efface les résultats tout juste mesurés.
      ignored: ['**/results/**', '**/reports/**'],
    },
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wgsl'],
});
