import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { MetricGrid, type MetricData } from './ui/MetricGrid.tsx';
import { ErrorState } from './ui/ErrorState.tsx';

export type BenchEndProps = {
  status: 'completed' | 'stopped' | 'error';
  title: string;
  statusLabel: string;
  message: string;
  previousReportNotice?: boolean;
  controls?: ReactNode;
  summary?: ReactNode;
  details?: MetricData[];
  note?: string;
  actions: ReactNode;
};

export function BenchEnd({
  status, title, statusLabel, message, previousReportNotice,
  controls, summary, details, note, actions,
}: BenchEndProps) {
  return <div data-bench-screen="end" data-execution-view={status} className="w-full h-full min-w-0 min-h-0 flex-1 overflow-auto bg-base-100 p-5 md:p-6">
    <section className="w-full min-w-0 wrap-break-word space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-primary"><Activity className="w-4 h-4" /><span>{statusLabel}</span></div>
      <h1 className="text-xl md:text-2xl font-semibold">{title}</h1>
      {status === 'error' ? <ErrorState message={message} /> : <p className="text-sm leading-relaxed text-base-content/80">{message}</p>}
      {controls}
      {previousReportNotice ? <p className="text-xs font-semibold text-warning">Dernier rapport archivé, antérieur à cette exécution</p> : null}
      {summary}
      {details?.length ? <MetricGrid items={details} /> : null}
      {note ? <p className="text-xs text-base-content/60">{note}</p> : null}
      {actions}
    </section>
  </div>;
}
