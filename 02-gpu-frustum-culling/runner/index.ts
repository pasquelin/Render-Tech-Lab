import { createIntegratedRunner } from '../../shared/benchmark/integratedRunners.ts';

export const createFrustumCullingRunner = () => createIntegratedRunner('02-gpu-frustum-culling');
