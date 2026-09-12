import { memo } from 'react';
import type { LabStats as LabStatsState } from '../lab/labState.ts';
import { StatsGrid } from './ui/StatsGrid.tsx';

type PrimaryStats = Pick<LabStatsState, 'submit' | 'cpuFrame' | 'fps' | 'drawCalls'>;

type LabStatsProps = {
  stats: PrimaryStats;
  provenance?: string;
};

const missing = /^(?:--(?:\s+(?:ms|FPS))?|non mesur(?:é|és))$/i;
const display = (value: string) => missing.test(value.trim()) ? 'Non mesuré' : value;

export const LabStats = memo(function LabStats({ stats, provenance }: LabStatsProps) {
  const metrics = [
    { id: 'stat-submit', label: 'CPU submit', value: stats.submit, help: 'Encodage commandes' },
    { id: 'stat-cpuframe', label: 'CPU frame', value: stats.cpuFrame, help: 'Boucle JS totale' },
    { id: 'stat-fps', label: 'FPS', value: stats.fps, help: 'Images / seconde' },
    { id: 'stat-drawcalls', label: 'Draw calls', value: stats.drawCalls, help: 'Appels soumission' },
  ];
  return (
    <>
      <StatsGrid items={metrics.map((metric, index) => ({ ...metric, value: display(metric.value), primary: index === 0 }))} />
      {provenance ? <p className="text-[10px] text-base-content/50">Provenance FPS : {provenance}</p> : null}
    </>
  );
});
