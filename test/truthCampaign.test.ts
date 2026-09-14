import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLOW_FRAME_MS, TRUTH_REPORT_SCHEMA, abbaAggregates, abbaOrder, buildTruthReport, campaignFolderName,
  campaignPackageId, canvasResolution, frameDistribution, parseCampaignOptions, refreshCeiling,
  type SdkProvenance, type TruthPass,
} from '../shared/campaign/truthReport.ts';

const sdk: SdkProvenance = { commit: 'f'.repeat(40), dirty: true, checkout: '/checkout', distPath: '/checkout/dist', contentHash: 'abc', generatedAt: '2026-09-14T00:45:13.016Z' };
const load = { at: '2026-09-14T01:00:00.000Z', load1: 1.5, load5: 2, load15: 3, thermal: 'No thermal warning level has been recorded', chromeProcesses: 1, compilerProcesses: 0, viteProcesses: 1 };

function pass(engine: string, order: 'direct' | 'reverse', intervals: number[], index = 0): TruthPass {
  return {
    engine, order, index, machineLoad: load,
    raf: frameDistribution(intervals), cpuFrameMs: frameDistribution(intervals.map(value => value / 2)), cpuSubmitMs: null,
    gpuMs: null, vramBytes: null,
    selectedTriangles: 10, triangles: 10, drawCalls: 4, residentPages: 64, shots: null, error: null,
  };
}

test('les métriques dérivées donnent le FPS médian, p50/p95/p99 et le compte d’images au-delà d’un seuil paramétrable', () => {
  assert.equal(frameDistribution([]), null);
  const values = [8, 8, 8, 8, 9, 9, 9, 20, 30, 60];
  const derived = frameDistribution(values)!;
  assert.equal(derived.frames, 10);
  assert.equal(derived.p50, 9);
  assert.equal(derived.fps, 1000 / 9);
  assert.equal(derived.p95, 60);
  assert.equal(derived.p99, 60);
  assert.equal(derived.min, 8);
  assert.equal(derived.max, 60);
  // Le seuil par défaut est 1/120 s : les quatre images à 8 ms le passent, les six autres non.
  assert.equal(derived.slowFrameThresholdMs, DEFAULT_SLOW_FRAME_MS);
  assert.equal(derived.slowFrames, 6);
  assert.equal(frameDistribution(values, 50)!.slowFrames, 1);
  assert.equal(frameDistribution([0, 0])!.fps, null);
});

test('le plafond rAF s’accroche à 60 ou 120 Hz et vaut null hors de ces plafonds', () => {
  assert.equal(refreshCeiling([8.33, 8.34, 8.35]).hz, 120);
  assert.equal(refreshCeiling([16.6, 16.7, 16.8]).hz, 60);
  const uncapped = refreshCeiling([2, 2, 2]);
  assert.equal(uncapped.hz, null);
  assert.equal(uncapped.fastestSustainedHz, 500);
  assert.deepEqual(refreshCeiling([]), { hz: null, fastestSustainedHz: null, supportedHz: [60, 120] });
});

test('la séquence ABBA joue l’ordre direct puis l’ordre inverse', () => {
  assert.deepEqual(abbaOrder(['a', 'b', 'c', 'd']).map(step => `${step.engine}:${step.order}`),
    ['a:direct', 'b:direct', 'c:direct', 'd:direct', 'd:reverse', 'c:reverse', 'b:reverse', 'a:reverse']);
});

test('l’agrégat ABBA conserve les deux passes, prend la médiane des deux sens et alerte au-delà de 5 %', () => {
  const stable = abbaAggregates([pass('c', 'direct', [10, 10, 10]), pass('c', 'reverse', [10.1, 10.1, 10.1], 1)]);
  assert.equal(stable.length, 1);
  assert.equal(stable[0].fps, (1000 / 10 + 1000 / 10.1) / 2);
  assert.equal(stable[0].directFps, 100);
  assert.ok(stable[0].deltaPct! < 5);
  assert.equal(stable[0].alert, false);
  const drifting = abbaAggregates([pass('d', 'direct', [10, 10, 10]), pass('d', 'reverse', [8, 8, 8], 1)]);
  assert.ok(drifting[0].deltaPct! > 5);
  assert.equal(drifting[0].alert, true);
  // Un seul sens : ni écart, ni alerte inventés.
  const single = abbaAggregates([pass('a', 'direct', [10, 10, 10])]);
  assert.equal(single[0].deltaPct, null);
  assert.equal(single[0].alert, false);
});

test('la résolution du canvas porte les pixels CSS et les pixels physiques', () => {
  assert.deepEqual(canvasResolution({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 2 }),
    { devicePixelRatio: 2, cssWidth: 1280, cssHeight: 720, deviceWidth: 2560, deviceHeight: 1440 });
  assert.deepEqual(canvasResolution({}),
    { devicePixelRatio: null, cssWidth: null, cssHeight: null, deviceWidth: null, deviceHeight: null });
});

test('le rapport de campagne consigne conditions, provenance SDK et charge machine, et laisse GPU et VRAM à null', () => {
  const report = buildTruthReport({
    source: 'headless', campaign: 'verite-emerald', id: 'walk-1', timestamp: '2026-09-14T01:02:03.000Z',
    scene: 'emerald-square', engines: ['c', 'd'], engineOrder: 'abba', replicaCount: 9, pixelError: 0,
    measurementMode: 'summary', resolution: canvasResolution({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 2 }),
    sdk, passes: [pass('c', 'direct', [8.33, 8.33, 8.33]), pass('c', 'reverse', [8.33, 8.33, 8.33], 1)],
  });
  assert.equal(report.schema, TRUTH_REPORT_SCHEMA);
  assert.equal(report.campaign, 'verite-emerald');
  assert.equal(report.scene, 'emerald-square');
  assert.equal(report.replicaCount, 9);
  assert.equal(report.pixelError, 0);
  assert.equal(report.measurementMode, 'summary');
  assert.equal(report.resolution.devicePixelRatio, 2);
  assert.equal(report.resolution.deviceWidth, 2560);
  assert.equal(report.sdk.commit, 'f'.repeat(40));
  assert.equal(report.sdk.dirty, true);
  assert.equal(report.sdk.contentHash, 'abc');
  assert.equal(report.refreshCeiling.hz, 120);
  assert.equal(report.passes[0].machineLoad!.load1, 1.5);
  assert.equal(report.passes[0].gpuMs, null);
  assert.equal(report.passes[0].vramBytes, null);
  assert.equal(report.aggregates.length, 1);
  assert.equal(report.environment, null);
});

test('le nom de campagne refuse le préfixe balayé par la rétention et compose un dossier unique', () => {
  assert.equal(campaignFolderName(' verite-emerald-1i-dpr1 '), 'verite-emerald-1i-dpr1');
  assert.throws(() => campaignFolderName('campaign-01e24921'), /rétention/);
  assert.throws(() => campaignFolderName(''), /vide/);
  assert.throws(() => campaignFolderName('verite/emerald'), /invalide/);
  assert.equal(campaignPackageId('verite-emerald', '01e24921-5931-4d0d-8d9a-4c1752fdd164'), 'verite-emerald-01e24921');
});

test('les options de campagne ont les défauts documentés et refusent une valeur illisible', () => {
  const defaults = parseCampaignOptions({}, { scenes: ['emerald-square'], engines: ['a', 'b'] });
  assert.equal(defaults.cssWidth, 1280);
  assert.equal(defaults.cssHeight, 720);
  assert.equal(defaults.devicePixelRatio, 1);
  assert.equal(defaults.replicaCount, 1);
  assert.equal(defaults.pixelError, 0);
  assert.equal(defaults.frames, 600);
  assert.equal(defaults.measurementMode, 'summary');
  assert.equal(defaults.campaign, 'verite');
  assert.equal(defaults.labUrl, 'http://127.0.0.1:5174');
  assert.deepEqual(defaults.scenes, ['emerald-square']);
  assert.deepEqual(defaults.engines, ['a', 'b']);
  const custom = parseCampaignOptions({ SCENES: 'emerald-square, new-york', DPR: '2', REPLICAS: '9', WIDTH: '1920', HEIGHT: '1080', CAMPAIGN: 'verite-dpr2', SLOW_FRAME_MS: '16.7' }, { scenes: ['x'], engines: ['a'] });
  assert.deepEqual(custom.scenes, ['emerald-square', 'new-york']);
  assert.equal(custom.devicePixelRatio, 2);
  assert.equal(custom.replicaCount, 9);
  assert.equal(custom.cssWidth, 1920);
  assert.equal(custom.campaign, 'verite-dpr2');
  assert.equal(custom.slowFrameThresholdMs, 16.7);
  assert.throws(() => parseCampaignOptions({ REPLICAS: '4' }, { scenes: ['x'], engines: ['a'] }), /Étendues du protocole/);
  assert.throws(() => parseCampaignOptions({ DETAIL: 'verbose' }, { scenes: ['x'], engines: ['a'] }), /DETAIL invalide/);
  assert.throws(() => parseCampaignOptions({ DPR: '0' }, { scenes: ['x'], engines: ['a'] }), /DPR invalide/);
});
