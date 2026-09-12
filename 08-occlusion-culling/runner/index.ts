import { createIntegratedRunner } from '../../shared/benchmark/integratedRunners.ts';

export const createOcclusionCullingRunner = () => createIntegratedRunner('08-occlusion-culling');
