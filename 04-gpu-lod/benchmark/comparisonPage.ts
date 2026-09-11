import '../../src/style.css';
import { runSceneComparison, startScenePreview } from './sceneComparison.ts';
import type { ComparisonOptions } from './comparisonTypes.ts';
import { comparisonRows, formatSceneComparison, milliseconds, type SavedComparison } from './comparisonReporter.ts';

interface ArchiveEntry {
  id: string;
  timestamp: string;
  config: ComparisonOptions;
  jsonUrl: string;
  markdownUrl: string;
  sourcesUrl?: string | null;
}

const element = <T extends HTMLElement>(id: string) => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Élément manquant : ${id}`);
  return found as T;
};
const form = element<HTMLFormElement>('comparison-form');
const canvas = element<HTMLCanvasElement>('comparison-canvas');
const controls = element<HTMLFieldSetElement>('comparison-controls');
const runButton = element<HTMLButtonElement>('run-comparison');
const retryButton = element<HTMLButtonElement>('retry-save');
const previewButton = element<HTMLButtonElement>('preview-scene');
const stopButton = element<HTMLButtonElement>('stop-preview');
const status = element('comparison-status');
let pending: { report: SavedComparison; markdown: string } | null = null;
let running = false;
let stopPreview: (() => void) | null = null;

const setStatus = (message: string) => { status.textContent = message; };
const selected = (id: string) => element<HTMLSelectElement>(id).value;
function options(width: number, height: number, pixelRatio: number): ComparisonOptions {
  return {
    count: Number(selected('count')), width, height, pixelRatio, seed: 42,
    samples: Number(selected('samples')), warmup: 60,
    shadows: element<HTMLInputElement>('shadows').checked,
    candidate: selected('candidate') === 'guarded' ? 'guarded' : 'prepared',
  };
}
function stop() {
  stopPreview?.(); stopPreview = null;
  stopButton.classList.add('hidden'); previewButton.disabled = false;
  controls.disabled = false; runButton.disabled = false;
}
stopButton.addEventListener('click', () => { stop(); setStatus('Scène arrêtée.'); });
previewButton.addEventListener('click', async () => {
  if (running || stopPreview) return;
  const resolution = selected('resolution');
  const [width, height, pixelRatio] = resolution === 'matrix' ? [1920, 1080, 1] : resolution.split(',').map(Number);
  controls.disabled = true; previewButton.disabled = true; runButton.disabled = true;
  setStatus('Préparation de la scène détaillée…');
  try {
    const config = options(width, height, pixelRatio);
    delete config.candidate;
    element('scene-description').textContent = `${config.count.toLocaleString('fr-FR')} objets · ${width} × ${height} physiques · aperçu de la référence`;
    let lastUpdate = 0;
    stopPreview = await startScenePreview(canvas, config, metrics => {
      const now = performance.now();
      if (now - lastUpdate < 500) return;
      lastUpdate = now;
      element('scene-live-metrics').textContent = `${metrics.mainPassTriangles.toLocaleString('fr-FR')} triangles principaux + ${metrics.shadowPassTriangles.toLocaleString('fr-FR')} pour les ombres · CPU ${metrics.cpuFrameWorkMs.toFixed(1)} ms · intervalle ${metrics.rafDeltaMs?.toFixed(1) ?? '—'} ms`;
    });
    stopButton.classList.remove('hidden');
    setStatus('Scène animée active. Cet aperçu n’est pas une campagne de comparaison enregistrée.');
  } catch (error) { stop(); setStatus(String(error)); }
});
window.addEventListener('pagehide', stop);
function link(label: string, href: string) {
  const a = document.createElement('a');
  a.textContent = label;
  a.href = href;
  a.className = 'link link-primary';
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function show(report: SavedComparison, markdown: string) {
  const target = element('comparison-table');
  const table = document.createElement('table');
  table.className = 'table table-zebra table-sm';
  const head = table.createTHead().insertRow();
  for (const label of ['Variante', 'Images', 'Sélection p50', 'CPU p50', 'CPU p95', 'Cadence p50', 'Cadence p95', 'GPU p50']) {
    const th = document.createElement('th'); th.textContent = label; head.append(th);
  }
  const body = table.createTBody();
  for (const row of comparisonRows(report)) {
    const tr = body.insertRow();
    for (const value of [row.variant, row.frames.toString(), ...[row.select, row.cpu, row.cpuP95, row.raf, row.rafP95, row.gpu].map(milliseconds)]) {
      tr.insertCell().textContent = value;
    }
  }
  target.replaceChildren(table);
  element('comparison-report').textContent = markdown;
  element('comparison-results').classList.remove('hidden');
}

async function history() {
  const target = element('comparison-history');
  try {
    const response = await fetch('/api/lod-comparison/history');
    if (!response.ok) throw new Error(`Historique indisponible (${response.status})`);
    const { runs } = await response.json() as { runs: ArchiveEntry[] };
    target.replaceChildren();
    if (!runs.length) { target.textContent = 'Aucune campagne enregistrée.'; return; }
    const table = document.createElement('table'); table.className = 'table table-zebra table-sm';
    const header = table.createTHead().insertRow();
    for (const name of ['Date', 'Configuration', 'Variante', 'Rapports']) {
      const th = document.createElement('th'); th.textContent = name; header.append(th);
    }
    const body = table.createTBody();
    for (const run of runs) {
      const tr = body.insertRow();
      tr.insertCell().textContent = new Date(run.timestamp).toLocaleString('fr-FR');
      tr.insertCell().textContent = `${run.config.count.toLocaleString('fr-FR')} objets · ${run.config.width} × ${run.config.height} · ratio ${run.config.pixelRatio} · ombres ${run.config.shadows ? 'oui' : 'non'}`;
      tr.insertCell().textContent = run.config.candidate ?? 'prepared';
      const cell = tr.insertCell(); cell.append(link('Rapport', run.markdownUrl), ' · ', link('Données', run.jsonUrl));
      if (run.sourcesUrl) cell.append(' · ',link('Sources',run.sourcesUrl));
    }
    target.append(table);
  } catch (error) {
    target.textContent = String(error);
  }
}

async function save() {
  if (!pending) return;
  const response = await fetch('/api/lod-comparison', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending),
  });
  if (!response.ok) throw new Error(`Sauvegarde refusée (${response.status}) : ${await response.text()}`);
  const saved = await response.json() as ArchiveEntry;
  element('comparison-links').replaceChildren(link('Rapport enregistré', saved.markdownUrl), link('Données brutes', saved.jsonUrl));
  if (saved.sourcesUrl) element('comparison-links').append(link('Sources du test',saved.sourcesUrl));
  pending = null;
  retryButton.classList.add('hidden');
  await history();
}

retryButton.addEventListener('click', async () => {
  retryButton.disabled = true;
  try { await save(); setStatus('Rapport sauvegardé.'); }
  catch (error) { setStatus(String(error)); }
  finally { retryButton.disabled = false; }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (running || pending) { setStatus('Sauvegardez le résultat en attente avant une nouvelle campagne.'); return; }
  stop(); running = true; controls.disabled = true; runButton.disabled = true; previewButton.disabled = true;
  element('comparison-links').replaceChildren();
  try {
    const requested = selected('resolution');
    const resolutions = requested === 'matrix' ? [[1920, 1080, 1], [2560, 1440, 1], [3840, 2160, 1]] : [requested.split(',').map(Number)];
    const repeats = Number(selected('repeats'));
    let completed = 0;
    for (let repeat = 0; repeat < repeats; repeat++) {
      for (const [width, height, pixelRatio] of resolutions) {
        const config = options(width, height, pixelRatio);
        element('scene-description').textContent = `${config.count.toLocaleString('fr-FR')} objets · ${width} × ${height} physiques · ratio ${pixelRatio}`;
        const metadata = await fetch('/api/lod-comparison/meta');
        if (!metadata.ok) throw new Error('Provenance du banc indisponible.');
        const before = await metadata.json();
        const result = await runSceneComparison(canvas, config, message => setStatus(`Campagne ${completed + 1}/${resolutions.length * repeats} · ${message}`));
        const afterResponse = await fetch('/api/lod-comparison/meta');
        if (!afterResponse.ok) throw new Error('Contrôle final de provenance indisponible.');
        const after = await afterResponse.json();
        const sourcesStable = before.commit === after.commit && JSON.stringify(before.sourceHashes) === JSON.stringify(after.sourceHashes);
        const provenance = { before, after, sourcesStable };
        if (!sourcesStable) result.limitations.push('INVALID: project sources changed during this campaign. Do not use timings as comparative evidence.');
        const report: SavedComparison = { ...result, test: '04-gpu-lod-comparison', provenance };
        const markdown = formatSceneComparison(report);
        pending = { report, markdown };
        show(report, markdown);
        await save();
        completed++;
        if (!sourcesStable) throw new Error('Sources modifiées pendant la campagne : résultat conservé, comparaison non recevable.');
        if (!result.quality.passed) throw new Error(`Contrôle qualité refusé : ${result.quality.failure ?? 'différence de rendu'}. Rapport conservé.`);
      }
    }
    setStatus(`${completed} campagne(s) mesurée(s) et archivée(s). Consultez les différences et les limites dans les rapports.`);
  } catch (error) {
    setStatus(`Campagne interrompue : ${String(error)}`);
    retryButton.classList.toggle('hidden', pending === null);
  } finally {
    running = false; controls.disabled = false; runButton.disabled = false; previewButton.disabled = false;
  }
});

void history();
