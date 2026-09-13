import { defaultModelConfig } from '../lab/modelCampaign.ts';
import { useLab } from './LabContext.tsx';

export function useModelPanel() {
  const ctx = useLab();
  const view = ctx.model;
  const config = view?.config ?? defaultModelConfig;
  return { ...ctx, view, config };
}
