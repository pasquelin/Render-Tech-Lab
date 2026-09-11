import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function saveReportPlugin(): Plugin {
  return {
    name: 'save-report-plugin',
    configureServer(server) {
      server.middlewares.use('/api/save-report', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const testId = data.testId || '01-gpu-driven';
              const markdown = data.markdown;

              if (markdown) {
                // 1. Sauvegarde dans le dossier de résultats du test : <testId>/results/REPORT.md
                const testReportPath = path.resolve(server.config.root, testId, 'results', 'REPORT.md');
                fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
                fs.writeFileSync(testReportPath, markdown, 'utf-8');

                // 2. Sauvegarde synchronisée dans le dossier global reports/<testId>.md
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
    },
  };
}

export default defineConfig({
  plugins: [saveReportPlugin()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wgsl'],
});
