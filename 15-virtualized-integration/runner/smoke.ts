import { createVirtualizedIntegrationRunner } from './index.ts';

declare global { interface Window { integrationSmoke: (fallback?: boolean, cancelAt?: 'verify' | 'measure') => Promise<unknown> } }
window.integrationSmoke = async (fallback = false, cancelAt) => {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter || adapter.info.isFallbackAdapter) return createVirtualizedIntegrationRunner().run();
  const device = await adapter.requestDevice({ requiredFeatures: !fallback && adapter.features.has('timestamp-query') ? ['timestamp-query'] : [] });
  const errors: string[] = [];
  const listener = (event: GPUUncapturedErrorEvent) => errors.push(event.error.message);
  device.addEventListener('uncapturederror', listener);
  const canvas = document.querySelector('canvas')!, controller = new AbortController();
  const initialSize = [canvas.width, canvas.height];
  try {
    const runner = createVirtualizedIntegrationRunner();
    const result = await runner.run({ device, canvas, samples: 4, warmup: 1, signal: controller.signal,
      onPhase: event => { if (event.phase === cancelAt) controller.abort(); } });
    if (canvas.width !== initialSize[0] || canvas.height !== initialSize[1]) throw new Error('Canvas size ownership not restored');
    if (cancelAt && (result.status !== 'not-run' || result.records.length)) throw new Error('Cancellation published measurements');
    await device.queue.onSubmittedWorkDone();
    if (errors.length) throw new Error(errors.join('\n'));
    return result;
  } finally { device.removeEventListener('uncapturederror', listener); device.destroy(); }
};
