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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => abort.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch('/api/get-latest?all=1', { signal: abort.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const entries = await response.json() as Array<{ moduleId: string; report: unknown }>;
        const summaries = new Map(entries.map(entry => [entry.moduleId, campaignSummary(entry.report)]));
        if (active) setReports(modules.map(module => ({ moduleId: module.id, label: module.label, summary: summaries.get(module.id) ?? null })));
      } catch {
        if (active) setLoadError(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; window.clearTimeout(timeout); abort.abort(); };
  }, []);

  return <div className="w-full max-w-none"><ReportSummary title="Derniers rapports vérifiés">
    <p className="text-[10px] text-base-content/55">Le dernier résultat reconnu par banc. Les cinq dernières campagnes restent consultables dans chaque banc.</p>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-busy={!loaded} aria-label="Dernier rapport des bancs 01 à 15">
      {reports.map(({ moduleId, label, summary }) => {
        const measure = summary ? primaryMeasure(summary) : null;
        const stateLabel = summary ? <><time dateTime={summary.timestamp}>{new Date(summary.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time> · {summary.status}</> : loadError ? 'Lecture indisponible' : loaded ? 'Aucun rapport vérifié' : 'Lecture du rapport…';
        return <li key={moduleId} data-dashboard-report={moduleId} className="w-full min-w-0 h-16 rounded-box border border-base-content/10 bg-base-100/40 px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-2 items-center gap-x-2">
          <p data-report-title className="min-w-0 truncate whitespace-nowrap text-xs font-medium" title={label}>{label}</p>
          <p data-report-value className="shrink-0 whitespace-nowrap text-xs font-mono text-primary text-right">{measure?.value ?? '—'}</p>
          {summary ? <Button variant="ghost" size="xs" className="shrink-0" aria-label={`Ouvrir le rapport ${label}`} onClick={() => onOpenReport(moduleId)}><FileText className="w-3.5 h-3.5" /></Button> : <span className="w-6 shrink-0" aria-hidden="true" />}
          <p data-report-meta className="min-w-0 truncate whitespace-nowrap text-[10px] text-base-content/55" title={typeof stateLabel === 'string' ? stateLabel : undefined}>{stateLabel}</p>
          <p data-report-provenance className="col-span-2 min-w-0 truncate whitespace-nowrap text-right text-[9px] text-base-content/45" title={measure?.provenance}>{measure?.provenance ?? (loadError ? 'Serveur de rapports indisponible' : loaded ? 'Aucune provenance vérifiée' : 'Lecture en cours')}</p>
        </li>;
      })}
    </ul>
  </ReportSummary></div>;
}
