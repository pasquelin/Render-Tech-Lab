import { useLayoutEffect } from 'react';
import { mountComparisonPage } from './comparisonPage.ts';
import { Select } from '../../src/components/ui/Select.tsx';
import { Button } from '../../src/components/ui/Button.tsx';
import { StatusBadge } from '../../src/components/ui/StatusBadge.tsx';
import { Input } from '../../src/components/ui/Input.tsx';
import { ReportSummary } from '../../src/components/ui/ReportSummary.tsx';
import { LabSection } from '../../src/components/ui/LabSection.tsx';

export function ComparisonApp() {
  useLayoutEffect(() => mountComparisonPage(), []);

  return (
    <div className="grid h-full w-full min-h-0 overflow-hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div data-lab-main="true" className="min-w-0 min-h-0 flex flex-col overflow-hidden">
      <header className="bg-base-200 border-b border-base-content/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <a className="link text-sm" href="/">← Retour au laboratoire</a>
          <h1 className="text-2xl font-bold mt-2">04 · Comparaison des calculs</h1>
          <p className="text-sm text-base-content/70 mt-1">Même scène détaillée, mêmes paramètres, référence et variantes mesurées successivement.</p>
        </div>
        <StatusBadge tone="outline">Scène de stress · WebGL2</StatusBadge>
      </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6 space-y-4">
          <ReportSummary title="Scène mesurée">
            <div className="flex justify-between gap-3 text-sm">
              <span id="scene-description">La scène apparaît au lancement.</span>
            </div>
            <p id="scene-live-metrics" className="text-sm font-mono" role="status">Le compteur indiquera les triangles réellement soumis.</p>
            <canvas id="comparison-canvas" className="w-full max-h-[60vh] object-contain bg-black" aria-label="Scène 3D du banc comparatif" />
          </ReportSummary>
          <section id="comparison-results" className="card bg-base-200 p-4 gap-3 hidden">
            <h2 className="text-lg font-bold">Dernier résultat mesuré</h2>
            <p className="text-sm">Les durées CPU et la cadence sont distinctes. Un gain local ne constitue pas une certification de l&apos;ensemble du moteur.</p>
            <div id="comparison-table" className="overflow-x-auto" />
            <div id="comparison-links" className="flex flex-wrap gap-4 text-sm" />
            <details className="collapse collapse-arrow bg-base-300">
              <summary className="collapse-title">Rapport complet</summary>
              <pre id="comparison-report" className="collapse-content text-xs whitespace-pre-wrap select-text" />
            </details>
          </section>
        </main>
      </div>
        <aside id="sidebar" className="min-w-0 h-full min-h-0 bg-base-200 p-3.5 overflow-y-auto overflow-x-hidden space-y-3 flex flex-col border-l border-base-content/10">
          <form id="comparison-form" className="space-y-3">
            <LabSection id="lab-mode-card" number={1} title="Configuration / mode d’exécution">
              <fieldset id="comparison-controls" className="grid grid-cols-1 gap-3">
                <Select id="count" label="Objets soumis au rendu" defaultValue="2000" className="select-sm w-full">
                  <option value="2000">2 000 objets détaillés</option>
                  <option value="10000">10 000 · surcharge</option>
                  <option value="20000">20 000 · surcharge forte</option>
                  <option value="50000">50 000 · scène extrême</option>
                </Select>
                <Select id="resolution" label="Résolution de rendu" defaultValue="1920,1080,1" className="select-sm w-full">
                  <option value="1920,1080,1">Full HD · 1920 × 1080</option>
                  <option value="2560,1440,1">1440p · 2560 × 1440</option>
                  <option value="3840,2160,1">4K · 3840 × 2160</option>
                  <option value="1920,1080,2">Retina · 1920 × 1080, ratio 2</option>
                  <option value="matrix">Full HD + 1440p + 4K</option>
                </Select>
                <Select id="candidate" label="Variante comparée" defaultValue="prepared" className="select-sm w-full">
                  <option value="prepared">Tangente partagée</option>
                  <option value="guarded">Distance au carré · expérimental</option>
                </Select>
                <Select id="samples" label="Images par bloc" defaultValue="180" className="select-sm w-full">
                  <option value="180">180 images</option>
                  <option value="360">360 images</option>
                  <option value="600">600 images</option>
                </Select>
                <Select id="repeats" label="Campagnes répétées" defaultValue="2" className="select-sm w-full">
                  <option value="2">2 campagnes</option>
                  <option value="1">1 campagne</option>
                </Select>
                <Input id="shadows" type="checkbox" label="Ombres" defaultChecked />
              </fieldset>
            </LabSection>
            <LabSection id="lab-metrics-card" number={2} title="Métriques en direct">
              <p className="text-xs text-base-content/70">Les durées CPU et la cadence apparaissent après le lancement. Toute valeur absente reste non mesurée.</p>
            </LabSection>
            <LabSection id="lab-run-card" number={3} title="Campagne / comparaison">
              <div className="flex flex-col gap-2">
                <Button id="preview-scene" type="button" variant="outline">Voir la scène animée</Button>
                <Button id="stop-preview" type="button" variant="danger" className="hidden">Arrêter la scène</Button>
                <Button id="run-comparison" type="submit">Lancer le comparatif</Button>
                <Button id="retry-save" type="button" variant="outline" className="hidden">Réessayer la sauvegarde</Button>
              </div>
              <p className="text-xs text-base-content/70">Contrôles d&apos;image et de détail avant mesure · ordre A/B/B/A · 60 images d&apos;échauffement par bloc</p>
              <StatusBadge id="comparison-status" tone="neutral" className="w-full justify-start h-auto py-2 font-normal" role="status" aria-live="polite">Prêt. Aucune optimisation validée automatiquement.</StatusBadge>
            </LabSection>
            <LabSection id="lab-report-card" number={4} title="Rapports et suivi">
              <ReportSummary title="Historique des comparaisons">
                <p className="text-sm text-base-content/70">Chaque campagne conserve ses données brutes et son rapport. Comparez uniquement les configurations équivalentes.</p>
                <div id="comparison-history" className="overflow-x-auto text-sm">Chargement…</div>
              </ReportSummary>
            </LabSection>
          </form>
        </aside>
    </div>
  );
}
