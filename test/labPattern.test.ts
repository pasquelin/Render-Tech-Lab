import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('the shell has a single presentation catalog and no per-bench UI copies', async () => {
  const sidebar = await readFile('src/components/LabSidebar.tsx', 'utf8');
  const station = await readFile('src/components/PreparationStation.tsx', 'utf8');
  const viewport = await readFile('src/components/LabViewport.tsx', 'utf8');
  const navbar = await readFile('src/components/LabNavbar.tsx', 'utf8');
  const campaign = await readFile('src/components/CampaignSidebar.tsx', 'utf8');
  const modal = await readFile('src/components/ReportModal.tsx', 'utf8');
  assert.doesNotMatch(sidebar, /ModelPanels/);
  assert.doesNotMatch(viewport, /ModelPanels/);
  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(sidebar, /ACCESS_META|MODE_CHOICE/);
  assert.doesNotMatch(sidebar, /<a[^>]*id="btn-lod-comparison"/);
  assert.doesNotMatch(station, /moduleId === '01-indirect-draw'|moduleId === '03-gpu-scene'|moduleId === '09-gpu-compaction'/);
  assert.doesNotMatch(viewport, /new Set\(\['05-meshlets'/);
  assert.doesNotMatch(navbar, /<select /);
  assert.doesNotMatch(navbar, /className="btn btn-ghost btn-square/);
  assert.doesNotMatch(campaign, /labCardClass/);
});

test('every bench exposes the same sidebar contract from moduleUi', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSidebar } = await server.ssrLoadModule('/src/components/LabSidebar.tsx');
    const { CampaignSidebar } = await server.ssrLoadModule('/src/components/CampaignSidebar.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { initialSnapshot } = await server.ssrLoadModule('/src/lab/labState.ts');
    const { MODULE_NAV } = await server.ssrLoadModule('/src/lab/catalog.ts');
    const { moduleUi } = await server.ssrLoadModule('/src/lab/moduleUi.ts');
    const actions = { switchModule() {}, setMode() {}, setScenario() {}, runBenchmark() {}, runPain() {}, openReport() {}, closeReport() {}, copyReport() {}, refreshReport() {}, openFinder() {} };
    const render = (moduleId: string, extra: Record<string, unknown> = {}) => {
      const state = { ...initialSnapshot(moduleId), ...extra };
      return renderToStaticMarkup(createElement(LabContext.Provider, { value: { state, actions } }, createElement(LabSidebar, { chartRef: { current: null } })));
    };
    for (const { id } of MODULE_NAV) {
      const ui = moduleUi(id);
      assert.ok(ui.category.length > 0, `${id}: category`);
      assert.ok(ui.status.length > 0, `${id}: status`);
      const html = render(id);
      assert.equal((html.match(/<canvas/g) ?? []).length, 0, `${id}: canvas at rest`);
      if (id === '00-baseline') {
        assert.match(html, /data-bench-access="01-indirect-draw"/);
        assert.doesNotMatch(html, /id="btn-benchmark"/);
      } else {
      const ids = ['lab-mode-card', 'lab-metrics-card', 'lab-run-card'];
      ids.forEach(section => assert.equal((html.match(new RegExp(`id="${section}"`, 'g')) ?? []).length, 1, `${id}: ${section}`));
      assert.match(html, /id="lab-report-card"/, `${id}: report area stays visible outside a test`);
      for (const buttonId of ['btn-view-report', 'btn-open-reports']) {
        assert.match(html.match(new RegExp(`<button[^>]*id="${buttonId}"[^>]*>`))?.[0] ?? '', /disabled=""/, `${id}: ${buttonId} is disabled until a report is available`);
      }
      for (const label of ['CPU submit', 'CPU frame', 'FPS', 'Draw calls']) assert.match(html, new RegExp(`>${label}<`), `${id}: ${label}`);
        assert.match(html, /id="bench-status"/);
        assert.match(html, /id="stat-mode"/);
        assert.match(html, /id="stat-objects"/);
        assert.match(html, /id="btn-benchmark"/);
        if (ui.hasModeChoice) assert.match(html, /id="btn-classic"/);
        else assert.doesNotMatch(html, /id="btn-classic"/);
      }
    }
    const running = render('01-indirect-draw', { running: true, execution: { status: 'running', phase: 'Mesurer', lastCampaign: null }, showChart: true });
    assert.match(running, /<canvas id="canvas-chart"/);
    assert.match(running, /id="bench-status"[^>]*badge/);
    const completed = render('01-indirect-draw', { running: false, execution: { status: 'completed', phase: 'Terminée', lastCampaign: null }, showChart: true });
    assert.match(completed, /<canvas id="canvas-chart"/);
    const campaignHtml = renderToStaticMarkup(createElement(LabContext.Provider, { value: { state: { ...initialSnapshot('01-indirect-draw'), running: true, execution: { status: 'running', phase: 'Mesurer', lastCampaign: null } }, actions } }, createElement(CampaignSidebar)));
    assert.doesNotMatch(campaignHtml, /card bg-base-300/);
    const lod = render('04-gpu-lod');
    assert.match(lod, /id="btn-lod-comparison"/);
    assert.match(lod, /href="\/04-gpu-lod\/comparison.html"/);
  } finally { await server.close(); }
});
