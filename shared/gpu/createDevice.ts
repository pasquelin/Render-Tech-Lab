/**
 * shared/gpu/createDevice.ts
 *
 * Développe le device WebGPU partagé. Réutilise le single-device déjà établi dans
 * `src/common/gpuContext.ts` (le banc a un seul device ; créer un second device sur
 * les mêmes canvas casserait le module d'origine). Ajoute ici la sémantique de
 * contexte (status, label d'adaptateur, features) attendue par le Master Test Plan.
 */

import { getSharedDevice, getAdapterInfo } from '../../src/common/gpuContext.ts';
import type { GPUContext } from './types.ts';

export { getSharedDevice };

/**
 * Produit le contexte WebGPU canonique du banc :
 *  - status `ready` si un device a été obtenu,
 *  - status `unavailable` sinon (aucune hypothèque : la mesure devient « not-run »).
 */
export async function createGPUContext(): Promise<GPUContext> {
  const device = await getSharedDevice();

  if (!device) {
    return {
      device: null,
      status: 'unavailable',
      info: { adapterLabel: null, features: [] },
    };
  }

  const adapterInfo = getAdapterInfo();

  return {
    device,
    status: 'ready',
    info: {
      adapterLabel: adapterInfo?.description || null,
      features: Array.from(device.features),
    },
  };
}
