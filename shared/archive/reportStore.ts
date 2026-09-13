import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from './atomic.ts';
import { directoryRetention } from './retention.ts';
import { writeReportPackage, type EngineEvent } from './reportPackage.ts';

export interface ReportArchiveInput { testId: string; markdown: string; latest?: Record<string, unknown>; engineEvents?: EngineEvent[]; archivedAt?: string }

export function validateTestId(testId: string): string {
  if (!/^\d\d-[a-z0-9-]+$/.test(testId)) throw new Error('Identifiant de banc invalide');
  return testId;
}

export async function writeReportArchive(root: string, input: ReportArchiveInput) {
  const testId = validateTestId(input.testId);
  if (!input.markdown.trim()) throw new Error('Rapport vide');
  const archivedAt = input.archivedAt ?? (typeof input.latest?.timestamp === 'string' ? input.latest.timestamp : new Date().toISOString());
  const packageReport = await writeReportPackage(root, { testId, humanMarkdown: input.markdown, result: input.latest ?? null, engineEvents: input.engineEvents, archivedAt });
  const index = path.join(root, 'reports', testId, 'latest.json');
  await atomicWrite(index, `${JSON.stringify({ archivedAt, reportPackage: path.basename(packageReport.directory) }, null, 2)}\n`);
  await directoryRetention(path.join(root, 'reports', testId), 'campaign-', true);
  return { reportPath: packageReport.markdownPath, indexPath: index, package: packageReport };
}

export async function readReportArchive(root: string, testId: string): Promise<string | null> {
  try {
    const id = JSON.parse(await readFile(path.join(root, 'reports', validateTestId(testId), 'latest.json'), 'utf8')).reportPackage;
    return typeof id === 'string' ? await readFile(path.join(root, 'reports', testId, id, 'REPORT.md'), 'utf8') : null;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
