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

test('banks put campaign controls first and show reports only outside a running test', async () => {
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
        assert.equal((html.match(/data-bench-access=/g) ?? []).length, 16);
        assert.doesNotMatch(html, /lab-metrics-card|CPU submit|CPU frame|Draw calls/);
        continue;
      }
      const ids = ['lab-run-card', 'lab-mode-card', 'lab-metrics-card'];
      ids.forEach(id => assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `${moduleId}: ${id}`));
      assert.match(html, /id="lab-report-card"/, `${moduleId}: report section is available at rest`);
      for (const buttonId of ['btn-view-report', 'btn-open-reports']) {
        assert.match(html.match(new RegExp(`<button[^>]*id="${buttonId}"[^>]*>`))?.[0] ?? '', /disabled=""/, `${moduleId}: ${buttonId} is disabled until a report is available`);
      }
      for (let index = 1; index < ids.length; index++) assert.ok(html.indexOf(ids[index - 1]) < html.indexOf(ids[index]), `${moduleId}: section order`);
      for (const label of ['CPU submit', 'CPU frame', 'FPS', 'Draw calls']) assert.match(html, new RegExp(`>${label}<`), `${moduleId}: ${label}`);
    }
    const modelConfig = { cities:1 as const, detail:'source' as const, lodQuality:'high' as const, mode:'explore' as const, camera:'orbit' as const, diagnostic:'beauty' as const, layout:'single' as const, engine:'three-webgl-reference' as const, compareEngine:'exact-cluster-pages' as const, wipe:.5 };
    const model = { config:modelConfig,setConfig(){},availableEngines:[],selectEngine(){},selectDiagnostic(){},availableTriangles:1200,report:null,history:[],showReport(){},exportReport(){},availability: {status:'ready',message:'Cache disponible'}, retryAvailability() {}, status: 'ready', message: 'Ville prête', progress: null, surfaceKey: '0-0', cameraMode: 'orbit', cameraPose: { position: [1,2,3] as [number,number,number], target: [4,5,6] as [number,number,number], fov: 55, near: 0.1, far: 1000 }, metrics: { cpuFrameMs: 5, drawCalls: 8, triangles: 1200, pageLoads: 3 }, frameIntervalMs: 20, position: '0 · 0 · 0', setCameraMode() {}, stop() {}, restart() {} };
    const idleHtml = renderShell({ state: initialSnapshot('15-virtualized-integration'), actions, model, onIntegrationScene() {} });
    const runningState = initialSnapshot('15-virtualized-integration');
    runningState.running = true;
    runningState.execution = { ...runningState.execution, status: 'running' };
    const html = renderShell({ state: runningState, actions, model, onIntegrationScene() {} });
    assert.match(html, /id="stat-fps"[^>]*>50 FPS</);
    assert.match(html, /Provenance FPS : 1000 ÷ intervalle requestAnimationFrame \(rAF\)/);
    assert.match(html, /Métriques spécifiques/);
    assert.match(html, /Caméra active/);
    assert.match(html, /Position X\/Y\/Z/);
    assert.match(html, /Regarde vers X\/Y\/Z/);
    assert.match(html, /FOV 55° · plans 0,1/);
    assert.doesNotMatch(idleHtml, /id="lab-mode-card"/, 'la configuration de lancement reste dans le panneau principal');
    assert.ok(idleHtml.indexOf('id="model-scene"') < idleHtml.indexOf('id="model-mode"'), 'la scène précède le modèle et le parcours');
    assert.match(idleHtml, /data-bench-screen="start"/);
    assert.match(idleHtml, /id="model-start-engine"/, 'le moteur peut être choisi avant le premier lancement libre');
    assert.match(idleHtml, /name="model-start-engine"/, 'le choix initial de moteur est un groupe radio partagé');
    assert.match(idleHtml, /id="model-start-engine"[^>]*sm:grid-cols-4/, 'les quatre moteurs sont présentés sur une ligne');
    assert.match(idleHtml, /id="lab-preparation-card"/, 'la préparation du modèle est dans la colonne droite');
    assert.ok(idleHtml.indexOf('id="lab-run-card"') < idleHtml.indexOf('id="lab-preparation-card"'), 'le lancement précède la préparation');
    assert.match(idleHtml, /1\. Exécution/);
    assert.match(idleHtml, /2\. Préparation du modèle/);
    assert.match(idleHtml, /id="model-detail"[^>]*sm:grid-cols-2/, 'le niveau de détail est lisible en deux colonnes');
    assert.match(idleHtml, /id="model-extent"[^>]*sm:grid-cols-4/, 'les quatre étendues tiennent sur une ligne');
    assert.ok(html.indexOf('model-camera') > html.indexOf('lab-mode-card'), 'les contrôles de navigation restent à droite');
    assert.doesNotMatch(html, /GPU \/ VRAM/);
    for (const id of ['model-scene', 'model-extent', 'model-detail', 'model-anisotropy']) {
      assert.match(idleHtml, new RegExp(`id="${id}"`), `${id}: launch group`);
      assert.match(idleHtml, new RegExp(`name="${id}"`), `${id}: radio name`);
    }
    assert.match(idleHtml, /value="12"/, 'la préparation propose une charge de douze modèles');
    assert.match(idleHtml, /12 modèles/);
    assert.doesNotMatch(html, /id="model-poi"/, 'la navigation ne propose plus de point d’intérêt prédéfini');
    for (const id of ['model-camera', 'model-diagnostic', 'model-engine']) {
      assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `${id}: associated label`);
      assert.match(html, new RegExp(`<select[^>]*id="${id}"`), `${id}: control id`);
    }
    const stoppedState = initialSnapshot('15-virtualized-integration');
    stoppedState.running = false;
    stoppedState.execution = { ...stoppedState.execution, status: 'stopped' };
    const stoppedHtml = renderShell({ state: stoppedState, actions, model: { ...model, status: 'stopped' }, onIntegrationScene() {} });
    assert.doesNotMatch(stoppedHtml.match(/<input[^>]*id="model-extent-1"[^>]*>/)?.[0] ?? '', /disabled/, 'après arrêt, l’étendue reste configurable');
    assert.match(stoppedHtml, /data-bench-screen="end"/);
    assert.doesNotMatch(stoppedHtml, /id="lab-mode-card"/, 'hors exécution, les contrôles d’exploration ne sont pas affichés');
    assert.doesNotMatch(stoppedHtml, /id="lab-metrics-card"/, 'hors exécution, les métriques en direct ne sont pas affichées');
    assert.match(stoppedHtml, /id="lab-preparation-card"/, 'hors exécution, les réglages de préparation restent à droite');
    const runningHtml = renderShell({ state: runningState, actions, model: { ...model, status: 'ready' }, onIntegrationScene() {} });
    assert.equal(runningHtml.includes('id="model-scene"'), false, 'pendant le rendu, la config de lancement quitte le panneau principal');
    assert.doesNotMatch(runningHtml, /id="lab-preparation-card"/, 'pendant le rendu, les réglages de préparation disparaissent');
    assert.match(runningHtml, /1\. Exécution/);
    assert.match(runningHtml, /2\. Contrôles pendant le rendu/);
    assert.match(runningHtml, /3\. Métriques en direct/);
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="model-camera"[^>]*>/)?.[0] ?? '', /disabled/, 'la caméra reste changeable pendant la navigation');
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="model-diagnostic"[^>]*>/)?.[0] ?? '', /disabled/, 'la vue reste changeable pendant la navigation');
    assert.doesNotMatch(runningHtml.match(/<select[^>]*id="model-engine"[^>]*>/)?.[0] ?? '', /disabled/, 'le moteur reste changeable pendant la navigation');
    const loadingHtml = renderShell({ state: runningState, actions, model: { ...model, status: 'loading' }, onIntegrationScene() {} });
    assert.doesNotMatch(loadingHtml, /id="lab-mode-card"/, 'pendant le chargement, les contrôles d’exploration ne sont pas affichés');
    assert.doesNotMatch(loadingHtml, /id="lab-metrics-card"/, 'pendant le chargement, les métriques en direct ne sont pas affichées');
    const pathModel = { ...model, config: { ...modelConfig, mode: 'path' as const } };
    const pathIdleHtml = renderShell({ state: initialSnapshot('15-virtualized-integration'), actions, model: pathModel, onIntegrationScene() {} });
    assert.doesNotMatch(pathIdleHtml, /id="model-start-engine"/, 'le parcours impose ses moteurs et ne propose pas de moteur initial');
    assert.equal(pathIdleHtml.includes('id="lab-mode-card"'), false, 'le parcours n’affiche pas de contrôles pendant le rendu');
    assert.match(pathIdleHtml, /id="lab-preparation-card"/, 'le parcours au repos conserve les réglages de préparation à droite');
    assert.doesNotMatch(pathIdleHtml, /Contrôles pendant le rendu|Parcours automatique|Seul Arrêter reste actif/);
    assert.doesNotMatch(pathIdleHtml, /id="lab-metrics-card"/, 'le parcours au repos ne montre pas de métriques en direct');
    const pathRunningHtml = renderShell({ state: runningState, actions, model: { ...pathModel, status: 'ready' }, onIntegrationScene() {} });
    assert.equal(pathRunningHtml.includes('id="lab-mode-card"'), false, 'pendant le parcours, la carte des contrôles disparaît');
    assert.doesNotMatch(pathRunningHtml, /Contrôles pendant le rendu|Seul Arrêter reste actif/);
    assert.match(pathRunningHtml, /id="lab-metrics-card"/);
    assert.match(pathRunningHtml, /id="lab-run-card"/);
    assert.match(pathRunningHtml, /1\. Exécution/);
    assert.match(pathRunningHtml, /2\. Métriques en direct/);
    for (const status of ['idle', 'running', 'completed', 'stopped', 'error']) {
      for (const moduleId of Object.keys(MODULE_DESCRIPTORS).filter((id: string) => id !== '00-baseline')) {
        const state = initialSnapshot(moduleId); state.execution.status = status; state.running = status === 'running';
        const stateHtml = render({ state, actions });
        if (status === 'running') assert.doesNotMatch(stateHtml, /id="lab-report-card"/, `${moduleId}: reports are hidden while running`);
        else assert.match(stateHtml, /id="lab-report-card"/, `${moduleId}/${status}: reports are visible outside a test`);
        const labels = ['CPU submit', 'CPU frame', 'FPS', 'Draw calls'];
        labels.forEach(label => assert.equal((stateHtml.match(new RegExp(`>${label}<`, 'g')) ?? []).length, 1, `${moduleId}/${status}/${label}`));
        for (let index = 1; index < labels.length; index++) assert.ok(stateHtml.indexOf(labels[index - 1]) < stateHtml.indexOf(labels[index]), `${moduleId}/${status}: metric order`);
      }
    }
  } finally { await server.close(); }
});
