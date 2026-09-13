import path from 'node:path';
import type { Readable } from 'node:stream';
import { atomicWrite } from './atomic.ts';
import { directoryRetention } from './retention.ts';
import { validateTestId } from './reportStore.ts';
import { writeStreamedReportPackage } from './reportPackage.ts';

export interface StreamedReportHeader { testId: string; humanMarkdown: string; archivedAt?: string }

/** Streams a lossless raw object into the same package layout used by every bank. */
export async function writeStreamedReportArchive(root: string, header: StreamedReportHeader, result: Readable) {
  const testId = validateTestId(header.testId);
  const archivedAt = header.archivedAt ?? new Date().toISOString();
  const packageReport = await writeStreamedReportPackage(root, { testId, humanMarkdown: header.humanMarkdown, archivedAt }, result);
  const indexPath = path.join(root, 'reports', testId, 'latest.json');
  await atomicWrite(indexPath, `${JSON.stringify({ archivedAt, reportPackage: path.basename(packageReport.directory) }, null, 2)}\n`);
  await directoryRetention(path.join(root, 'reports', testId), 'campaign-', true);
  return { reportPath: packageReport.markdownPath, indexPath, package: packageReport };
}
