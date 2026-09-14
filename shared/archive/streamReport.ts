import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { atomicWrite } from './atomic.ts';
import { directoryRetention } from './retention.ts';
import { validateTestId } from './reportStore.ts';
import { writeStreamedReportPackage } from './reportPackage.ts';

export interface StreamedReportHeader {
  testId: string;
  humanMarkdown: string;
  archivedAt?: string;
  /** Nom du dossier d'archive. Un nom sans le préfixe « campaign- » échappe à la rétention. */
  id?: string;
  /** Rapport de campagne, écrit tel quel à côté du paquet pour être relu sans décompression. */
  truth?: unknown;
}

/** Streams a lossless raw object into the same package layout used by every bank. */
export async function writeStreamedReportArchive(root: string, header: StreamedReportHeader, result: Readable) {
  const testId = validateTestId(header.testId);
  const archivedAt = header.archivedAt ?? new Date().toISOString();
  const packageReport = await writeStreamedReportPackage(root, { testId, humanMarkdown: header.humanMarkdown, archivedAt, id: header.id }, result);
  const truthPath = path.join(packageReport.directory, 'truth-report.json');
  if (header.truth) await writeFile(truthPath, `${JSON.stringify(header.truth, null, 1)}\n`, { flag: 'wx' });
  const indexPath = path.join(root, 'reports', testId, 'latest.json');
  await atomicWrite(indexPath, `${JSON.stringify({ archivedAt, reportPackage: path.basename(packageReport.directory) }, null, 2)}\n`);
  await directoryRetention(path.join(root, 'reports', testId), 'campaign-', true);
  return { reportPath: packageReport.markdownPath, indexPath, truthPath: header.truth ? truthPath : null, package: packageReport };
}
