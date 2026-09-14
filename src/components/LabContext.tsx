import type { ModelView, IntegrationScene } from '../lab/modelView.ts';
import { createContext, useContext, type ReactNode } from 'react';
import type { LabActions, LabSnapshot } from '../lab/labState.ts';

export type LabContextValue = {
  state: LabSnapshot;
  actions: LabActions;
  model?: ModelView;
  panels?: { configuration: ReactNode; metrics: ReactNode };
  onIntegrationScene?: (scene: IntegrationScene) => void;
};

export const LabContext = createContext<LabContextValue | null>(null);

export function useLab(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error('useLab must be used inside LabProvider');
  return value;
}
