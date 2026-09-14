import type { ReactNode } from 'react';
import { BenchScreen } from './BenchScreen.tsx';
import { MetricGrid, type MetricData } from './ui/MetricGrid.tsx';

export type BenchStartProps = {
  title: string;
  description: string;
  question: string;
  protocol: string;
  steps: readonly string[];
  stepLabel?: string;
  notes?: ReactNode;
  metadata?: MetricData[];
  controls?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  notice?: ReactNode;
  actions: ReactNode;
};

export function BenchStart({
  title, description, question, protocol, steps,
  stepLabel = 'Étapes du test',
  notes, metadata, controls, summary, children, notice, actions,
}: BenchStartProps) {
  return <BenchScreen screen="start" view="idle" statusLabel="Aucun test en cours" title={title}>
    <p className="text-sm leading-relaxed text-base-content/80">{description}</p>
    <p className="text-xs text-base-content/65">Question du banc : {question}</p>
    <p className="text-xs font-mono">{protocol}</p>
    {notes}
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-mono text-base-content/50" aria-label={stepLabel}>
      {steps.map(label => <li key={label}>{label}</li>)}
    </ol>
    {summary}
    {controls ?? (metadata?.length ? <MetricGrid items={metadata} /> : null)}
    {children}
    {notice}
    {actions}
  </BenchScreen>;
}
