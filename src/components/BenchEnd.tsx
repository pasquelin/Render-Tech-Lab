import type { ReactNode } from 'react';
import { BenchScreen } from './BenchScreen.tsx';
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
  return <BenchScreen screen="end" view={status} statusLabel={statusLabel} title={title}>
    {status === 'error' ? <ErrorState message={message} /> : <p className="text-sm leading-relaxed text-base-content/80">{message}</p>}
    {controls}
    {previousReportNotice ? <p className="text-xs font-semibold text-warning">Dernier rapport archivé, antérieur à cette exécution</p> : null}
    {summary}
    {details?.length ? <MetricGrid items={details} /> : null}
    {note ? <p className="text-xs text-base-content/60">{note}</p> : null}
    {actions}
  </BenchScreen>;
}
