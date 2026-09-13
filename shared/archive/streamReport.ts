import path from 'node:path';
import type { Readable } from 'node:stream';
import { directoryRetention } from './retention.ts';
import { validateTestId } from './reportStore.ts';
import { writeStreamedReportPackage } from './reportPackage.ts';

export interface StreamedReportHeader { testId: string; humanMarkdown: string; archivedAt?: string }

/** Streams a lossless raw object into the same package layout used by every bank. */
export async function writeStreamedReportArchive(root: string, header: StreamedReportHeader, result: Readable) {
  const testId = validateTestId(header.testId);
  const packageReport = await writeStreamedReportPackage(root, { testId, humanMarkdown: header.humanMarkdown, archivedAt: header.archivedAt }, result);
  await directoryRetention(path.join(root, 'reports', testId), 'campaign-', true);
  return { reportPath: packageReport.markdownPath, package: packageReport };
}
