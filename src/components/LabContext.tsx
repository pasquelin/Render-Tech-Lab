import type { EmeraldView, IntegrationScene } from '../lab/emeraldView.ts';
import { createContext, useContext } from 'react';
import type { LabActions, LabSnapshot } from '../lab/labState.ts';

export type LabContextValue = {
  state: LabSnapshot;
  actions: LabActions;
  emerald?: EmeraldView;
  onIntegrationScene?: (scene: IntegrationScene) => void;
};

export const LabContext = createContext<LabContextValue | null>(null);

export function useLab(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error('useLab must be used inside LabProvider');
  return value;
}
