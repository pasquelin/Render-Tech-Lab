import test from 'node:test';
import assert from 'node:assert/strict';
import { formatModelDiagnosticReport } from '../src/lab/modelReportMarkdown.ts';
import { pathVersion, type ModelReport } from '../src/lab/modelCampaign.ts';

const report: ModelReport = {
  version: 1,
  id: 'run-15',
  timestamp: '2026-09-13T09:00:00.000Z',
  status: 'completed',
  configuration: { cities: 1, detail: 'source', lodQuality: 'high', mode: 'path', camera: 'orbit', diagnostic: 'beauty', layout: 'single', engine: 'exact-cluster-pages', compareEngine: 'three-webgl-reference', wipe: 0.5 },
  pathEngines: ['three-webgl-reference', 'exact-cluster-pages'],
  sourceKey: 'model-v1',
  availableTriangles: 1000,
  sharedGeometry: true,
  multipliedInstances: 1,
  resolution: [1280, 720],
  firstImageMs: 32,
  preparationMs: 120,
  warmupFrames: 30,
  samples: [],
  captures: [
    { segment: 0, name: 'Vue générale du modèle', image: 'data:image/jpeg;base64,xx', takenAt: '2026-09-13T09:00:01.000Z', elapsedMs: 100, pose: { position: [1, 2, 3], target: [4, 5, 6], fov: 55, near: 0.1, far: 1000 }, resolution: [1280, 720], engine: 'three-webgl-reference', backend: 'three-webgl-reference', diagnostic: 'beauty', lodQuality: 'high', cities: 1, detail: 'source', sourceKey: 'model-v1', pathVersion, fov: 55, near: 0.1, far: 1000, cpuFrameMs: 5, cpuSubmitMs: null, rafIntervalMs: 16, drawCalls: 40, triangles: 1000, selectedTriangles: 900, clusters: 10, residentPages: 4, cacheEvictions: 0, frustumRejected: 12, pagesRequested: 4, pageLoads: 1, gpuMs: null, vramBytes: null },
    { segment: 0, name: 'Vue générale du modèle', image: 'data:image/jpeg;base64,yy', takenAt: '2026-09-13T09:00:02.000Z', elapsedMs: 200, pose: { position: [1, 2, 3], target: [4, 5, 6], fov: 55, near: 0.1, far: 1000 }, resolution: [1280, 720], engine: 'exact-cluster-pages', backend: 'exact-cluster-pages', diagnostic: 'beauty', lodQuality: 'high', cities: 1, detail: 'source', sourceKey: 'model-v1', pathVersion, fov: 55, near: 0.1, far: 1000, cpuFrameMs: 7, cpuSubmitMs: null, rafIntervalMs: 20, drawCalls: 6, triangles: 800, selectedTriangles: 700, clusters: 8, residentPages: 5, cacheEvictions: 2, frustumRejected: 20, pagesRequested: 7, pageLoads: 3, gpuMs: null, vramBytes: null },
  ],
  engineEvents: [],
  error: null,
  fallbacks: [],
  retainedSamplesOnly: false,
  environment: 'test browser',
  pathVersion,
  comparison: 'visual-only',
  comparisonReason: 'Ancienne affirmation à ne pas reprendre.',
  aaControl: { status: 'not-run' },
};

test('Model archive explains capture-by-capture engine differences without claiming a performance verdict', () => {
  const markdown = formatModelDiagnosticReport(report);

  assert.match(markdown, /# 15-virtualized-integration — rapport de diagnostic/);
  assert.match(markdown, /## Configuration reproductible/);
  assert.match(markdown, /## Comparaison par point de parcours/);
  assert.match(markdown, /Vue générale du modèle/);
  assert.match(markdown, /THREE\.js basic/);
  assert.match(markdown, /WebGeometry/);
  assert.match(markdown, /CPU frame \(ms\).*5\.00.*7\.00/s);
  assert.match(markdown, /Draw calls.*40.*6/s);
  assert.match(markdown, /Pages résidentes.*4.*5/s);
  assert.match(markdown, /Position X\/Y\/Z : 1 \/ 2 \/ 3/);
  assert.match(markdown, /Cible X\/Y\/Z : 4 \/ 5 \/ 6/);
  assert.match(markdown, /FOV 55° ; plans 0\.1 \/ 1000/);
  assert.match(markdown, /GPU et VRAM : non mesurés/);
  assert.match(markdown, /A\/A non vérifié pour cette campagne/);
  assert.doesNotMatch(markdown, /Ancienne affirmation à ne pas reprendre/);
  assert.match(markdown, /Pas un verdict de performance/);
  assert.match(markdown, /0 images mesurées, 2 captures, 0 événements moteur/);
  assert.doesNotMatch(markdown, /bloc machine du présent Markdown/);
});

test('Model archive renders the explicit A/A outcome and still blocks the performance verdict', () => {
  for (const [status, expected] of [
    ['passed', 'Contrôle A/A réussi pour cette campagne'],
    ['failed', 'Contrôle A/A échoué pour cette campagne'],
    ['not-run', 'A/A non vérifié pour cette campagne'],
  ] as const) {
    const markdown = formatModelDiagnosticReport({ ...report, aaControl: { status } });
    assert.match(markdown, new RegExp(expected));
    assert.match(markdown, /verdict de performance reste bloqué/);
  }
});

test('debug reports state instrumentation cost and retain CPU submit measurements',()=>{
 const sample={...report.samples[0],cpuSubmitMs:3,backend:'webgpu-page-raster'};
 const output=formatModelDiagnosticReport({...report,configuration:{...report.configuration,debug:true},samples:[sample],captures:[{...report.captures[0],cpuSubmitMs:3}]});
 assert.match(output,/Debug : actif/);
 assert.match(output,/instrumentation/);
 assert.match(output,/CPU submit : 1 \/ 1/);
 assert.match(output,/CPU submit \(ms\).*3\.00/);
 assert.doesNotMatch(output,/CPU submit, GPU et VRAM : non mesurés/);
});
