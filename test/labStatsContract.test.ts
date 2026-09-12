import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('shared live statistics keep the canonical metrics, order and missing-value wording', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabStats } = await server.ssrLoadModule('/src/components/LabStats.tsx');
    const html = renderToStaticMarkup(createElement(LabStats, { stats: { submit: '-- ms', cpuFrame: '4.25 ms', fps: '-- FPS', drawCalls: '12' }, provenance: 'Intervalle rAF' }));
    assert.match(html, /class="[^"]*stats[^"]*"/);
    assert.equal((html.match(/class="[^"]*stat[^"]*"/g) ?? []).filter(value => !value.includes('stats')).length >= 4, true);
    const labels = ['CPU submit', 'CPU frame', 'FPS', 'Draw calls'];
    for (let index = 1; index < labels.length; index++) assert.ok(html.indexOf(labels[index - 1]) < html.indexOf(labels[index]));
    assert.equal((html.match(/Non mesuré/g) ?? []).length, 2);
    assert.match(html, /4.25 ms/);
    assert.match(html, /12/);
    assert.match(html, /Provenance FPS : Intervalle rAF/);
  } finally { await server.close(); }
});

test('all sixteen sidebars expose the same ordered four-section contract', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSidebar } = await server.ssrLoadModule('/src/components/LabSidebar.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const { MODULE_DESCRIPTORS } = await server.ssrLoadModule('/src/lab/modules.ts');
    const actions = { switchModule() {}, setMode() {}, setScenario() {}, runBenchmark() {}, runPain() {}, openReport() {}, closeReport() {}, copyReport() {}, refreshReport() {}, openFinder() {} };
    const render = (value: Record<string, unknown>) => renderToStaticMarkup(createElement(LabContext.Provider, { value }, createElement(LabSidebar, { chartRef: { current: null } })));
    for (const moduleId of Object.keys(MODULE_DESCRIPTORS)) {
      const html = render({ state: initialSnapshot(moduleId), actions });
      const ids = ['lab-mode-card', 'lab-metrics-card', 'lab-run-card', 'lab-report-card'];
      ids.forEach(id => assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `${moduleId}: ${id}`));
      for (let index = 1; index < ids.length; index++) assert.ok(html.indexOf(ids[index - 1]) < html.indexOf(ids[index]), `${moduleId}: section order`);
      for (const label of ['CPU submit', 'CPU frame', 'FPS', 'Draw calls']) assert.match(html, new RegExp(`>${label}<`), `${moduleId}: ${label}`);
    }
    const emerald = { config:{cities:1,detail:'source',mode:'explore',camera:'orbit',diagnostic:'beauty',layout:'single'},setConfig(){},availableTriangles:1200,report:null,history:[],showReport(){},exportReport(){},availability: {status:'ready',message:'Cache disponible'}, retryAvailability() {}, status: 'ready', message: 'Ville prête', progress: null, cameraMode: 'orbit', metrics: { cpuFrameMs: 5, drawCalls: 8, triangles: 1200, pageLoads: 3 }, frameIntervalMs: 20, position: '0 · 0 · 0', setCameraMode() {}, stop() {}, restart() {} };
    const html = render({ state: initialSnapshot('15-virtualized-integration'), actions, emerald, onIntegrationScene() {} });
    assert.match(html, /id="stat-fps"[^>]*>50 FPS</);
    assert.match(html, /Provenance FPS : 1000 ÷ intervalle requestAnimationFrame \(rAF\)/);
    assert.match(html, /Métriques spécifiques/);
    assert.ok(html.indexOf('Scène du banc 15') > html.indexOf('lab-mode-card'));
    assert.ok(html.indexOf('Scène du banc 15') < html.indexOf('lab-metrics-card'));
    assert.doesNotMatch(html, /GPU \/ VRAM/);
    for (const id of ['emerald-scene', 'emerald-extent', 'emerald-detail', 'emerald-camera', 'emerald-diagnostic']) {
      assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `${id}: associated label`);
      assert.match(html, new RegExp(`<select[^>]*id="${id}"`), `${id}: control id`);
    }
    for (const status of ['idle', 'running', 'completed', 'stopped', 'error']) {
      for (const moduleId of Object.keys(MODULE_DESCRIPTORS).filter((id: string) => id !== '00-baseline')) {
        const state = initialSnapshot(moduleId); state.execution.status = status; state.running = status === 'running';
        const stateHtml = render({ state, actions });
        const labels = ['CPU submit', 'CPU frame', 'FPS', 'Draw calls'];
        labels.forEach(label => assert.equal((stateHtml.match(new RegExp(`>${label}<`, 'g')) ?? []).length, 1, `${moduleId}/${status}/${label}`));
        for (let index = 1; index < labels.length; index++) assert.ok(stateHtml.indexOf(labels[index - 1]) < stateHtml.indexOf(labels[index]), `${moduleId}/${status}: metric order`);
      }
    }
  } finally { await server.close(); }
});
