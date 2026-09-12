import { useEmeraldPanel } from './useEmeraldPanel.ts';
import { Button } from './ui/Button.tsx';

export function EmeraldReportBody() {
  const { view, state } = useEmeraldPanel();
  if (!view) return null;
  return (
    <>
      <p className="text-xs">Cinq dernières exécutions conservées dans ce navigateur, séparées de la fixture.</p>
      {(view.history ?? []).length
        ? (view.history ?? []).map((report, index) => (
          <Button key={report.id} variant="secondary" disabled={state.running} onClick={() => view.showReport(report.id)}>
            {index === 0 ? 'Voir le rapport' : `Rapport ${index + 1}`} · {report.configuration.cities} ville(s) · {report.status}
          </Button>
        ))
        : <p className="text-xs text-base-content/60">Aucune exécution enregistrée.</p>}
    </>
  );
}
