export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'stopped' | 'error';
export type CampaignSummary = {
  timestamp: string;
  status: string;
  configuration: string;
  series: { label: string; values: number[]; unit: string }[];
  scenarioChecks?: { id: string; label: string; a: number; b: number; quality: string }[];
};
export type ExecutionState = {
  status: ExecutionStatus;
  phase: string;
  lastCampaign: CampaignSummary | null;
  measurementCompletedAt?: string;
  presentationEndsAt?: string;
};
export type ProgressItemType = 'modèles' | 'meshes' | 'textures' | 'shaders' | 'buffers' | 'scène' | 'calcul';
export type LabProgress = {
  phase: string;
  itemType: ProgressItemType;
  itemName?: string;
  completed?: number;
  total?: number;
  bytesLoaded?: number;
  bytesTotal?: number;
  message: string;
  details?: { label: string; value: string; ratio?: number }[];
};
export const idleExecution = (): ExecutionState => ({ status: 'idle', phase: '', lastCampaign: null });
export const executionSteps = ['Préparer', 'Contrôler', 'Échauffer', 'Mesurer A/B', 'Archiver'];
export function executionStep(execution: ExecutionState): number | null {
  if (execution.status !== 'running') return null;
  const phase = execution.phase.toLowerCase();
  if (/archiv|sauvegard/.test(phase)) return 4;
  if (/chauff|warmup/.test(phase)) return 2;
  if (/mesur|measure|bloc/.test(phase)) return 3;
  if (/contrô|control|valid/.test(phase)) return 1;
  return 0;
}
