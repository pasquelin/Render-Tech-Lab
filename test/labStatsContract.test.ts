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

test('banks expose the four-section contract while Dashboard stays a compact navigation', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSidebar } = await server.ssrLoadModule('/src/components/LabSidebar.tsx');
    const { LabShell } = await server.ssrLoadModule('/src/components/LabShell.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const { MODULE_DESCRIPTORS } = await server.ssrLoadModule('/src/lab/modules.ts');
    const actions = { switchModule() {}, setMode() {}, setScenario() {}, runBenchmark() {}, runPain() {}, openReport() {}, closeReport() {}, copyReport() {}, refreshReport() {}, openFinder() {} };
    const emptyRef = { current: null };
    const render = (value: Record<string, unknown>) => renderToStaticMarkup(createElement(LabContext.Provider, { value }, createElement(LabSidebar, { chartRef: emptyRef })));
    const renderShell = (value: Record<string, unknown>) => renderToStaticMarkup(createElement(LabContext.Provider, { value }, createElement(LabShell, { webglRef: emptyRef, webgpuRef: emptyRef, chartRef: emptyRef })));
    for (const moduleId of Object.keys(MODULE_DESCRIPTORS)) {
      const html = render({ state: initialSnapshot(moduleId), actions });
      if (moduleId === '00-baseline') {
        assert.match(html, /id="dashboard-intro-card"/);
        assert.match(html, /id="dashboard-benches-card"/);
        assert.match(html, /grid grid-cols-2 gap-2/);
        assert.equal((html.match(/data-bench-access=/g) ?? []).length, 15);
        assert.doesNotMatch(html, /lab-metrics-card|CPU submit|CPU frame|Draw calls/);
        continue;
      }
      const ids = ['lab-mode-card', 'lab-metrics-card', 'lab-run-card', 'lab-report-card'];
      ids.forEach(id => assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `${moduleId}: ${id}`));
      for (let index = 1; index < ids.length; index++) assert.ok(html.indexOf(ids[index - 1]) < html.indexOf(ids[index]), `${moduleId}: section order`);
      for (const label of ['CPU submit', 'CPU frame', 'FPS', 'Draw calls']) assert.match(html, new RegExp(`>${label}<`), `${moduleId}: ${label}`);
    }
    const emeraldConfig = { cities:1 as const, detail:'source' as const, lodQuality:'high' as const, mode:'explore' as const, camera:'orbit' as const, diagnostic:'beauty' as const, layout:'single' as const, engine:'three-webgl-reference' as const, compareEngine:'exact-cluster-pages' as const, poi:null, wipe:.5 };
    const emerald = { config:emeraldConfig,setConfig(){},availableEngines:[],selectEngine(){},selectDiagnostic(){},availableTriangles:1200,report:null,history:[],showReport(){},exportReport(){},availability: {status:'ready',message:'Cache disponible'}, retryAvailability() {}, status: 'ready', message: 'Ville prête', progress: null, surfaceKey: '0-0', cameraMode: 'orbit', metrics: { cpuFrameMs: 5, drawCalls: 8, triangles: 1200, pageLoads: 3 }, frameIntervalMs: 20, position: '0 · 0 · 0', setCameraMode() {}, stop() {}, restart() {} };
    const html = renderShell({ state: initialSnapshot('15-virtualized-integration'), actions, emerald, onIntegrationScene() {} });
    assert.match(html, /id="stat-fps"[^>]*>50 FPS</);
    assert.match(html, /Provenance FPS : 1000 ÷ intervalle requestAnimationFrame \(rAF\)/);
    assert.match(html, /Métriques spécifiques/);
    assert.ok(html.indexOf('emerald-scene') < html.indexOf('lab-mode-card'), 'la config de lancement est dans le panneau principal');
    assert.ok(html.indexOf('id="emerald-scene"') < html.indexOf('id="emerald-mode"'), 'la scène précède le mode, l’étendue et le détail');
    assert.ok(html.indexOf('id="emerald-scene"') < html.indexOf('id="emerald-extent"'));
    assert.match(html, /id="emerald-detail"[^>]*sm:grid-cols-4/);
    assert.ok(html.indexOf('emerald-camera') > html.indexOf('lab-mode-card'), 'les contrôles de navigation restent à droite');
    assert.doesNotMatch(html, /GPU \/ VRAM/);
    for (const id of ['emerald-scene', 'emerald-extent', 'emerald-detail']) {
      assert.match(html, new RegExp(`id="${id}"`), `${id}: launch group`);
      assert.match(html, new RegExp(`name="${id}"`), `${id}: radio name`);
    }
    for (const id of ['emerald-camera', 'emerald-diagnostic', 'emerald-engine']) {
      assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `${id}: associated label`);
      assert.match(html, new RegExp(`<select[^>]*id="${id}"`), `${id}: control id`);
    }
    const stoppedState = initialSnapshot('15-virtualized-integration');
    stoppedState.running = false;
    stoppedState.execution = { ...stoppedState.execution, status: 'stopped' };
    const stoppedHtml = renderShell({ state: stoppedState, actions, emerald: { ...emerald, status: 'stopped' }, onIntegrationScene() {} });
    assert.doesNotMatch(stoppedHtml.match(/<input[^>]*id="emerald-extent-1"[^>]*>/)?.[0] ?? '', /disabled/, 'après arrêt, l’étendue reste configurable');
    const runningState = initialSnapshot('15-virtualized-integration');
    runningState.running = true;
    runningState.execution = { ...runningState.execution, status: 'running' };
    const runningHtml = renderShell({ state: runningState, actions, emerald: { ...emerald, status: 'ready' }, onIntegrationScene() {} });
    assert.equal(runningHtml.includes('id="emerald-scene"'), false, 'pendant le rendu, la config de lancement quitte le panneau principal');
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="emerald-camera"[^>]*>/)?.[0] ?? '', /disabled/, 'la caméra reste changeable pendant la navigation');
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="emerald-diagnostic"[^>]*>/)?.[0] ?? '', /disabled/, 'la vue reste changeable pendant la navigation');
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="emerald-engine"[^>]*>/)?.[0] ?? '', /disabled/, 'le moteur reste changeable pendant la navigation');
    const loadingHtml = renderShell({ state: runningState, actions, emerald: { ...emerald, status: 'loading' }, onIntegrationScene() {} });
    assert.match(loadingHtml.match(/<select[^>]*id="emerald-engine"[^>]*>/)?.[0] ?? '', /disabled/, 'pendant le chargement, le moteur reste verrouillé');
    const pathEmerald = { ...emerald, config: { ...emeraldConfig, mode: 'path' as const } };
    const pathIdleHtml = renderShell({ state: initialSnapshot('15-virtualized-integration'), actions, emerald: pathEmerald, onIntegrationScene() {} });
    assert.equal(pathIdleHtml.includes('id="lab-mode-card"'), false, 'le parcours n’affiche pas de contrôles pendant le rendu');
    assert.doesNotMatch(pathIdleHtml, /Contrôles pendant le rendu|Parcours automatique|Seul Arrêter reste actif/);
    assert.match(pathIdleHtml, /id="lab-metrics-card"/);
    const pathRunningHtml = renderShell({ state: runningState, actions, emerald: { ...pathEmerald, status: 'ready' }, onIntegrationScene() {} });
    assert.equal(pathRunningHtml.includes('id="lab-mode-card"'), false, 'pendant le parcours, la carte des contrôles disparaît');
    assert.doesNotMatch(pathRunningHtml, /Contrôles pendant le rendu|Seul Arrêter reste actif/);
    assert.match(pathRunningHtml, /id="lab-metrics-card"/);
    assert.match(pathRunningHtml, /id="lab-run-card"/);
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
