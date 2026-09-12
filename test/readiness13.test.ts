import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('13 runs a visible readiness checklist and reports the real blocker', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const raf = globalThis.requestAnimationFrame;
  try {
    globalThis.requestAnimationFrame = callback => { queueMicrotask(() => callback(performance.now())); return 1; };
    const { LabSession } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    const session = new LabSession({}); session.presentationDurationMs = 0;
    session.patch({ moduleId: '13-full-gpu-driven' });
    await session.runBenchmark();
    assert.equal(session.state.execution.status, 'error');
    assert.equal(session.state.running, false);
    assert.equal(session.state.framePresented, true);
    assert.equal(session.state.progress.completed, 5);
    assert.equal(session.state.progress.total, 5);
    assert.match(session.state.execution.phase, /aucun orchestrateur physique 13/);
    assert.equal(session.state.execution.lastCampaign, null);
  } finally { globalThis.requestAnimationFrame = raf; await server.close(); }
});
