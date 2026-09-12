import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('09 presents real strategy progress instead of an empty canvas', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabViewport } = await server.ssrLoadModule('/src/components/LabViewport.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const state = initialSnapshot('09-gpu-compaction');
    state.running = true; state.framePresented = true; state.showWebgpu = true;
    state.execution = { status: 'running', phase: 'Mesurer atomic', lastCampaign: null };
    state.progress = { phase: 'measure', itemType: 'buffers', itemName: 'atomic', completed: 1, total: 3, message: 'Mesure WebGPU atomic', details: [{ label: 'Charge par stratégie', value: '100 000 éléments' }] };
    const html = renderToStaticMarkup(createElement(LabContext.Provider, { value: { state, actions: {} } }, createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
    assert.match(html, /data-algorithm-visualization="09-gpu-compaction"/);
    assert.match(html, /atomic/);
    assert.match(html, /100 000 éléments/);
    assert.doesNotMatch(html, /id="canvas-webgpu"[^>]*display:block/);
    state.moduleId = '13-full-gpu-driven';
    const readiness = renderToStaticMarkup(createElement(LabContext.Provider, { value: { state, actions: {} } }, createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
    assert.match(readiness, /id="scene-container" class="[^"]*flex-1/);
  } finally { await server.close(); }
});
