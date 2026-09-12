import { createIntegratedRunner } from '../../shared/benchmark/integratedRunners.ts';

export const createGpuCompactionRunner = () => createIntegratedRunner('09-gpu-compaction');
