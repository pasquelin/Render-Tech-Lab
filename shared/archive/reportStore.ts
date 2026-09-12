import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { atomicWrite } from './atomic.ts';
import { directoryRetention } from './retention.ts';

export interface ReportArchiveInput { testId: string; markdown: string; latest?: Record<string, unknown> }

export function validateTestId(testId: string): string {
  if (!/^\d\d-[a-z0-9-]+$/.test(testId)) throw new Error('Identifiant de banc invalide');
  return testId;
}

export async function writeReportArchive(root: string, input: ReportArchiveInput) {
  const testId = validateTestId(input.testId);
  if (!input.markdown.trim()) throw new Error('Rapport vide');
  const results = path.join(root, testId, 'results');
  const global = path.join(root, 'reports', `${testId}.md`);
  await mkdir(results, { recursive: true });
  await atomicWrite(path.join(results, 'REPORT.md'), input.markdown);
  await atomicWrite(global, input.markdown);
  if (input.latest) {
    const campaigns = path.join(results, 'campaigns');
    const directory = path.join(campaigns, `campaign-${randomUUID()}`);
    await mkdir(directory, { recursive: true });
    const archivedAt = typeof input.latest.timestamp === 'string' ? input.latest.timestamp : new Date().toISOString();
    await writeFile(path.join(directory, 'raw.json'), `${JSON.stringify({ archivedAt, result: input.latest }, null, 2)}\n`, { flag: 'wx' });
    await writeFile(path.join(directory, 'report.md'), input.markdown, { flag: 'wx' });
    await atomicWrite(path.join(results, 'latest.json'), `${JSON.stringify(input.latest, null, 2)}\n`);
    await directoryRetention(campaigns, 'campaign-', true);
  }
  return { testReportPath: path.join(results, 'REPORT.md'), globalReportPath: global };
}

export async function readReportArchive(root: string, testId: string): Promise<string | null> {
  try { return await readFile(path.join(root, validateTestId(testId), 'results', 'REPORT.md'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
