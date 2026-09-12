import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('the React selector exclusively owns navigation away from bench 14', async () => {
  const worldSource = await readFile(new URL('../14-open-world/implementation/worldPage.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(worldSource, /on\(moduleSelect,\s*['"]change['"]/);
  assert.doesNotMatch(worldSource, /moduleSelect\.addEventListener\(\s*['"]change['"]/);

  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const originalWindow = globalThis.window;
  const destinations: string[] = [];
  globalThis.window = {
    history: { pushState: (_state: unknown, _unused: string, url: string | URL) => destinations.push(String(url)) },
    location: { href: 'http://localhost/?test=14-open-world', reload() {} },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;
  const originalCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class<T> extends Event { detail: T; constructor(type: string, init: CustomEventInit<T>) { super(type); this.detail = init.detail as T; } } as unknown as typeof CustomEvent;
  try {
    const { navigateFromNativeBench } = await server.ssrLoadModule('/src/lab/navigation.ts');
    let reloads = 0;
    const originalReload = window.location.reload;
    Object.defineProperty(window.location, 'reload', { configurable: true, value: () => { reloads += 1; } });
    navigateFromNativeBench('02-gpu-frustum-culling');
    navigateFromNativeBench('00-baseline');
    assert.equal(reloads, 0);
    Object.defineProperty(window.location, 'reload', { configurable: true, value: originalReload });
    assert.deepEqual(destinations, ['http://localhost/?test=02-gpu-frustum-culling', 'http://localhost/?test=00-baseline']);
    assert.ok(destinations.every(url => !url.endsWith('/?test=14-open-world')));
  } finally {
    globalThis.CustomEvent = originalCustomEvent;
    globalThis.window = originalWindow;
    await server.close();
  }
});
