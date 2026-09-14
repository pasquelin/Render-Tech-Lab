import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
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
  return <div data-bench-screen="start" data-execution-view="idle" className="w-full h-full min-w-0 min-h-0 flex-1 overflow-auto bg-base-100 p-5 md:p-6">
    <section className="w-full min-w-0 wrap-break-word space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-primary"><Activity className="w-4 h-4" /><span>Aucun test en cours</span></div>
      <h1 className="text-xl md:text-2xl font-semibold">{title}</h1>
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
    </section>
  </div>;
}
