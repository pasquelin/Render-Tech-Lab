import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { PerspectiveCamera } from 'three';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('normal and pain campaigns publish measured telemetry and persistent chart curves in the sidebar', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const originalWindow = globalThis.window;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const originalObserver = globalThis.ResizeObserver;
  const observers: (() => void)[] = [];
  class Observer { constructor(callback: () => void) { observers.push(callback); } observe() {} disconnect() {} }
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  globalThis.window = { ResizeObserver: Observer, devicePixelRatio: 2, removeEventListener() {} } as unknown as Window & typeof globalThis;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const { LabSession } = await server.ssrLoadModule('/src/lab/bootLab.ts');
    const { BenchmarkRunner } = await server.ssrLoadModule('/01-indirect-draw/runner/index.ts');
    const { CrossoverChart } = await server.ssrLoadModule('/01-indirect-draw/runner/chart.ts');
    const { GenericLabChart } = await server.ssrLoadModule('/src/lab/GenericLabChart.ts');
    const { LabSidebar } = await server.ssrLoadModule('/src/components/LabSidebar.tsx');
    const { LabContext } = await server.ssrLoadModule('/src/components/LabContext.tsx');
    const { LabNavbar } = await server.ssrLoadModule('/src/components/LabNavbar.tsx');
    const { MODULE_DESCRIPTORS } = await server.ssrLoadModule('/src/lab/modules.ts');
    const headerSession = new LabSession({});
    for (const moduleId of ['01-indirect-draw', '03-gpu-scene', '14-open-world', '01-indirect-draw']) {
      headerSession.patch({ moduleId });
      const header = renderToStaticMarkup(createElement(LabContext.Provider,
        { value: { state: headerSession.state, actions: headerSession.actions } }, createElement(LabNavbar)));
      assert.match(header, /id="nav-module-description"/);
      assert.ok(header.indexOf('nav-module-description') > header.indexOf('select-module'));
      assert.match(header, /truncate whitespace-nowrap/);
      assert.match(header, /min-w-0[^"]*overflow-hidden/);
      if (moduleId === '14-open-world') assert.match(header, /Three.js WebGL2 résident/);
      else {
        const escaped = renderToStaticMarkup(createElement('p', {}, MODULE_DESCRIPTORS[moduleId].description)).slice(3, -4);
        assert.ok(header.includes(escaped), 'full description must follow the current module');
      }
    }
    for (const action of ['runBenchmark', 'runPain']) {
      let live = true;
      let time = 0, submissions = 0, points = 0, paints = 0;
      const clock = mock.method(performance, 'now', () => time);
      const ctx = new Proxy({}, { get: (_target, key) => {
        if (key === 'measureText') return () => ({ width: 50 });
        if (key === 'arc') return (_x: number, _y: number, radius: number) => { if (radius === 4) points++; };
        if (key === 'clearRect') return () => { paints++; };
        return () => {};
      }, set: () => true });
      const canvas = { width: 300, height: 150, getContext: () => ctx,
        getBoundingClientRect: () => ({ width: 380, height: 176 }) };
      const chart = new CrossoverChart(canvas);
      const session = new LabSession({ chart: canvas });
      session.patch({ moduleId: '01-indirect-draw', scenarioVal: '500' });
      const generic = new GenericLabChart(canvas);
      session.genericChart = generic;
      const runner = Object.create(BenchmarkRunner.prototype);
      const frame = () => { submissions++; return { frameIndex: 0, triangles: 12,
        submitMs: 2, cpuFrameMs: 4, drawCalls: 10, fps: null }; };
      Object.assign(runner, { device: { features: new Set(), queue: { onSubmittedWorkDone: async () => {} } },
        classicRenderer: {}, classicScene: { renderFrame: frame }, gpuDrivenRenderer: { renderFrame: frame },
        camera: new PerspectiveCamera(), chart, canRender: () => !session.disposed,
        setupTier: async () => {}, currentMode: 'gpu-driven', isBenchmarking: false });
      session.runner01 = runner;
      let metricEvents = 0, validFps = 0, previousProgress = 0;
      const phases = new Set<string>();
      const assertSidebar = () => {
        if (!session.state.running && !session.state.showChart) return;
        const html = renderToStaticMarkup(createElement(LabContext.Provider,
          { value: { state: session.state, actions: session.actions } },
          createElement(LabSidebar, { chartRef: { current: canvas } })));
        assert.match(html, /<canvas id="canvas-chart"/);
        assert.doesNotMatch(html, /relative hidden"><canvas id="canvas-chart"/);
      };
      runner.onModeChange = (mode: string) => session.publishRunnerMode('01-indirect-draw', mode);
      runner.onMetricsUpdate = (measurement: { fps: number | null; submitMs: number; cpuFrameMs: number; drawCalls: number }, _mode: string, count: number) => {
        if (!live || !runner.isBenchmarking) return;
        metricEvents++;
        if (measurement.fps !== null) { assert.ok(Math.abs(measurement.fps - 60) < 0.001); validFps++; }
        session.handleMetrics(measurement.submitMs, measurement.cpuFrameMs, measurement.fps, measurement.drawCalls, count, true);
        assert.equal(session.state.stats.submit, '2.0 ms');
        assert.equal(session.state.stats.cpuFrame, '4.0 ms');
        assertSidebar();
      };
      runner.onBenchmarkProgress = (phase: string, progress: number) => {
        phases.add(phase);
        assert.ok(progress >= previousProgress);
        previousProgress = progress;
        session.setBenchStatus(phase);
      };
      globalThis.requestAnimationFrame = (callback) => {
        queueMicrotask(() => {
          if (!live) return;
          time += 1000 / 60;
          if (runner.isBenchmarking) {
            const before = submissions;
            assert.equal(runner.renderTick(time), null);
            assert.equal(submissions, before);
          }
          if (!live) return;
          callback(time);
        });
        return 1;
      };
      try {
        let finishArchive!: () => void;
        let archiveStarted!: () => void;
        const archiving = new Promise<void>(resolve => { archiveStarted = resolve; });
        runner.onBenchmarkComplete = async () => {
          archiveStarted();
          await new Promise<void>(resolve => { finishArchive = resolve; });
        };
        const campaign = session[action]();
        await archiving;
        assert.equal(session.state.running, true, 'controls stay locked through asynchronous archival');
        const submittedBeforeRetry = submissions;
        await session[action]();
        assert.equal(submissions, submittedBeforeRetry);
        finishArchive();
        await campaign;
        assert.equal(session.state.running, false);
        const tiers = action === 'runBenchmark' ? 4 : 8;
        assert.ok(submissions >= tiers * 2 * 188 && submissions <= tiers * 2 * 188 + 2, `submissions ${submissions}`);
        assert.ok(metricEvents > tiers * 2 && validFps > 0);
        assert.equal(session.state.stats.fps, '60 FPS');
        assert.ok([...phases].some(phase => phase.includes('Préchauffage 60/60')));
        assert.ok([...phases].some(phase => phase.includes('Mesure 128/128')));
        assert.equal(previousProgress, 1);
        assert.equal(chart.lastClassic.length, tiers);
        assert.equal(chart.lastGpuDriven.length, tiers);
        assert.ok(chart.lastClassic.every((result: { avgFps: number | null; gpuFrameMs: number | null }) => result.avgFps !== null && result.gpuFrameMs === null));
        assert.ok(points > 0);
        assert.ok(paints >= tiers * 2 + 1, 'curves update progressively, before completion');
        assertSidebar();
        const before = paints;
        for (const resize of observers) resize();
        assert.ok(paints > before, 'active chart redraws measured curves after resize');
        live = false;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        session.dispose();
        runner.onMetricsUpdate = undefined;
        runner.onBenchmarkProgress = undefined;
        const afterDispose = paints;
        for (const resize of observers) resize();
        assert.equal(paints, afterDispose, 'disposed session cannot overwrite the next React chart');
      } finally { clock.mock.restore(); }
    }
  } finally {
    globalThis.window = originalWindow;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
    globalThis.ResizeObserver = originalObserver;
    await server.close();
  }
});
