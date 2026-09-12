export const LAB_CONTRACT_VERSION = 1 as const;

export type LabProgressPhase = 'prepare' | 'warmup' | 'measure' | 'verify' | 'complete';
export interface LabRunnerOptions { samples?: number; warmup?: number; signal?: AbortSignal; scenario?: string }
export interface LabMetric { variant: string; cpuMs: number | null; gpuMs: number | null; custom: Record<string, number | string | boolean | null> }
export interface LabCampaign { contractVersion: typeof LAB_CONTRACT_VERSION; test: string; status: 'measured' | 'not-run'; records: LabMetric[] }
export interface LabManifest { contractVersion: typeof LAB_CONTRACT_VERSION; id: string; number: string; title: string; publicEntry: string; description: string; capabilities: readonly string[]; scenarios: readonly { id: string; title: string; disabled: boolean }[]; status: 'experimental' | 'blocked' }
