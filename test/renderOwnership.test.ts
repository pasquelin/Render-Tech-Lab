import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { canvasVisibility } from '../src/lab/canvasVisibility.ts';

test('shared WebGL renderer ownership is scoped to its canvas and can be released', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(
    new URL('../src/common/gpuContext.ts', import.meta.url), 'utf8'));
  assert.match(source, /sharedGLCanvas/);
  assert.match(source, /releaseSharedGLRenderer/);
  assert.match(source, /sharedGLCanvas !== canvas/);
});

test('React canvas visibility and runner ownership survive transitions', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { LabSession } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    const { BenchmarkRunner } = await server.ssrLoadModule('/01-indirect-draw/runner/index.ts');
    const { GPUSceneBenchmarkRunner } = await server.ssrLoadModule('/03-gpu-scene/runner/index.ts');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { ViewportCanvases } = await server.ssrLoadModule('/src/components/ViewportCanvases.tsx');
    const { LabViewport } = await server.ssrLoadModule('/src/components/LabViewport.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    // Benchmark actions must stay in the existing shell, including stress runs.
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;
    globalThis.window = { open() { assert.fail('unexpected new window'); },
      location: { assign() { assert.fail('unexpected navigation'); } } } as unknown as Window & typeof globalThis;
    globalThis.fetch = async () => { throw new Error('unexpected external execution'); };
    try {
      for (const action of ['runBenchmark', 'runPain']) {
        const integrated = new LabSession({});
        integrated.patch({ moduleId: '01-indirect-draw', mode: 'classic', scenarioVal: '500' });
        let finish!: () => void;
        let calls = 0;
        integrated.runner01 = { runAutomatedBenchmark: async (tiers: number[]) => {
          calls++;
          assert.deepEqual(tiers, action === 'runBenchmark' ? [500, 1000, 2000, 5000] : [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
          await new Promise<void>((resolve) => { finish = resolve; });
        } };
        const campaign = integrated[action]();
        await Promise.resolve();
        assert.equal(calls, 1);
        assert.equal(integrated.state.running, true);
        assert.match(integrated.state.benchStatus, /dans le laboratoire/);
        assert.equal(integrated.state.showWebgl, true);
        assert.equal(integrated.state.showWebgpu, false);
        await integrated[action]();
        assert.equal(calls, 1);
        finish();
        await campaign;
        assert.equal(integrated.state.running, false);
        for (const moduleId of ['02-gpu-frustum-culling', '09-gpu-compaction']) {
          integrated.patch({ moduleId });
          await integrated[action]();
          assert.match(integrated.state.benchStatus, /non exécuté.*WebGPU device(?:\/canvas)? absent/);
          assert.equal(integrated.state.execution.lastCampaign, null);
          assert.equal(integrated.state.workbench.visible, false);
          assert.equal(integrated.state.running, false);
          assert.equal(integrated.state.showWebgpu, true);
        }
      }
    } finally { globalThis.window = originalWindow; globalThis.fetch = originalFetch; }
    const nativeShell = new LabSession({});
    nativeShell.patch({ moduleId: '04-gpu-lod', showWebgpu: true, showWebgl: false, execution: { status: 'idle', phase: '', lastCampaign: null } });
    const nativeHtml = renderToStaticMarkup(createElement(LabContext.Provider,
      { value: { state: nativeShell.state, actions: nativeShell.actions } },
      createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
    assert.match(nativeHtml, /id="scene-container" class="[^"]*hidden/);
    assert.match(nativeHtml, /id="canvas-webgpu" class="[^"]*object-cover/);
    assert.doesNotMatch(nativeHtml, /id="canvas-webgpu" class="[^"]*\bhidden\b/);
    assert.match(nativeHtml, /Aucun test en cours/);
    assert.match(nativeHtml, /data-execution-view="idle"/);
    for (const phase of ['Préparer', 'Contrôler', 'Échauffer 12/30', 'Mesurer A/B · 42/120', 'Drain GPU']) {
      nativeShell.patch({ moduleId: '14-open-world', showWebgl: true, showWebgpu: false, execution: { status: 'running', phase, lastCampaign: null } });
      const running14 = renderToStaticMarkup(createElement(LabContext.Provider,
        { value: { state: nativeShell.state, actions: nativeShell.actions } },
        createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
      assert.match(running14, /id="scene-container" class="[^"]*flex-1/, phase);
      assert.match(running14, /id="canvas-webgl" class="[^"]*object-cover/, phase);
      assert.doesNotMatch(running14, /id="canvas-webgl" class="[^"]*\bhidden\b/, phase);
      assert.doesNotMatch(running14, /data-execution-view="idle"/, phase);
      assert.match(running14, /data-render-loading="true"/, phase);
    }
    nativeShell.patch({ framePresented: true });
    const firstFrame14 = renderToStaticMarkup(createElement(LabContext.Provider,
      { value: { state: nativeShell.state, actions: nativeShell.actions } },
      createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
    assert.match(firstFrame14, /id="canvas-webgl" class="[^"]*object-cover/);
    assert.doesNotMatch(firstFrame14, /id="canvas-webgl" class="[^"]*\bhidden\b/);
    assert.doesNotMatch(firstFrame14, /data-render-loading="true"/);
    nativeShell.patch({ framePresented: false, stats: { ...nativeShell.state.stats, submit: '9.0 ms', cpuFrame: '9.2 ms', fps: '68.9 FPS', drawCalls: '3 372' } });
    const measuredFrame14 = renderToStaticMarkup(createElement(LabContext.Provider,
      { value: { state: nativeShell.state, actions: nativeShell.actions } },
      createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
    assert.doesNotMatch(measuredFrame14, /data-render-loading="true"/, 'live frame metrics prove that the first frame is already visible');
    const progressByModule = {
      '01-indirect-draw': ['buffers', 'Préparation des instances et buffers indirects.'],
      '02-gpu-frustum-culling': ['shaders', 'Compilation du culling frustum.'],
      '03-gpu-scene': ['scène', 'Préparation des géométries et objets.'],
      '04-gpu-lod': ['meshes', 'Préparation des niveaux de détail.'],
      '05-meshlets': ['calcul', 'Partition des meshlets.'],
      '06-meshlet-culling': ['calcul', 'Culling des meshlets.'],
      '07-hiz': ['buffers', 'Construction de la pyramide Hi-Z.'],
      '08-occlusion-culling': ['calcul', 'Évaluation de l’occlusion.'],
      '09-gpu-compaction': ['buffers', 'Compaction des commandes GPU.'],
      '10-material-batching': ['buffers', 'Construction des tables de matériaux.'],
      '11-geometry-streaming': ['buffers', 'Chargement des pages de géométrie.'],
      '12-visibility-buffer': ['buffers', 'Encodage du visibility buffer.'],
      '13-full-gpu-driven': ['scène', 'Contrôle de disponibilité du pipeline.'],
      '14-open-world': ['textures', 'Chargement des textures Bistro.'],
    } as const;
    for (const [moduleId, [itemType, message]] of Object.entries(progressByModule)) {
      nativeShell.patch({ moduleId, framePresented: false, stats: { ...nativeShell.state.stats, submit: 'non mesuré', cpuFrame: 'non mesuré', fps: 'non mesuré', drawCalls: 'non mesuré' }, execution: { status: 'running', phase: '17 %', lastCampaign: null }, progress: { phase: 'prepare', itemType, message } });
      const loading = renderToStaticMarkup(createElement(LabContext.Provider,
        { value: { state: nativeShell.state, actions: nativeShell.actions } },
        createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
      assert.match(loading, /data-render-loading="true"[^>]*bg-base-100(?:["\s])/, moduleId);
      assert.match(loading, new RegExp(itemType), moduleId);
      assert.match(loading, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), moduleId);
      nativeShell.patch({ framePresented: true, execution: { ...nativeShell.state.execution, phase: 'Mesurer 42 %' } });
      const presented = renderToStaticMarkup(createElement(LabContext.Provider,
        { value: { state: nativeShell.state, actions: nativeShell.actions } },
        createElement(LabViewport, { webglRef: { current: null }, webgpuRef: { current: null } })));
      assert.doesNotMatch(presented, /data-render-loading="true"/, `${moduleId}: phase changes cannot restore the loader after a frame`);
    }
    const session = new LabSession({});
    session.runner01 = {};
    session.runner02 = {};
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => 1;
    try {
      for (const moduleId of ['01-indirect-draw', '03-gpu-scene', '00-baseline', '05-meshlets']) {
        for (const mode of ['classic', 'gpu-driven']) {
          session.patch({ moduleId, mode, showWebgl: true, showWebgpu: true, execution: { ...session.state.execution, status: 'running' } });
          const visibility = canvasVisibility(moduleId, mode);
          assert.equal(session.state.showWebgl, visibility.showWebgl);
          assert.equal(session.state.showWebgpu, visibility.showWebgpu);
          session.patch({ benchStatus: 'progress' });
          const html = renderToStaticMarkup(createElement(ViewportCanvases, {
            webglRef: { current: null }, webgpuRef: { current: null }, ...session.state,
          }));
          const live = moduleId === '01-indirect-draw' || moduleId === '03-gpu-scene' || moduleId === '05-meshlets';
          const visible = (html.match(/id="canvas-(?:webgl|webgpu)" class="[^"]*"/g) ?? []).filter(tag => !/\bhidden\b/.test(tag)).length;
          assert.equal(visible, live ? 1 : 0);
          assert.equal('animate' in session, false, 'the React shell must not own a perpetual render loop');
        }
      }
      session.patch({ moduleId: '03-gpu-scene', running: true, mode: 'classic' });
      await session.switchModule('01-indirect-draw');
      const originalScenario = session.state.scenarioVal;
      await session.setScenario('100000');
      assert.equal(session.state.scenarioVal, originalScenario);
      session.actions.setMode('gpu-driven');
      assert.equal(session.state.moduleId, '03-gpu-scene');
      assert.equal(session.state.mode, 'classic');
      session.publishRunnerMode('03-gpu-scene', 'gpu-driven');
      assert.equal(session.state.showWebgpu, true);
      assert.equal(session.state.showWebgl, false);
      session.publishRunnerMode('01-indirect-draw', 'classic');
      assert.equal(session.state.mode, 'gpu-driven');
    } finally { globalThis.requestAnimationFrame = originalRaf; }

    for (const [Runner, gpuMode, is03] of [[BenchmarkRunner, 'gpu-driven', false], [GPUSceneBenchmarkRunner, 'gpu-scene', true]] as const) {
      const runner = Object.create(Runner.prototype);
      const { PerspectiveCamera } = await import('three');
      let gl = 0, gpu = 0;
      const sample = () => ({ submitMs: 1, cpuFrameMs: 1, fps: null, drawCalls: 1 });
      Object.assign(runner, {
        camera: new PerspectiveCamera(), currentConfig: { dynamicRatio: 0, objectCount: 1 },
        currentCount: 1, frameCount: 0, lastTick: null, lastFrameTime: 0,
        canRender: () => true, measurement: sample(), emptyMeasurement: sample(),
        classicRenderer: {}, classicScene: { camera: new PerspectiveCamera(),
          updateDynamicObjects() {}, render: () => { gl++; return sample(); },
          renderFrame: () => { gl++; return sample(); } },
      });
      runner[is03 ? 'gpuSceneRenderer' : 'gpuDrivenRenderer'] = {
        updateCamera() {}, updateDynamicObjects() {},
        render: () => { gpu++; return sample(); }, renderFrame: () => { gpu++; return sample(); },
      };
      for (const mode of ['classic', gpuMode]) {
        runner.setMode(mode); // No canvas DOM is supplied: setMode must only publish state.
        gl = gpu = 0;
        runner.renderTick(100);
        assert.equal(gl, mode === 'classic' ? 1 : 0);
        assert.equal(gpu, mode === 'classic' ? 0 : 1);
        runner.isBenchmarking = true;
        assert.equal(runner.renderTick(116), null);
        assert.equal(gl + gpu, 1);
        runner.isBenchmarking = false;
        runner.canRender = () => false;
        assert.equal(runner.renderTick(132), null);
        assert.equal(gl + gpu, 1);
        if (is03) assert.throws(() => runner.renderFrame(148), { name: 'AbortError' });
        runner.canRender = () => true;
      }
      runner.device = { features: new Set(), queue: { onSubmittedWorkDone: async () => {} } };
      runner.setupTier = async () => {};
      runner.applyConfig = async () => {};
      runner.chart = { render() {} };
      runner.gpuSceneRenderer && Object.assign(runner.gpuSceneRenderer, {
        readCullingCounters: async () => null, getSceneBufferBytes: () => 0,
      });
      runner.onModeChange = (mode: string) => {
        const visible = canvasVisibility(is03 ? '03-gpu-scene' : '01-indirect-draw', mode);
        assert.equal(Number(visible.showWebgl) + Number(visible.showWebgpu), 1);
      };
      const originalRaf = globalThis.requestAnimationFrame;
      let scheduled = 0;
      globalThis.requestAnimationFrame = (callback) => {
        queueMicrotask(() => {
          const before = gl + gpu;
          assert.equal(runner.renderTick(200), null);
          assert.equal(gl + gpu, before, 'preview must not submit during a campaign');
          callback(200);
        });
        return ++scheduled;
      };
      try {
        gl = gpu = 0;
        if (is03) await runner.runCampaign([runner.currentConfig]);
        else await runner.runAutomatedBenchmark([1]);
        assert.equal(gl, is03 ? 40 : 188);
        assert.equal(gpu, is03 ? 40 : 188);
        assert.equal(scheduled, gl + gpu, 'one submission per scheduled measurement frame');
        runner.canRender = () => false;
        const before = gl + gpu;
        await assert.rejects(is03 ? runner.runCampaign([runner.currentConfig]) : runner.runAutomatedBenchmark([1]), { name: 'AbortError' });
        assert.equal(gl + gpu, before);
        assert.equal(runner.isBenchmarking, false);
      } finally { globalThis.requestAnimationFrame = originalRaf; }
    }
  } finally { await server.close(); }
});
