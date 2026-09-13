import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveModelReport, modelReportBlob, MODEL_REPORT_TEST_ID, STREAMED_REPORT_CONTENT_TYPE } from '../src/lab/modelReportTransport.ts';

function reportWith(samples: unknown[]): any {
  return {
    version: 1,
    id: 'transport-test',
    timestamp: '2026-09-13T12:00:00.000Z',
    status: 'completed',
    configuration: { cities: 1, detail: 'source', lodQuality: 'high', mode: 'path', camera: 'orbit', diagnostic: 'beauty', layout: 'single', engine: 'exact-cluster-pages', compareEngine: 'three-webgl-reference', wipe: 0.5, debug: true },
    pathEngines: ['three-webgl-reference', 'exact-cluster-pages'],
    sourceKey: 'transport-model',
    availableTriangles: 1,
    sharedGeometry: true,
    multipliedInstances: 1,
    resolution: [320, 200],
    firstImageMs: null,
    preparationMs: null,
    warmupFrames: 0,
    samples,
    captures: [],
    engineEvents: [],
    error: null,
    fallbacks: [],
    retainedSamplesOnly: false,
    environment: 'test',
    pathVersion: 1,
    comparison: 'visual-only',
    comparisonReason: 'No verdict.',
    aaControl: { status: 'not-run' },
  };
}

test('incremental body preserves escaped strings, nulls and multi-megabyte top-level arrays', async () => {
  const samples = Array.from({ length: 30000 }, (_, index) => ({ index, text: `quote " slash \\ newline\n ${index}`, nullable: index % 3 ? null : `é-${index}` }));
  const report = reportWith(samples);
  const blob = await modelReportBlob(report);
  assert.ok(blob.size > 1024 * 1024);
  const body = await blob.text();
  const decoded = JSON.parse(body);
  assert.equal(decoded.samples.length, samples.length);
  assert.deepEqual(decoded.samples[7], samples[7]);
  assert.equal(decoded.samples[1].nullable, null);
});

test('archive posts the streamed content type and returns the endpoint response', async () => {
  const report = reportWith([{ value: null }]);
  let request: RequestInit | undefined;
  const response = await archiveModelReport(report, async (_url, init) => { request = init; return new Response(JSON.stringify({ success: true }), { status: 200 }); });
  assert.equal(response.status, 200);
  assert.equal(request?.headers && new Headers(request.headers).get('Content-Type'), STREAMED_REPORT_CONTENT_TYPE);
  assert.ok(request?.body instanceof Blob);
  const archiveBody = await (request?.body as Blob).text();
  const newline = archiveBody.indexOf('\n');
  const header = JSON.parse(archiveBody.slice(0, newline));
  assert.equal(header.testId, MODEL_REPORT_TEST_ID);
  assert.match(header.markdown, /rapport de diagnostic/);
  assert.equal(JSON.parse(archiveBody.slice(newline + 1)).samples[0].value, null);
});

test('archive exposes endpoint failures to the caller', async () => {
  await assert.rejects(() => archiveModelReport(reportWith([]), async () => new Response('no', { status: 503 })), /Archive HTTP 503/);
});
