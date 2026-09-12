import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { MODULE_NAV } from '../lab/catalog.ts';
import { campaignSummary } from '../lab/campaignSummary.ts';
import type { CampaignSummary } from '../lab/execution.ts';
import { Button } from './ui/Button.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';

type ReportEntry = { moduleId: string; label: string; summary: CampaignSummary | null };

function primaryMeasure(summary: CampaignSummary) {
  const series = summary.series.find(item => item.values.length > 0);
  const value = series?.values.at(-1);
  if (!series || value === undefined) return { value: 'Aucune mesure exploitable', provenance: 'Détail dans le rapport' };
  return { value: `${value.toFixed(2)} ${series.unit}`, provenance: series.label };
}

export function DashboardReports({ onOpenReport }: { onOpenReport: (moduleId: string) => void }) {
  const modules = MODULE_NAV.filter(module => module.id !== '00-baseline');
  const [reports, setReports] = useState<ReportEntry[]>(() => modules.map(module => ({ moduleId: module.id, label: module.label, summary: null })));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all(modules.map(async module => {
      try {
        const response = await fetch(`/api/get-latest?testId=${encodeURIComponent(module.id)}`, { signal: abort.signal });
        if (!response.ok) return { moduleId: module.id, label: module.label, summary: null };
        return { moduleId: module.id, label: module.label, summary: campaignSummary(await response.json()) };
      } catch {
        return { moduleId: module.id, label: module.label, summary: null };
      }
    })).then(entries => {
      if (!abort.signal.aborted) { setReports(entries); setLoaded(true); }
    });
    return () => abort.abort();
  }, []);

  return <div className="w-full max-w-none"><ReportSummary title="Derniers rapports vérifiés">
    <p className="text-[10px] text-base-content/55">Le dernier résultat reconnu par banc. Les cinq dernières campagnes restent consultables dans chaque banc.</p>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-busy={!loaded} aria-label="Dernier rapport des bancs 01 à 15">
      {reports.map(({ moduleId, label, summary }) => {
        const measure = summary ? primaryMeasure(summary) : null;
        const stateLabel = summary ? <><time dateTime={summary.timestamp}>{new Date(summary.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time> · {summary.status}</> : loaded ? 'Aucun rapport vérifié' : 'Lecture du rapport…';
        return <li key={moduleId} data-dashboard-report={moduleId} className="w-full min-w-0 h-16 rounded-box border border-base-content/10 bg-base-100/40 px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-2 items-center gap-x-2">
          <p data-report-title className="min-w-0 truncate whitespace-nowrap text-xs font-medium" title={label}>{label}</p>
          <p data-report-value className="shrink-0 whitespace-nowrap text-xs font-mono text-primary text-right">{measure?.value ?? '—'}</p>
          {summary ? <Button variant="ghost" size="xs" className="shrink-0" aria-label={`Ouvrir le rapport ${label}`} onClick={() => onOpenReport(moduleId)}><FileText className="w-3.5 h-3.5" /></Button> : <span className="w-6 shrink-0" aria-hidden="true" />}
          <p data-report-meta className="min-w-0 truncate whitespace-nowrap text-[10px] text-base-content/55" title={typeof stateLabel === 'string' ? stateLabel : undefined}>{stateLabel}</p>
          <p data-report-provenance className="col-span-2 min-w-0 truncate whitespace-nowrap text-right text-[9px] text-base-content/45" title={measure?.provenance}>{measure?.provenance ?? (loaded ? 'Aucune provenance vérifiée' : 'Lecture en cours')}</p>
        </li>;
      })}
    </ul>
  </ReportSummary></div>;
}
