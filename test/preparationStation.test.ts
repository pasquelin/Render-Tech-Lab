import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { campaignSummary } from '../src/lab/campaignSummary.ts';

test('preparation station renders explicit lifecycle states and keeps baseline consultative', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { PreparationStation } = await server.ssrLoadModule('/src/components/PreparationStation.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const { LabNavbar } = await server.ssrLoadModule('/src/components/LabNavbar.tsx');
    const { CampaignSidebar } = await server.ssrLoadModule('/src/components/CampaignSidebar.tsx');
    const { LabSidebar } = await server.ssrLoadModule('/src/components/LabSidebar.tsx');
    const { MODULE_DESCRIPTORS } = await server.ssrLoadModule('/src/lab/modules.ts');
    const state = initialSnapshot('01-indirect-draw');
    const actions = { runBenchmark() {}, openReport() {} };
    const render = (component = PreparationStation) => renderToStaticMarkup(createElement(LabContext.Provider,
      { value: { state, actions } }, createElement(component)));
    for (const moduleId of Object.keys(MODULE_DESCRIPTORS).filter(moduleId => moduleId !== '00-baseline')) {
      state.moduleId = moduleId; state.execution.status = 'idle'; state.running = false;
      const idleHtml = render();
      assert.match(idleHtml, /data-execution-view="idle"/);
      assert.match(idleHtml, /Aucun test en cours/);
      assert.match(idleHtml, /Étapes attendues de la campagne/);
      assert.match(idleHtml, /Aucune campagne mesurée disponible/);
      assert.doesNotMatch(idleHtml, /canvas-webgpu|canvas-webgl/);
    }
    state.moduleId = '01-indirect-draw';
    for (const [status, text] of [['idle', 'Aucun test en cours'], ['running', 'Test en cours'], ['completed', 'Campagne terminée'], ['stopped', 'Arrêt manuel'], ['error', 'Exécution interrompue']]) {
      state.execution.status = status;
      state.running = status === 'running';
      state.execution.phase = status === 'error' ? 'WebGPU indisponible' : 'Mesure 12/128';
      const html = status === 'idle' ? render() : render(CampaignSidebar);
      if (status === 'running') assert.equal(render(), '');
      else assert.match(render(), new RegExp(`data-execution-view="${status}"`));
      assert.ok(html.includes(text));
      if (status === 'running') { assert.ok(!html.includes('Relancer')); assert.match(html, /Mesure 12\/128/); }
      else assert.match(html, /Aucune campagne mesurée disponible/);
      if (status === 'error') assert.match(html, /WebGPU indisponible/);
    }
    state.moduleId = '00-baseline'; state.execution.status = 'idle'; state.running = false;
    const baseline = render();
    const sidebar = render(LabSidebar);
    assert.match(sidebar, /Choisissez un banc/);
    assert.match(sidebar, /Bancs d’essai/);
    assert.match(sidebar, /id="dashboard-intro-card"/);
    assert.match(sidebar, /id="dashboard-benches-card"/);
    assert.match(sidebar, /grid grid-cols-2 gap-2/);
    assert.doesNotMatch(sidebar, /id="lab-metrics-card"|CPU submit|CPU frame|Draw calls/);
    assert.match(baseline, /Laboratoire de rendu temps réel/);
    assert.match(baseline, />Dashboard</);
    assert.match(baseline, /Choisir un banc/);
    assert.match(baseline, /Lancer le protocole/);
    assert.match(baseline, /Lire le résultat/);
    assert.match(baseline, /id="dashboard-reports"/);
    assert.match(baseline, /Derniers rapports vérifiés/);
    assert.match(baseline, /grid grid-cols-1 sm:grid-cols-2 gap-2/);
    assert.equal((baseline.match(/data-dashboard-report=/g) ?? []).length, 15);
    assert.doesNotMatch(baseline, /data-bench-access/);
    assert.doesNotMatch(sidebar, /dashboard-reports|Derniers rapports vérifiés/);
    assert.doesNotMatch(baseline, /3\.35 ms|54 FPS|Coude|Chute/);
    assert.doesNotMatch(baseline, /S[0-5] ·/);
    assert.doesNotMatch(baseline, /Aucune campagne|Configurations de charge|Mesures de référence|Comparer aux autres bancs/);
    assert.doesNotMatch(baseline, /Aucun test en cours|Étapes de la campagne|Relancer|Mesurer A\/B|Consulter le rapport/);
    const { MODULE_NAV } = await server.ssrLoadModule('/src/lab/catalog.ts');
    for (const module of MODULE_NAV) {
      state.moduleId = module.id;
      const html = render(LabSidebar);
      if (module.id === '00-baseline') {
        assert.equal((html.match(/data-bench-access=/g) ?? []).length, 15);
        assert.match(html, /data-bench-access="14-open-world"/);
        assert.match(html, /data-bench-access="15-virtualized-integration"/);
      }
      assert.doesNotMatch(html, /href="\/\?test=/);
      if (module.id !== '04-gpu-lod') assert.doesNotMatch(html, /href="\/04-gpu-lod\/comparison.html"/);
      if (module.id !== '00-baseline') {
        state.running = true;
        state.execution.status = 'running';
        const locked = render(LabSidebar);
        const modeControls = ['01-indirect-draw', '03-gpu-scene', '04-gpu-lod', '14-open-world'].includes(module.id) ? ['btn-classic','btn-gpu-driven'] : [];
        for (const id of [...modeControls,module.id === '15-virtualized-integration' ? 'select-diagnostic-view' : 'select-count','btn-benchmark','btn-view-report','btn-open-reports']) {
          const tag = locked.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0];
          assert.ok(tag?.includes('disabled=""'), `${module.id}: ${id} must be disabled`);
        }
        if (modeControls.length === 0) assert.doesNotMatch(locked, /id="btn-(?:classic|gpu-driven)"/, `${module.id}: no decorative A/B controls`);
        assert.match(render(LabNavbar), /id="select-module" disabled=""/);
        state.running = false; state.execution.status = 'completed';
        assert.doesNotMatch(render(LabSidebar), /id="btn-benchmark"[^>]*disabled=""/);
      }
    }
    for (const moduleId of ['01-indirect-draw', '03-gpu-scene']) {
      state.moduleId = moduleId;
      const header = render(LabNavbar);
      assert.match(header, /href="\/?\?test=00-baseline"/);
      assert.match(header, /aria-label="Ouvrir le Dashboard render-tech-lab"/);
      const escaped = renderToStaticMarkup(createElement('p', {}, MODULE_DESCRIPTORS[moduleId].description)).slice(3, -4);
      assert.ok(header.includes(`title="${escaped}"`));
      assert.match(header, /truncate whitespace-nowrap/);
      assert.doesNotMatch(header, /max-h-32|whitespace-normal/);
    }
    assert.equal(campaignSummary({ timestamp: new Date().toISOString(), status: 'not-run', cpu: { frameMs: 123 } }), null);
    assert.equal(campaignSummary(null), null);
    assert.equal(campaignSummary({ timestamp: new Date().toISOString(), blocks: [] }), null);
    const archived01 = campaignSummary({ timestamp: '2026-09-12T10:00:00.000Z', tiers: [500, 1000, 2000, 5000],
      classicResults: [500, 1000, 2000, 5000].map((objectCount, index) => ({ objectCount, avgSubmitMs: index + 1 })),
      gpuDrivenResults: [500, 1000, 2000, 5000].map((objectCount, index) => ({ objectCount, avgSubmitMs: index + 0.5 })) });
    assert.deepEqual(archived01?.series.map(series => series.values), [[1, 2, 3, 4], [0.5, 1.5, 2.5, 3.5]]);
    assert.equal(archived01?.configuration, '500 / 1000 / 2000 / 5000 objets');
    const rejected14 = campaignSummary({ test: '14-open-world', timestamp: '2026-09-12T11:10:12.712Z', quality: { passed: false }, config: { districts: 9, width: 1920, height: 1080 }, blocks: [] });
    assert.equal(rejected14?.status, 'Rejetée · aucune mesure de performance');
    assert.deepEqual(rejected14?.series, []);
  } finally { await server.close(); }
});
