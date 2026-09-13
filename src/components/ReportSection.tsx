import { useEffect, useState } from 'react';
import { FileText, Folder } from 'lucide-react';
import { hasMarkdownReport } from '../lab/reportReader.ts';
import { HINT_BASE } from '../lab/catalog.ts';
import { LabSection } from './ui/LabSection.tsx';
import { Button } from './ui/Button.tsx';

type ReportSectionProps = {
  testId: string;
  refreshKey: string;
  running: boolean;
  number?: number;
  hint: string;
  onOpen: () => void;
  onReveal: () => void;
};

/** Shared report surface: it remains visible outside a test and enables actions only for an archived package. */
export function ReportSection({ testId, refreshKey, running, number = 4, hint, onOpen, onReveal }: ReportSectionProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    if (running) return () => { cancelled = true; };
    void hasMarkdownReport(fetch, testId, 12, 300).then(found => { if (!cancelled) setAvailable(found); });
    return () => { cancelled = true; };
  }, [testId, refreshKey, running]);

  if (running) return null;
  return <LabSection id="lab-report-card" number={number} title="Rapports et suivi">
    {available ? <>
      <div className="text-xs text-base-content/60 leading-tight">Résultats archivés dans le paquet : <code className="text-[11px] bg-base-100 px-1.5 py-0.5 rounded font-mono text-primary border border-base-content/10">REPORT.md</code></div>
      <p className="text-[10px] text-base-content/50">2 derniers rapports complets conservés.</p>
    </> : <p className="text-xs text-base-content/60 leading-tight">Aucun rapport archivé pour ce banc.</p>}
    <div className="flex gap-2">
      <Button id="btn-view-report" disabled={!available} className="flex-1 gap-1.5 shadow-xs whitespace-nowrap text-xs px-2" onClick={onOpen}><FileText className="w-3.5 h-3.5" /><span>Voir rapport</span></Button>
      <Button id="btn-open-reports" variant="secondary" disabled={!available} className="flex-1 gap-1.5 shadow-xs whitespace-nowrap text-xs px-2" onClick={onReveal}><Folder className="w-3.5 h-3.5" /><span>Révéler Finder</span></Button>
    </div>
    <div id="open-report-hint" className={`${HINT_BASE} text-base-content/40`}>{hint}</div>
  </LabSection>;
}
