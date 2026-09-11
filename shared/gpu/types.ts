/**
 * shared/gpu/types.ts
 *
 * Types communs du contexte WebGPU partagé par tous les bancs du laboratoire.
 * Rôle minimal : décrire le device/contexte/encoder sans introduire de framework.
 */

export type GPUStatus = 'ready' | 'unavailable';

export interface GPUContextInfo {
  adapterLabel: string | null;
  features: string[];
}

/**
 * Ensemble des primitives GPU produites par `createGPUContext`.
 * `device` est `null` si WebGPU n'est pas disponible ; les bancs doivent alors
 * se mettre en mode `not-run` et ne jamais inventer de mesure.
 */
export interface GPUContext {
  device: GPUDevice | null;
  status: GPUStatus;
  info: GPUContextInfo;
}
