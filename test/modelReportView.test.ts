import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('each camera viewpoint reserves one column for every engine capture', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { captureGridColumns } = await server.ssrLoadModule('/src/components/ModelReportView.tsx');
    assert.equal(captureGridColumns(1), 'grid-cols-1');
    assert.equal(captureGridColumns(2), 'grid-cols-1 sm:grid-cols-2');
    assert.equal(captureGridColumns(3), 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3');
    assert.equal(captureGridColumns(4), 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4');
  } finally { await server.close(); }
});
