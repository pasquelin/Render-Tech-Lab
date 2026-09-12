import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('the React shell runs every bounded integrated bench and keeps only its current result', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSession, MIN_RESULT_PRESENTATION_MS } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    assert.equal(MIN_RESULT_PRESENTATION_MS, 2000);
    const canvas = { width: 640, height: 360, getContext: () => null };
    const session = new LabSession({ webgpu: canvas, webgl: canvas, chart: canvas });
    session.presentationDurationMs = 0;
    for (const moduleId of ['05-meshlets', '06-meshlet-culling', '07-hiz', '08-occlusion-culling', '10-material-batching', '11-geometry-streaming', '12-visibility-buffer']) {
      session.patch({ moduleId, execution: { status: 'idle', phase: '', lastCampaign: { timestamp: 'archive', status: 'archive', configuration: 'archive', series: [] } } });
      await session.runBenchmark();
      assert.equal(session.state.running, false, moduleId);
      assert.equal(session.state.execution.status, 'completed', moduleId);
      assert.notEqual(session.state.execution.lastCampaign?.timestamp, 'archive', moduleId);
      assert.ok(session.state.execution.lastCampaign?.series.some((series: { label: string }) =>
        series.label === 'Temps oracle CPU' || series.label === 'Durée CPU mesurée'), moduleId);
      assert.doesNotMatch(session.state.benchStatus, /non encore raccordé/, moduleId);
      assert.equal(session.state.stats.submit, 'non mesuré', moduleId);
      assert.match(session.state.stats.cpuFrame, / ms$/, moduleId);
      assert.equal(session.state.stats.fps, 'non mesuré', moduleId);
      assert.equal(session.state.showWebgpu, true, moduleId);
    }
    for (const moduleId of ['02-gpu-frustum-culling', '09-gpu-compaction']) {
      session.patch({ moduleId, execution: { status: 'idle', phase: '', lastCampaign: null } });
      await session.runBenchmark();
      assert.equal(session.state.execution.status, 'error', moduleId);
      assert.match(session.state.benchStatus, /WebGPU.*absent/, moduleId);
      assert.equal(session.state.execution.lastCampaign, null, moduleId);
    }
  } finally {
    await server.close();
  }
});

test('a short real result stays visible during an honest presentation phase', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSession } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    const session = new LabSession({});
    session.presentationDurationMs = 40;
    session.patch({ moduleId: '02-gpu-frustum-culling', running: true, framePresented: true,
      execution: { status: 'running', phase: 'Mesurer', lastCampaign: { timestamp: new Date().toISOString(), status: 'Terminée', configuration: 'A / B', series: [] } } });
    session.activeCampaign = { moduleId: '02-gpu-frustum-culling', token: 7 };
    session.firstPresentedAt = performance.now();
    const hold = session.holdCompletedMeasurement('02-gpu-frustum-culling', 7);
    assert.equal(session.state.execution.status, 'running');
    assert.equal(session.state.framePresented, true);
    assert.match(session.state.execution.phase, /Mesure terminée · préparation du rapport/);
    assert.ok(session.state.execution.measurementCompletedAt);
    assert.ok(session.state.execution.presentationEndsAt);
    await hold;
    assert.equal(session.state.execution.lastCampaign?.configuration, 'A / B');
  } finally {
    await server.close();
  }
});

test('a late metric from a previous campaign cannot alter the selected bench', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSession } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    const session = new LabSession({});
    session.patch({ moduleId: '03-gpu-scene', stats: { ...session.state.stats, submit: 'non mesuré', cpuFrame: 'non mesuré' } });
    session.activeCampaign = { moduleId: '03-gpu-scene', token: 2 };
    session.publishIntegratedMetric({ test: '09-gpu-compaction', variant: 'atomic', cpuMs: 8, gpuMs: 4, custom: { scope: 'webgpu-physical' } }, [], 1);
    assert.equal(session.state.stats.submit, 'non mesuré');
    assert.equal(session.state.stats.cpuFrame, 'non mesuré');
    assert.equal(session.state.framePresented, false);
  } finally {
    await server.close();
  }
});
