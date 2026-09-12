import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('03 standard campaign keeps the complete 4D matrix and twelve A/B chart points', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { GPUSceneBenchmarkRunner, FULL_MATRIX } = await server.ssrLoadModule('/03-gpu-scene/runner/index.ts');
    assert.equal(FULL_MATRIX.length, 12);
    assert.deepEqual([...new Set(FULL_MATRIX.map((scenario: { dimension: string }) => scenario.dimension))], ['A-geometry', 'B-material', 'C-dynamic']);
    const runner = Object.create(GPUSceneBenchmarkRunner.prototype);
    let received: unknown[] = [];
    runner.runCampaign = async (scenarios: unknown[], label: string) => { received = scenarios; assert.equal(label, 'Campagne 4D achevée'); return []; };
    await runner.runFullMatrix();
    assert.equal(received, FULL_MATRIX);

    const { GPUSceneChart } = await server.ssrLoadModule('/03-gpu-scene/runner/chart.ts');
    const canvas = { width: 0, height: 0, dataset: {} as Record<string, string>, getContext: () => null, getBoundingClientRect: () => ({ width: 380, height: 176 }) };
    const chart = new GPUSceneChart(canvas);
    const results = FULL_MATRIX.flatMap((config: unknown) => [
      { mode: 'classic', config, avgCpuSubmitMs: 1 },
      { mode: 'gpu-scene', config, avgCpuSubmitMs: 0.5 },
    ]);
    chart.render(results);
    assert.equal(canvas.dataset.chartLabels.split('|').length, 12);

    const { formatGpuSceneReport } = await server.ssrLoadModule('/03-gpu-scene/runner/reporter.ts');
    const markdown = formatGpuSceneReport(results.map((result: Record<string, unknown>) => ({ ...result, avgCpuFrameMs: 1, drawCalls: 1, culledObjects: null, visibleObjects: null, gpuMemoryBytes: null })), 'test', '2026-09-12T10:00:00.000Z');
    assert.equal((markdown.match(/^\| Dim [ABC]/gm) ?? []).length, 24, 'twelve scenarios must remain distinct in both report tables');

    const source = await import('node:fs/promises').then(fs => fs.readFile('src/lab/bootLab.ts', 'utf8'));
    assert.match(source, /runner\.runFullMatrix\(\)/);
    assert.match(source, /moduleId === '03-gpu-scene'[\s\S]*?chart02\?\.reset\(\)[\s\S]*?runner\.runFullMatrix\(\)/);
    assert.doesNotMatch(source, /runner\.runCampaign\(\[preset\]/);
  } finally { await server.close(); }
});
