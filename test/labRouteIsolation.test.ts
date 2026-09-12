import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('idle routes 01–14 mount no canvas and keep bench 04 controls isolated', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabShell } = await server.ssrLoadModule('/src/components/LabShell.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const actions = { switchModule() {}, setMode() {}, setScenario() {}, runBenchmark() {}, runPain() {}, openReport() {}, closeReport() {}, copyReport() {}, refreshReport() {}, openFinder() {} };
    const { MODULE_NAV } = await server.ssrLoadModule('/src/lab/catalog.ts');
    for (const { id: moduleId } of MODULE_NAV.filter(({ id }: { id: string }) => id !== '00-baseline' && id !== '15-virtualized-integration')) {
      const html = renderToStaticMarkup(createElement(LabContext.Provider, { value: { state: initialSnapshot(moduleId), actions } }, createElement(LabShell, { webglRef: { current: null }, webgpuRef: { current: null }, chartRef: { current: null } })));
      assert.equal((html.match(/<canvas/g) ?? []).length, 0, `${moduleId}: canvas at rest`);
      if (moduleId !== '04-gpu-lod') {
        for (const foreign of ['Même rendu natif', 'sélection LOD', 'A · Calcul CPU', 'B · Calcul GPU', 'Comparaison native']) assert.doesNotMatch(html, new RegExp(foreign, 'i'), `${moduleId}: leaked ${foreign}`);
      }
      if (!['01-indirect-draw', '03-gpu-scene', '04-gpu-lod', '14-open-world'].includes(moduleId)) {
        assert.doesNotMatch(html, /Commutez instantanément entre les pipelines/i, `${moduleId}: false switching help`);
        assert.doesNotMatch(html, /id="btn-(?:classic|gpu-driven)"/, `${moduleId}: decorative A\/B controls`);
      }
    }
  } finally { await server.close(); }
});

test('each live statistic is one accessible group with its own title, value and description', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabStats } = await server.ssrLoadModule('/src/components/LabStats.tsx');
    const html = renderToStaticMarkup(createElement(LabStats, { stats: { submit: '1 ms', cpuFrame: '2 ms', fps: '60 FPS', drawCalls: '3' } }));
    for (const id of ['stat-submit', 'stat-cpuframe', 'stat-fps', 'stat-drawcalls']) {
      assert.match(html, new RegExp(`<div[^>]+role="group"[^>]+aria-labelledby="${id}-title"[^>]+aria-describedby="${id}-description"`), id);
      assert.match(html, new RegExp(`id="${id}-title"`), id);
      assert.match(html, new RegExp(`id="${id}-description"`), id);
    }
  } finally { await server.close(); }
});
