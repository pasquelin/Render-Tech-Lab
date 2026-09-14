import { formatModelDiagnosticReport } from './modelReportMarkdown.ts';
import type { ModelReport } from './modelCampaign.ts';

export const MODEL_REPORT_TEST_ID = '15-virtualized-integration';
export const STREAMED_REPORT_CONTENT_TYPE = 'application/x-rtl-streamed-report';
const CHUNK_BYTES = 64 * 1024;
const YIELD_AFTER_BYTES = 4 * 1024 * 1024;

type FetchLike = typeof fetch;

class JsonChunkWriter {
  readonly parts: Uint8Array[] = [];
  private readonly encoder = new TextEncoder();
  private current = new Uint8Array(CHUNK_BYTES);
  private offset = 0;
  private bytesSinceYield = 0;

  write(value: string) {
    const bytes = this.encoder.encode(value);
    let sourceOffset = 0;
    while (sourceOffset < bytes.byteLength) {
      const count = Math.min(CHUNK_BYTES - this.offset, bytes.byteLength - sourceOffset);
      this.current.set(bytes.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.offset += count;
      sourceOffset += count;
      this.bytesSinceYield += count;
      if (this.offset === CHUNK_BYTES) {
        this.parts.push(this.current);
        this.current = new Uint8Array(CHUNK_BYTES);
        this.offset = 0;
      }
    }
  }

  async yieldIfNeeded() {
    if (this.bytesSinceYield < YIELD_AFTER_BYTES) return;
    this.bytesSinceYield = 0;
    await yieldToBrowser();
  }

  finish() {
    if (this.offset) this.parts.push(this.current.slice(0, this.offset));
  }
}

function yieldToBrowser() {
  if (typeof setTimeout === 'function') return new Promise<void>(resolve => setTimeout(resolve, 0));
  return Promise.resolve();
}

function isToJsonValue(value: unknown): value is { toJSON: () => unknown } {
  return !!value && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

async function encodeJson(value: unknown, writer: JsonChunkWriter, inArray = false): Promise<void> {
  if (value === null) {
    writer.write('null');
  } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    writer.write(JSON.stringify(value));
  } else if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    if (inArray) writer.write('null');
    return;
  } else if (isToJsonValue(value)) {
    await encodeJson(value.toJSON(), writer, inArray);
  } else if (Array.isArray(value)) {
    writer.write('[');
    for (let index = 0; index < value.length; index++) {
      if (index) writer.write(',');
      // Each top-level array element is serialized independently. This keeps
      // a large samples/captures array out of a single JSON.stringify call.
      const serialized = JSON.stringify(value[index]);
      writer.write(serialized === undefined ? 'null' : serialized);
      await writer.yieldIfNeeded();
    }
    writer.write(']');
  } else {
    const record = value as Record<string, unknown>;
    writer.write('{');
    let first = true;
    for (const key of Object.keys(record)) {
      if (typeof record[key] === 'undefined' || typeof record[key] === 'function' || typeof record[key] === 'symbol') continue;
      if (!first) writer.write(',');
      first = false;
      writer.write(JSON.stringify(key));
      writer.write(':');
      await encodeJson(record[key], writer);
      await writer.yieldIfNeeded();
    }
    writer.write('}');
  }
}

/** Builds the lossless report JSON without materializing one giant string. */
export async function modelReportBlob(report: ModelReport): Promise<Blob> {
  const writer = new JsonChunkWriter();
  await encodeJson(report, writer);
  writer.finish();
  return new Blob(writer.parts as unknown as BlobPart[], { type: 'application/json' });
}

/** Archives a model report without materializing the complete JSON string. */
const pendingArchives = new WeakMap<object, Promise<Response>>();
export async function archiveModelReport(report: ModelReport, fetcher: FetchLike = fetch): Promise<Response> {
  const previous = pendingArchives.get(report);
  if (previous) return previous;
  const pending = (async () => {
    const markdown = formatModelDiagnosticReport(report);
    const reportJson = await modelReportBlob(report);
    const header = new TextEncoder().encode(`${JSON.stringify({ testId: MODEL_REPORT_TEST_ID, markdown })}\n`);
    const body = new Blob([header as unknown as BlobPart, reportJson], { type: STREAMED_REPORT_CONTENT_TYPE });
    const response = await fetcher('/api/save-report', {
      method: 'POST',
      headers: { 'Content-Type': STREAMED_REPORT_CONTENT_TYPE },
      body,
    });
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
    return response;
  })();
  pendingArchives.set(report, pending);
  void pending.then(() => pendingArchives.delete(report), () => pendingArchives.delete(report));
  return pending;
}

/** Starts a browser download of the same lossless streamed report body. */
export async function downloadModelReport(report: ModelReport, filename = `model-${report.id}.json`): Promise<Blob> {
  const blob = await modelReportBlob(report);
  if (typeof document === 'undefined') return blob;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return blob;
}
