import type { Plugin } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, writeReportPackage } from '../../shared/archive/index.ts';
import type { LightingDelayArchiveEntry, LightingDelayArchiveHistory, LightingDelayReport } from '../contracts.ts';
import { formatLightingDelayReport } from '../implementation/delayReport.ts';

const testId = '16-lighting-transport';
const packagePattern = /^campaign-[a-zA-Z0-9-]+$/;
const filePattern = /^[a-z0-9-]+\.(webm|png)$/;
const RETAINED_ATTEMPTS = 5;
const emptyHistory = (): LightingDelayArchiveHistory => ({ formatVersion: 1, latestAttempt: null, attempts: [] });
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function validateReport(value: unknown): LightingDelayReport {
  const report = value as LightingDelayReport | undefined;
  if (
    !report || report.formatVersion !== 1 || typeof report.id !== 'string' || !report.id ||
    typeof report.timestamp !== 'string' || !Number.isFinite(Date.parse(report.timestamp)) ||
    !['measured', 'stopped', 'error'].includes(report.status) ||
    !report.protocol || !report.delayProtocol || !Array.isArray(report.sequences) || !Array.isArray(report.contactSheets) || !Array.isArray(report.limitations)
  ) throw new Error('Rapport de retard lumineux invalide');
  for (const sequence of report.sequences) {
    if (typeof sequence.delayMs !== 'number' || typeof sequence.frameCount !== 'number') throw new Error('Séquence de retard invalide');
  }
  return report;
}

function historyPath(root: string) {
  return join(root, 'reports', testId, 'delay-history.json');
}

async function readHistory(root: string): Promise<LightingDelayArchiveHistory> {
  try { return JSON.parse(await readFile(historyPath(root), 'utf8')) as LightingDelayArchiveHistory; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyHistory(); throw error; }
}

/** Deletes only package directories this store itself listed; a delay campaign never touches another scenario's archive. */
async function applyRetention(root: string, previous: LightingDelayArchiveHistory, recent: LightingDelayArchiveEntry[]) {
  const retained = new Set(recent.map(item => item.package));
  for (const old of previous.attempts) {
    if (!retained.has(old.package) && packagePattern.test(old.package)) {
      await rm(join(root, 'reports', testId, old.package), { recursive: true, force: true });
    }
  }
}

async function saveReport(root: string, packageId: string, report: LightingDelayReport) {
  if (!packagePattern.test(packageId)) throw new Error('Identifiant de campagne invalide');
  const validated = validateReport(report);
  const previous = await readHistory(root);
  await writeReportPackage(root, { testId, id: packageId, humanMarkdown: formatLightingDelayReport(validated), result: validated, archivedAt: validated.timestamp });
  const entry: LightingDelayArchiveEntry = { package: packageId, id: validated.id, timestamp: validated.timestamp, status: validated.status };
  const recent = [entry, ...previous.attempts.filter(item => item.package !== packageId)].slice(0, RETAINED_ATTEMPTS);
  await applyRetention(root, previous, recent);
  const next: LightingDelayArchiveHistory = { formatVersion: 1, latestAttempt: packageId, attempts: recent };
  await atomicWrite(historyPath(root), json(next));
  return next;
}

async function readReportMarkdown(root: string, packageId: string, history: LightingDelayArchiveHistory) {
  if (!packagePattern.test(packageId) || history.attempts.every(entry => entry.package !== packageId)) throw new Error('Rapport de retard lumineux absent');
  return readFile(join(root, 'reports', testId, packageId, 'REPORT.md'), 'utf8');
}

export function createLightingDelayArchivePlugin(): Plugin {
  return {
    name: 'lighting-delay-archives',
    configureServer(server) {
      const root = server.config.root;
      server.middlewares.use('/api/lighting-delay-media', (req, res) => {
        void (async () => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('POST requis'); return; }
          const url = new URL(req.url ?? '', 'http://localhost');
          const packageId = url.searchParams.get('package') ?? '';
          const file = url.searchParams.get('file') ?? '';
          if (!packagePattern.test(packageId) || !filePattern.test(file)) throw new Error('Nom de capture invalide');
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += (chunk as Buffer).byteLength;
            if (bytes > 64 * 1024 * 1024) throw new Error('Capture trop volumineuse');
            chunks.push(chunk as Buffer);
          }
          const directory = join(root, 'reports', testId, packageId, 'captures');
          await mkdir(directory, { recursive: true });
          await writeFile(join(directory, file), Buffer.concat(chunks));
          res.setHeader('Content-Type', 'application/json');
          res.end(json({ bytes }));
        })().catch(error => { res.statusCode = 400; res.end(error instanceof Error ? error.message : String(error)); });
      });
      server.middlewares.use('/api/lighting-delay-report', (req, res) => {
        void (async () => {
          res.setHeader('Cache-Control', 'no-store');
          if (req.method === 'GET') {
            const url = new URL(req.url ?? '', 'http://localhost');
            const packageId = url.searchParams.get('package');
            if ([...url.searchParams.keys()].some(key => key !== 'package')) { res.statusCode = 400; res.end('Paramètre de rapport inconnu'); return; }
            const history = await readHistory(root);
            res.setHeader('Content-Type', packageId ? 'text/markdown; charset=utf-8' : 'application/json');
            res.end(packageId ? await readReportMarkdown(root, packageId, history) : json(history));
            return;
          }
          if (req.method !== 'POST') { res.statusCode = 405; res.end('GET ou POST requis'); return; }
          req.setEncoding('utf8');
          let body = '', bytes = 0;
          for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if (bytes > 8 * 1024 * 1024) throw new Error('Rapport trop volumineux'); body += chunk; }
          const parsed = JSON.parse(body) as { packageId?: unknown; report?: unknown };
          if (typeof parsed.packageId !== 'string') throw new Error('Identifiant de campagne manquant');
          const history = await saveReport(root, parsed.packageId, parsed.report as LightingDelayReport);
          res.setHeader('Content-Type', 'application/json');
          res.end(json(history));
        })().catch(error => { res.statusCode = req.method === 'GET' ? 404 : 400; res.end(error instanceof Error ? error.message : String(error)); });
      });
    },
  };
}
