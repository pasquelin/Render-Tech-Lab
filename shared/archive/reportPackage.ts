import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createGzip } from 'node:zlib';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { losslessValue, type JsonValue } from './completeReport.ts';

export const REPORT_PACKAGE_SCHEMA = 'report-package/v1';

export type EngineEvent = {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  phase: string;
  message: string;
  context: Record<string, JsonValue>;
};

export type ReportPackageInput = {
  testId: string;
  humanMarkdown: string;
  result?: unknown;
  engineEvents?: EngineEvent[];
  archivedAt?: string;
  id?: string;
};

type MediaAsset = { origin: string; path: string; mime: string; bytes: number; sha256: string; buffer: Buffer };
type MediaReference = { $media: { path: string; mime: string; bytes: number; sha256: string } };

export type ReportPackage = {
  directory: string;
  markdownPath: string;
  manifestPath: string;
  resultPath: string;
  engineLogPath: string;
  mediaDirectory: string;
};

function validateTestId(testId: string) {
  if (!/^\d\d-[a-z0-9-]+$/.test(testId)) throw new Error('Identifiant de banc invalide');
  return testId;
}

function validatePackageId(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error('Identifiant de rapport invalide');
  return id;
}

function mediaExtension(mime: string) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[mime] ?? 'bin';
}

function mediaAlt(origin: string) {
  const last = origin.split('.').at(-1) ?? 'média';
  return last.replace(/[^a-z0-9_-]/gi, '') || 'média';
}

function externalizeMedia(value: JsonValue, origin = '$', found = new Map<string, MediaAsset>()): { value: JsonValue | MediaReference; media: MediaAsset[] } {
  if (typeof value === 'string') {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
    if (!match) return { value, media: [...found.values()] };
    const mime = match[1];
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const asset = found.get(sha256) ?? { origin, path: `media/${sha256}.${mediaExtension(mime)}`, mime, bytes: buffer.byteLength, sha256, buffer };
    found.set(sha256, asset);
    return { value: { $media: { path: asset.path, mime, bytes: asset.bytes, sha256 } }, media: [...found.values()] };
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry, index) => externalizeMedia(entry, `${origin}[${index}]`, found).value);
    return { value: entries, media: [...found.values()] };
  }
  if (value && typeof value === 'object') {
    const entries: Record<string, JsonValue | MediaReference> = {};
    for (const [key, entry] of Object.entries(value)) entries[key] = externalizeMedia(entry, `${origin}.${key}`, found).value;
    return { value: entries, media: [...found.values()] };
  }
  return { value, media: [...found.values()] };
}

export function packageMarkdown(humanMarkdown: string, media: MediaAsset[], events: EngineEvent[], packagePath = '') {
  const sections = [packagePath ? `<!-- report-package:${packagePath} -->` : '', humanMarkdown.trim(), '', '## Dossier de preuve', '', '### Objets machine compressés', '', '- [Manifeste des objets](./objects/manifest.json)', '- [Données brutes compressées](./objects/result.json.gz)', '- [Logs moteur exhaustifs](./logs/engine-events.jsonl)'];
  sections.push('', '## Logs moteur', '');
  if (!events.length) sections.push('Aucun événement moteur n’a été enregistré.');
  else {
    sections.push('| Horodatage | Niveau | Phase | Événement |', '|---|---|---|---|');
    for (const event of events.slice(-50)) sections.push(`| ${event.timestamp} | ${event.level} | ${event.phase.replaceAll('|', '\\|')} | ${event.message.replaceAll('|', '\\|')} |`);
    if (events.length > 50) sections.push('', `Les ${events.length - 50} événements précédents restent dans le journal exhaustif.`);
  }
  sections.push('', '## Comparaisons visuelles', '');
  if (!media.length) sections.push('Aucune capture visuelle n’a été archivée.');
  else for (const asset of media.filter(item => item.mime.startsWith('image/'))) sections.push(`![${mediaAlt(asset.origin)}](./${asset.path})`, '', `Capture : \`${asset.origin}\` · ${asset.bytes} octets · SHA-256 \`${asset.sha256}\`.`, '');
  return `${sections.join('\n')}\n`;
}

export async function writeStreamedReportPackage(root: string, input: Omit<ReportPackageInput, 'result'>, result: Readable): Promise<ReportPackage> {
  const testId = validateTestId(input.testId);
  if (!input.humanMarkdown.trim()) throw new Error('Rapport vide');
  const id = validatePackageId(input.id ?? `campaign-${randomUUID()}`);
  const directory = path.join(root, 'reports', testId, id);
  const objects = path.join(directory, 'objects');
  const logs = path.join(directory, 'logs');
  const mediaDirectory = path.join(directory, 'media');
  await mkdir(objects, { recursive: true });
  await Promise.all([mkdir(logs), mkdir(mediaDirectory)]);
  const archivedAt = input.archivedAt ?? new Date().toISOString();
  const events = input.engineEvents ?? [];
  const resultPath = path.join(objects, 'result.json.gz');
  const engineLogPath = path.join(logs, 'engine-events.jsonl');
  const manifestPath = path.join(objects, 'manifest.json');
  const markdownPath = path.join(directory, 'REPORT.md');
  const hash = createHash('sha256');
  await pipeline(result, new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); } }), createGzip(), createWriteStream(resultPath, { flags: 'wx' }));
  await writeFile(engineLogPath, events.map(event => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''), { flag: 'wx' });
  await writeFile(manifestPath, `${JSON.stringify({ schema: REPORT_PACKAGE_SCHEMA, testId, id, archivedAt, objects: [{ path: 'objects/result.json.gz', mime: 'application/gzip', encoding: 'gzip', sha256: hash.digest('hex') }, { path: 'logs/engine-events.jsonl', mime: 'application/x-ndjson', entries: events.length }], media: [] }, null, 2)}\n`, { flag: 'wx' });
  await writeFile(markdownPath, packageMarkdown(input.humanMarkdown, [], events, `${testId}/${id}`), { flag: 'wx' });
  return { directory, markdownPath, manifestPath, resultPath, engineLogPath, mediaDirectory };
}

export async function writeReportPackage(root: string, input: ReportPackageInput): Promise<ReportPackage> {
  const testId = validateTestId(input.testId);
  if (!input.humanMarkdown.trim()) throw new Error('Rapport vide');
  const id = validatePackageId(input.id ?? `campaign-${randomUUID()}`);
  const directory = path.join(root, 'reports', testId, id);
  const objects = path.join(directory, 'objects');
  const logs = path.join(directory, 'logs');
  const mediaDirectory = path.join(directory, 'media');
  await mkdir(objects, { recursive: true });
  await Promise.all([mkdir(logs), mkdir(mediaDirectory)]);
  const archivedAt = input.archivedAt ?? new Date().toISOString();
  const events = input.engineEvents ?? [];
  const externalized = externalizeMedia(losslessValue(input.result ?? null));
  const resultPath = path.join(objects, 'result.json.gz');
  const engineLogPath = path.join(logs, 'engine-events.jsonl');
  const manifestPath = path.join(objects, 'manifest.json');
  const markdownPath = path.join(directory, 'REPORT.md');
  await Promise.all(externalized.media.map(asset => writeFile(path.join(directory, asset.path), asset.buffer, { flag: 'wx' })));
  await writeFile(resultPath, gzipSync(JSON.stringify(externalized.value)), { flag: 'wx' });
  await writeFile(engineLogPath, events.map(event => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''), { flag: 'wx' });
  const manifest = {
    schema: REPORT_PACKAGE_SCHEMA,
    testId,
    id,
    archivedAt,
    objects: [
      { path: 'objects/result.json.gz', mime: 'application/gzip', encoding: 'gzip', sha256: createHash('sha256').update(await readFile(resultPath)).digest('hex') },
      { path: 'logs/engine-events.jsonl', mime: 'application/x-ndjson', entries: events.length },
    ],
    media: externalized.media.map(({ path: mediaPath, mime, bytes, sha256, origin }) => ({ path: mediaPath, mime, bytes, sha256, origin })),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await writeFile(markdownPath, packageMarkdown(input.humanMarkdown, externalized.media, events, `${testId}/${id}`), { flag: 'wx' });
  return { directory, markdownPath, manifestPath, resultPath, engineLogPath, mediaDirectory };
}
