import { defaultEmeraldConfig } from '../lab/emeraldCampaign.ts';
import { useLab } from './LabContext.tsx';

export function useEmeraldPanel() {
  const ctx = useLab();
  const view = ctx.emerald;
  const config = view?.config ?? defaultEmeraldConfig;
  return { ...ctx, view, config };
}
