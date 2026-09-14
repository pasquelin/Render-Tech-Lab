import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { losslessValue, type JsonValue } from './lossless.ts';
import { readJsonObjectEntries } from './jsonObjectStream.ts';

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
type VisualGroup = { name: string; cells: Array<{ engine: string; path: string }> };
type PackageMarkdownOptions = { eventCount?: number };

export type ReportPackage = {
  directory: string;
  markdownPath: string;
  manifestPath: string;
  resultPath: string;
  engineLogPath: string;
  mediaDirectory: string;
};

/** Opens the compressed result as a decompressed stream; callers can audit it without buffering or JSON.parse-ing the whole object. */
export function createReportResultStream(resultPath: string): Readable {
  const source = createReadStream(resultPath);
  const gunzip = createGunzip();
  source.once('error', error => gunzip.destroy(error));
  gunzip.once('close', () => source.destroy());
  source.pipe(gunzip);
  return gunzip;
}

function validateTestId(testId: string) {
  if (!/^\d\d-[a-z0-9-]+$/.test(testId)) throw new Error('Identifiant de banc invalide');
  return testId;
}

function validatePackageId(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error('Identifiant de rapport invalide');
  return id;
}

function mediaExtension(mime: string) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' } as Record<string, string>)[mime] ?? 'bin';
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

function visualGroups(value: unknown): VisualGroup[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { captures?: unknown }).captures)) return [];
  const groups = new Map<string, VisualGroup>();
  for (const capture of (value as { captures: unknown[] }).captures) {
    if (!capture || typeof capture !== 'object') continue;
    const item = capture as { segment?: unknown; name?: unknown; engine?: unknown; image?: unknown };
    const media = item.image && typeof item.image === 'object' ? (item.image as { $media?: { path?: unknown } }).$media : undefined;
    if (typeof media?.path !== 'string') continue;
    const segment = typeof item.segment === 'number' ? item.segment : groups.size;
    const name = typeof item.name === 'string' && item.name ? item.name : `Prise de vue ${segment + 1}`;
    const engine = typeof item.engine === 'string' && item.engine ? item.engine : 'Moteur non renseigné';
    const group = groups.get(`${segment}:${name}`) ?? { name, cells: [] };
    group.cells.push({ engine, path: media.path });
    groups.set(`${segment}:${name}`, group);
  }
  return [...groups.values()];
}

export function packageMarkdown(humanMarkdown: string, media: MediaAsset[], events: EngineEvent[], packagePath = '', visuals: VisualGroup[] = [], options: PackageMarkdownOptions = {}) {
  const sections = [packagePath ? `<!-- report-package:${packagePath} -->` : '', humanMarkdown.trim(), '', '## Dossier de preuve', '', '### Objets machine compressés', '', '- [Manifeste des objets](./objects/manifest.json)', '- [Données brutes compressées](./objects/result.json.gz)', '- [Logs moteur exhaustifs](./logs/engine-events.jsonl)'];
  sections.push('', '## Logs moteur', '');
  if (!events.length && !(options.eventCount ?? events.length)) sections.push('Aucun événement moteur n’a été enregistré.');
  else {
    sections.push('| Horodatage | Niveau | Phase | Événement |', '|---|---|---|---|');
    for (const event of events.slice(-50)) sections.push(`| ${event.timestamp} | ${event.level} | ${event.phase.replaceAll('|', '\\|')} | ${event.message.replaceAll('|', '\\|')} |`);
    const eventCount = options.eventCount ?? events.length;
    if (eventCount > events.length) sections.push('', `Les ${eventCount - events.length} événements précédents restent dans le journal exhaustif.`);
  }
  sections.push('', '## Comparaisons visuelles', '');
  if (!media.length) sections.push('Aucune capture visuelle n’a été archivée.');
  else {
    const grouped = new Set(visuals.flatMap(group => group.cells.map(cell => cell.path)));
    for (const group of visuals) {
      const count = group.cells.length;
      sections.push(`### ${group.name} · ${count} moteur${count > 1 ? 's' : ''}`, '', `| ${group.cells.map(cell => cell.engine).join(' | ')} |`, `| ${group.cells.map(() => '---').join(' | ')} |`, `| ${group.cells.map(cell => `![${cell.engine}](./${cell.path})`).join(' | ')} |`, '');
    }
    for (const asset of media.filter(item => item.mime.startsWith('image/') && !grouped.has(item.path))) sections.push(`![${mediaAlt(asset.origin)}](./${asset.path})`, '', `Capture : \`${asset.origin}\` · ${asset.bytes} octets · SHA-256 \`${asset.sha256}\`.`, '');
  }
  return `${sections.join('\n')}\n`;
}

type StreamEntry = { key: string; index?: number; value: unknown };
type StreamDerived = { events: EngineEvent[]; eventCount: number; media: MediaAsset[]; visuals: VisualGroup[]; hasEngineEvents: boolean };

function imageAsset(value: unknown, origin: string): MediaAsset | null {
  if (typeof value !== 'string') return null;
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return { origin, path: `media/${sha256}.${mediaExtension(mime)}`, mime, bytes: buffer.byteLength, sha256, buffer };
}

async function writeLine(stream: NodeJS.WritableStream, line: string) {
  if (!stream.write(line)) await once(stream, 'drain');
}

async function extractStreamDerived(resultPath: string, mediaDirectory: string, engineLogPath: string, fallbackEvents: EngineEvent[] | undefined): Promise<StreamDerived> {
  const events: EngineEvent[] = [];
  const mediaByHash = new Map<string, MediaAsset>();
  const visualsByGroup = new Map<string, VisualGroup>();
  let eventCount = 0;
  let hasEngineEvents = false;
  const log = createWriteStream(engineLogPath, { flags: 'wx' });
  const logFinished = new Promise<void>((resolve, reject) => { log.once('finish', resolve); log.once('error', reject); });
  void logFinished.catch(() => undefined);
  try {
    for await (const raw of readJsonObjectEntries(createReportResultStream(resultPath)) as AsyncIterable<StreamEntry>) {
      if (raw.key === 'engineEvents') {
        hasEngineEvents = true;
        if (typeof raw.index !== 'number' || raw.index < 0) continue;
        if (!raw.value || typeof raw.value !== 'object' || Array.isArray(raw.value)) throw new Error(`Invalid engine event at index ${raw.index}`);
        const event = raw.value as EngineEvent;
        const serialized = JSON.stringify(event);
        if (serialized === undefined) continue;
        eventCount++;
        if (events.length === 50) events.shift();
        events.push(event);
        await writeLine(log, `${serialized}\n`);
        continue;
      }
      if (raw.key !== 'captures' || typeof raw.index !== 'number' || raw.index < 0 || !raw.value || typeof raw.value !== 'object') continue;
      const capture = raw.value as { image?: unknown; engine?: unknown; segment?: unknown; name?: unknown };
      const asset = imageAsset(capture.image, `$.captures[${raw.index}].image`);
      if (!asset) continue;
      if (!mediaByHash.has(asset.sha256)) {
        mediaByHash.set(asset.sha256, { ...asset, buffer: Buffer.alloc(0) });
        await writeFile(path.join(mediaDirectory, path.basename(asset.path)), asset.buffer, { flag: 'wx' });
      }
      const segment = typeof capture.segment === 'number' ? capture.segment : visualsByGroup.size;
      const name = typeof capture.name === 'string' && capture.name ? capture.name : `Prise de vue ${segment + 1}`;
      const engine = typeof capture.engine === 'string' && capture.engine ? capture.engine : 'Moteur non renseigné';
      const key = `${segment}:${name}`;
      const group = visualsByGroup.get(key) ?? { name, cells: [] };
      group.cells.push({ engine, path: asset.path });
      visualsByGroup.set(key, group);
    }
    if (!hasEngineEvents && fallbackEvents?.length) {
      for (const event of fallbackEvents) {
        const serialized = JSON.stringify(event);
        if (serialized === undefined) continue;
        eventCount++;
        if (events.length === 50) events.shift();
        events.push(event);
        await writeLine(log, `${serialized}\n`);
      }
    }
    log.end();
    await logFinished;
    return { events, eventCount, media: [...mediaByHash.values()], visuals: [...visualsByGroup.values()], hasEngineEvents };
  } catch (error) {
    log.destroy();
    throw error;
  }
}

async function writeStreamDerived(directory: string, resultPath: string, input: Omit<ReportPackageInput, 'result'>, id: string, archivedAt: string, resultHash: string) {
  const objects = path.join(directory, 'objects');
  const logs = path.join(directory, 'logs');
  const mediaDirectory = path.join(directory, 'media');
  await mkdir(objects, { recursive: true });
  await Promise.all([mkdir(logs, { recursive: true }), mkdir(mediaDirectory, { recursive: true })]);
  const derived = await extractStreamDerived(resultPath, mediaDirectory, path.join(logs, 'engine-events.jsonl'), input.engineEvents);
  const manifest = {
    schema: REPORT_PACKAGE_SCHEMA,
    testId: input.testId,
    id,
    archivedAt,
    objects: [
      { path: 'objects/result.json.gz', mime: 'application/gzip', encoding: 'gzip', sha256: resultHash },
      { path: 'logs/engine-events.jsonl', mime: 'application/x-ndjson', entries: derived.eventCount },
    ],
    media: derived.media.map(({ path: mediaPath, mime, bytes, sha256, origin }) => ({ path: mediaPath, mime, bytes, sha256, origin })),
  };
  await writeFile(path.join(objects, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await writeFile(path.join(directory, 'REPORT.md'), packageMarkdown(input.humanMarkdown, derived.media, derived.events, `${input.testId}/${id}`, derived.visuals, { eventCount: derived.eventCount }), { flag: 'wx' });
  return { logs, mediaDirectory, manifestPath: path.join(objects, 'manifest.json'), markdownPath: path.join(directory, 'REPORT.md'), engineLogPath: path.join(logs, 'engine-events.jsonl'), media: derived.media };
}

export async function writeStreamedReportPackage(root: string, input: Omit<ReportPackageInput, 'result'>, result: Readable): Promise<ReportPackage> {
  const testId = validateTestId(input.testId);
  if (!input.humanMarkdown.trim()) throw new Error('Rapport vide');
  const id = validatePackageId(input.id ?? `campaign-${randomUUID()}`);
  const directory = path.join(root, 'reports', testId, id);
    let directoryCreated = false;
  try {
    await mkdir(path.dirname(directory), { recursive: true });
    await mkdir(directory);
    directoryCreated = true;
    const objects = path.join(directory, 'objects');
    await mkdir(objects, { recursive: true });
    const archivedAt = input.archivedAt ?? new Date().toISOString();
    const resultPath = path.join(objects, 'result.json.gz');
    const hash = createHash('sha256');
    await pipeline(result, createGzip(), new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); } }), createWriteStream(resultPath, { flags: 'wx' }));
    // Extraction reads the just-written gzip, so the compressed object is the
    // exact input byte stream while all derived files remain bounded.
    const derived = await writeStreamDerived(directory, resultPath, input, id, archivedAt, hash.digest('hex'));
    return { directory, markdownPath: derived.markdownPath, manifestPath: derived.manifestPath, resultPath, engineLogPath: derived.engineLogPath, mediaDirectory: derived.mediaDirectory };
  } catch (error) {
    if (directoryCreated) await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function hashFile(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function humanMarkdownFromPackage(markdown: string) {
  const withoutMarker = markdown.replace(/^<!-- report-package:[^\n]*-->\s*/, '');
  const dossier = withoutMarker.indexOf('\n## Dossier de preuve');
  const human = (dossier >= 0 ? withoutMarker.slice(0, dossier) : withoutMarker).trimEnd();
  return human.replace('- Les JPEG, poses exactes et données brutes de chaque image sont intégrés au bloc machine du présent Markdown.', '- Les données brutes restent conservées dans le flux compressé ; les captures sont extraites dans la galerie ci-dessous avec leur moteur et leur segment.');
}

/** Rebuilds only derived files for an existing streamed package, preserving its gzip byte-for-byte. */
export async function repairStreamedReportPackage(directory: string): Promise<ReportPackage> {
  const manifestPath = path.join(directory, 'objects', 'manifest.json');
  const resultPath = path.join(directory, 'objects', 'result.json.gz');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { testId: string; id: string; archivedAt?: string; media?: Array<{ path?: string }> };
  const humanMarkdown = humanMarkdownFromPackage(await readFile(path.join(directory, 'REPORT.md'), 'utf8'));
  const resultHash = await hashFile(resultPath);
  const stage = path.join(directory, `.derived-${randomUUID()}`);
  await mkdir(stage, { recursive: true });
  try {
    const derived = await writeStreamDerived(stage, resultPath, { testId: manifest.testId, humanMarkdown }, manifest.id, manifest.archivedAt ?? new Date().toISOString(), resultHash);
    const liveLogs = path.join(directory, 'logs');
    const liveMedia = path.join(directory, 'media');
    await mkdir(liveLogs, { recursive: true });
    await mkdir(liveMedia, { recursive: true });
    await rename(derived.engineLogPath, path.join(liveLogs, 'engine-events.jsonl'));
    for (const asset of derived.media) await rename(path.join(derived.mediaDirectory, path.basename(asset.path)), path.join(liveMedia, path.basename(asset.path)));
    await rename(derived.manifestPath, manifestPath);
    await rename(derived.markdownPath, path.join(directory, 'REPORT.md'));
    return { directory, markdownPath: path.join(directory, 'REPORT.md'), manifestPath, resultPath, engineLogPath: path.join(liveLogs, 'engine-events.jsonl'), mediaDirectory: liveMedia };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
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
  await writeFile(markdownPath, packageMarkdown(input.humanMarkdown, externalized.media, events, `${testId}/${id}`, visualGroups(externalized.value)), { flag: 'wx' });
  return { directory, markdownPath, manifestPath, resultPath, engineLogPath, mediaDirectory };
}
