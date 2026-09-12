import { createIntegratedRunner } from '../../shared/benchmark/integratedRunners.ts';

export const createMaterialBatchingRunner = () => createIntegratedRunner('10-material-batching');
