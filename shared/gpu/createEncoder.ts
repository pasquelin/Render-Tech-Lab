/**
 * shared/gpu/createEncoder.ts
 *
 * Primitives minimales de commande WebGPU exposées aux bancs.
 * `createCommandEncoder` est un wrapper sur `device.commandEncoder` : il centralise
 * un point d'accès unique pour faciliter l'instrumentation / la revue, sans ajouter
 * de sémantique propriétaire.
 */

export function createCommandEncoder(
  device: GPUDevice,
  label?: string
): GPUCommandEncoder {
  return device.createCommandEncoder({ label });
}

/**
 * Configure le contexte canvas d'un banc sur le device fourni.
 * Équivalent minimal de `configureCanvas` de `src/common/gpuContext.ts` :
 * exposé ici pour que `shared/gpu` soit autonome dans l'API publique.
 */
export function createCanvasContext(
  canvas: HTMLCanvasElement,
  device: GPUDevice
): { context: GPUCanvasContext; format: GPUTextureFormat } {
  const nav = navigator as Navigator & { gpu?: GPU };
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = nav?.gpu?.getPreferredCanvasFormat() ?? 'bgra8unorm';
  context.configure({ device, format, alphaMode: 'opaque' });
  return { context, format };
}
