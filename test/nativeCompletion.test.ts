import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('native page preserves checked image and final measurements, supports restart and explicit stop', async () => {
  const nodes = new Map<string, FakeNode>();
  class FakeNode {
    textContent = ''; className = 'absolute inset-0 w-full h-full'; style: Record<string, string> = {};
    disabled = false; value = ''; selected = false; width = 0; height = 0; image: unknown = null;
    options: FakeNode[] = []; onclick?: () => unknown; onchange?: () => void;
    classList = { add() {}, remove() {}, toggle() {} };
    private identifier = '';
    get id() { return this.identifier; } set id(value: string) { this.identifier = value; nodes.set(value, this); }
    get parentElement() { return new FakeNode(); } get firstElementChild() { return new FakeNode(); }
    get children() { return [new FakeNode(), new FakeNode()]; }
    querySelectorAll() { return []; }
    addEventListener() {}
    querySelector() { return new FakeNode(); }
    append(...children: unknown[]) { for (const child of children) if (child instanceof FakeNode) { this.options.push(child); if (child.selected) this.value = child.value; } }
    replaceChildren(...children: unknown[]) { this.options = []; this.append(...children); }
    before() {} after() {} prepend() {} remove() {} setAttribute() {} showModal() {}
    getBoundingClientRect() { return { width: 360, height: 176 }; }
    drawnText: string[] = [];
    getContext() { return new Proxy({ putImageData: (image: unknown) => { this.image = image; }, fillText: (value: string) => { this.drawnText.push(value); } }, { get: (target, key) => key in target ? Reflect.get(target, key) : key === 'measureText' ? () => ({ width: 40 }) : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} }); }
    click() { return this.onclick?.(); }
  }
  const originals = new Map<string, unknown>();
  const set = (key: string, value: unknown) => { originals.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, value); };
  set('document', { getElementById: (id: string) => { if (!nodes.has(id)) { const node = new FakeNode(); node.id = id; } return nodes.get(id); }, createElement: () => new FakeNode() });
  set('window', { location: { search: '?repeats=1' }, addEventListener() {} });
  set('Option', class extends FakeNode { constructor(text: string, value: string, _default: boolean, selected: boolean) { super(); this.textContent = text; this.value = value; this.selected = selected; } });
  set('PointerEvent', class {});
  set('cancelAnimationFrame', () => {});
  set('fetch', async (url: string) => ({ ok: true, json: async () => url.includes('history') ? { runs: [] } : url.includes('meta') ? { sourceHashes: {} } : { jsonUrl: '/saved' } }));
  let stopNext = false, runs = 0, stopCurrent = () => {}, releaseFirst = () => {};
  const checkedImage = { width: 1920, height: 1080, data: new Uint8ClampedArray([1, 2, 3, 255]) };
  const updates: Array<Record<string, any>> = [];
  set('__nativeComparisonTest', async (_canvas: unknown, config: unknown, progress: (s: string) => void, signal: AbortSignal, metrics: (m: unknown) => void, finalImage: (m: unknown) => void) => {
    runs++;
    progress('Bloc 4/4 · Mesure');
    metrics({ variant: 'cpu', phase: 'measure', fps: 120, cpuRenderSubmitMs: 0.15, cpuFrameWorkMs: 0.35, cpuSelectMs: 0.1, gpuSelectMs: null });
    assert.equal(nodes.get('stat-fps')!.textContent, '120.0 FPS');
    assert.equal(nodes.get('native-selection-value')!.textContent, 'CPU · 0.10 ms');
    assert.equal(updates.at(-1)!.stats.fps, '120.0 FPS');
    progress('Bloc 2/4 · B · Calcul WGSL · 120 images mesurées.');
    metrics({ variant: 'gpu', phase: 'measure', fps: 118, cpuRenderSubmitMs: 0.12, cpuFrameWorkMs: 0.31, cpuSelectMs: null, gpuSelectMs: null });
    assert.equal(nodes.get('stat-mode')!.textContent, 'B · Calcul GPU · measure');
    assert.equal(nodes.get('native-selection-value')!.textContent, 'GPU · Non mesuré');
    assert.match(nodes.get('native-gpu-value')!.textContent, /Non mesurée/);
    if (runs === 1) await new Promise<void>(resolve => { releaseFirst = resolve; });
    if (stopNext) stopCurrent();
    else finalImage(checkedImage);
    return { timestamp: new Date().toISOString(), config, status: signal.aborted ? 'aborted' : 'completed', blocks: [
      { variant: 'cpu', completed: true, samples: [{ drawCalls: 3 }], summary: { cpuRenderSubmitMs: { mean: 0.16 }, cpuFrameWorkMs: { mean: 0.36 } }, cadence: { fps: 119.5 } },
      { variant: 'gpu', completed: true, samples: [{ drawCalls: 3, mainPassTriangles: null }], summary: { cpuRenderSubmitMs: { mean: 0.13 }, cpuFrameWorkMs: { mean: 0.32 }, gpuSelectMs: { mean: 0.08 } }, cadence: { fps: 117.5 } },
    ] };
  });
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', plugins: [{
    name: 'native-comparison-test', enforce: 'pre',
    load(id) { if (id.endsWith('/runner/nativeComparison.ts')) return 'export const runNativeComparison = (...args) => globalThis.__nativeComparisonTest(...args); export const formatNativeReport = () => "Measured report";'; },
  }] });
  try {
    const { mountNativeLodWorkbench } = await server.ssrLoadModule('/04-gpu-lod/runner/nativePage.ts');
    const controller = mountNativeLodWorkbench((s: string) => s, (update: Record<string, any>) => updates.push(update));
    stopCurrent = controller.stop;
    const firstCampaign = controller.run();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(runs, 1, 'one React action starts exactly one native comparison');
    assert.equal(updates.some(update => update.running === true), true, 'running is visible before completion');
    assert.doesNotMatch(nodes.get('canvas-chart')!.drawnText.at(-1) ?? '', /Prêt pour la campagne/, 'running chart cannot retain the ready placeholder');
    assert.match([...updates].reverse().find((update: Record<string, any>) => update.benchStatus)?.benchStatus ?? '', /Bloc [1-4]\/4|Préparation/);
    const modes = updates.filter(update => update.mode).map(update => update.mode);
    assert.ok(modes.indexOf('classic') < modes.lastIndexOf('gpu-driven'), 'the disabled A/B control follows CPU then WGSL blocks');
    releaseFirst();
    await firstCampaign;
    assert.equal(nodes.get('stat-mode')!.textContent, 'Campagne terminée');
    assert.equal(nodes.get('stat-fps')!.textContent, '117.5 FPS');
    assert.equal(nodes.get('stat-submit')!.textContent, '0.13 ms');
    assert.equal(nodes.get('native-selection-value')!.textContent, 'GPU · 0.08 ms');
    assert.equal(nodes.get('native-final-image')!.image, checkedImage);
    assert.equal(nodes.get('native-final-image')!.style.display, '');
    assert.equal(nodes.get('canvas-webgpu')!.style.display, 'none');
    assert.equal(nodes.get('native-final-image')!.style.objectFit, 'cover');
    assert.equal(nodes.get('btn-benchmark')!.disabled, false);
    assert.equal(updates.at(-1)!.execution.status, 'completed');
    stopNext = true;
    await controller.run();
    assert.equal(runs, 2);
    assert.match(nodes.get('stat-mode')!.textContent, /Arrêt manuel/);
    assert.equal(nodes.get('stat-fps')!.textContent, '117.5 FPS');
    assert.equal(nodes.get('btn-benchmark')!.disabled, false);
    assert.equal(updates.at(-1)!.execution.status, 'stopped');
    controller.dispose();
    assert.equal((globalThis.window as unknown as { __renderTechLabNative?: unknown }).__renderTechLabNative, undefined);
  } finally {
    await server.close();
    for (const [key, value] of originals) Reflect.set(globalThis, key, value);
  }
});

test('the 04 mode switch is presented as preview-only', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/components/LabSidebar.tsx', import.meta.url), 'utf8'));
  const ui = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/lab/moduleUi.ts', import.meta.url), 'utf8'));
  assert.match(ui, /Aperçu uniquement — la comparaison complète se lance avec le bouton ci-dessous\./);
  assert.match(source, /onChange=\{actions\.setMode\}/);
  assert.match(ui, /id:\s*'btn-classic',\s*value:\s*'classic'/);
  assert.match(ui, /id:\s*'btn-gpu-driven',\s*value:\s*'gpu-driven'/);
  assert.match(source, /disabled=\{state\.running\}/);
});

test('the 04 idle view cannot initialize a renderer or own a RAF loop before the CTA', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../04-gpu-lod/runner/nativePage.ts', import.meta.url), 'utf8'));
  assert.doesNotMatch(source, /NativeLodRenderer|requestAnimationFrame|cancelAnimationFrame/);
  assert.match(source, /Prêt · aucun moteur initialisé/);
  assert.match(source, /function selectMode/);
  assert.match(source, /run: runCampaign/);
});
