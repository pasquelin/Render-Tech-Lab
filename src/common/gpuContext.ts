import * as THREE from 'three';

/**
 * Ressources GPU partagées par tous les modules du banc.
 *
 * Un canvas ne possède qu'un seul contexte : si deux modules créent chacun leur
 * `GPUDevice` ou leur `WebGLRenderer` sur les mêmes canvas, le second reconfigure
 * le contexte du premier et casse le module d'origine dès qu'on y revient.
 * Tout passe donc par ces accesseurs, qui n'initialisent qu'une fois.
 */

/** Features demandées si l'adaptateur les expose. */
const OPTIONAL_FEATURES: GPUFeatureName[] = ['indirect-first-instance'];

let devicePromise: Promise<GPUDevice | null> | null = null;
let sharedDevice: GPUDevice | null = null;
let sharedGLRenderer: THREE.WebGLRenderer | null = null;

/**
 * Device WebGPU unique du banc. Les features optionnelles réellement obtenues
 * se lisent ensuite via `device.features.has(...)`.
 */
export function getSharedDevice(): Promise<GPUDevice | null> {
  if (!devicePromise) {
    devicePromise = requestDevice();
  }
  return devicePromise;
}

async function requestDevice(): Promise<GPUDevice | null> {
  const nav = navigator as Navigator & { gpu?: GPU };
  if (!nav.gpu) return null;

  try {
    const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;

    const requiredFeatures = OPTIONAL_FEATURES.filter((f) => adapter.features.has(f));
    for (const f of OPTIONAL_FEATURES) {
      if (!requiredFeatures.includes(f)) {
        console.warn(`[banc] Feature WebGPU absente sur cet adaptateur : ${f}`);
      }
    }

    sharedDevice = await adapter.requestDevice({ requiredFeatures });
    return sharedDevice;
  } catch (err) {
    console.warn('[banc] requestDevice a échoué :', err);
    return null;
  }
}

/** Device déjà résolu, ou null tant que `getSharedDevice()` n'a pas abouti. */
export function peekSharedDevice(): GPUDevice | null {
  return sharedDevice;
}

/** Contexte WebGPU du canvas, configuré une seule fois sur le device partagé. */
export function configureCanvas(
  canvas: HTMLCanvasElement,
  device: GPUDevice
): { context: GPUCanvasContext; format: GPUTextureFormat } {
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  return { context, format };
}

/** Renderer Three.js unique pour le canvas WebGL du Test A. */
export function getSharedGLRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  if (!sharedGLRenderer) {
    sharedGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    sharedGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  return sharedGLRenderer;
}
