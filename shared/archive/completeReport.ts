import { createHash } from 'node:crypto';

export const COMPLETE_REPORT_SCHEMA = 'report-complete/v1';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * JSON.stringify silently drops undefined and changes non-finite numbers. A report
 * is evidence, so encode those runtime values explicitly instead of losing them.
 */
export function losslessValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
  if (typeof value === 'undefined') return { $undefined: true };
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value === 'symbol') return { $symbol: String(value) };
  if (typeof value === 'function') return { $function: String(value) };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof Error) return { $error: { name: value.name, message: value.message, stack: value.stack ?? null } };
  if (ArrayBuffer.isView(value)) return { $typedArray: value.constructor.name, base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  if (value instanceof ArrayBuffer) return { $arrayBuffer: Buffer.from(value).toString('base64') };
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return { $circular: true };
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => losslessValue(item, seen));
  const object: Record<string, JsonValue> = {};
  for (const key of Reflect.ownKeys(value)) {
    const name = typeof key === 'string' ? key : `[${String(key)}]`;
    object[name] = losslessValue((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return object;
}

export interface CompleteReportInput {
  testId: string;
  humanMarkdown: string;
  result?: unknown;
  archivedAt?: string;
}

export interface CompleteReport {
  schema: typeof COMPLETE_REPORT_SCHEMA;
  testId: string;
  archivedAt: string;
  humanMarkdown: string;
  result: JsonValue;
  media: Array<{ path: string; mime: string; bytes: number; sha256: string; base64: string }>;
}

function embeddedMedia(value: JsonValue, path = '$'): CompleteReport['media'] {
  const found: CompleteReport['media'] = [];
  const visit = (entry: JsonValue, current: string) => {
    if (typeof entry === 'string') {
      const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(entry);
      if (match) {
        const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
        found.push({ path: current, mime: match[1], bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') });
      }
      return;
    }
    if (Array.isArray(entry)) entry.forEach((item, index) => visit(item, `${current}[${index}]`));
    else if (entry && typeof entry === 'object') Object.entries(entry).forEach(([key, item]) => visit(item, `${current}.${key}`));
  };
  visit(value, path);
  return found;
}

export function completeReport(input: CompleteReportInput): CompleteReport {
  const result = losslessValue(input.result ?? null);
  return { schema: COMPLETE_REPORT_SCHEMA, testId: input.testId, archivedAt: input.archivedAt ?? new Date().toISOString(), humanMarkdown: input.humanMarkdown, result, media: embeddedMedia(result) };
}

/** Read-only decoder for historical report-complete/v1 Markdown during migration. */
export function parseCompleteReport(markdown: string): CompleteReport | null {
  const marker = `\`\`\`json ${COMPLETE_REPORT_SCHEMA}\n`;
  const start = markdown.lastIndexOf(marker);
  if (start < 0) return null;
  const end = markdown.indexOf('\n```', start + marker.length);
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(markdown.slice(start + marker.length, end)) as CompleteReport;
    return parsed.schema === COMPLETE_REPORT_SCHEMA ? parsed : null;
  } catch { return null; }
}
