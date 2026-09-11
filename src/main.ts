import './style.css';
import { BenchmarkRunner } from '../01-indirect-draw/benchmark/runner.ts';
import { formatMarkdownReport } from '../01-indirect-draw/benchmark/reporter.ts';
import type { FrameMeasurement as FrameMeasurement01, CrossoverReport } from '../01-indirect-draw/types.ts';

import { GPUSceneBenchmarkRunner, PAIN_MATRIX } from '../03-gpu-scene/benchmark/runner.ts';
import { formatGpuSceneReport } from '../03-gpu-scene/benchmark/reporter.ts';
import { GPUSceneChart } from '../03-gpu-scene/benchmark/chart.ts';
import type { SceneStressConfig, GpuSceneBenchResult } from '../03-gpu-scene/types.ts';
import { LodBenchmarkRunner } from '../04-gpu-lod/benchmark/runner.ts';
import { LodChart } from '../04-gpu-lod/benchmark/chart.ts';
import type { LodBenchmarkSummary } from '../04-gpu-lod/types.ts';

import {
  createIcons,
  Play,
  Flame,
  FileText,
  Folder,
  Copy,
  RefreshCw,
  Zap,
  X,
  Check,
} from 'lucide';

function refreshIcons() {
  createIcons({
    icons: {
      Play,
      Flame,
      FileText,
      Folder,
      Copy,
      RefreshCw,
      Zap,
      X,
      Check,
    },
  });
}

// Parser Markdown vers HTML daisyUI propre, sobre et sécurisé
function parseMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Blocs de code ```...```
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-base-100 p-3 rounded-box border border-base-content/10 font-mono text-xs overflow-x-auto my-2 text-base-content/90"><code>${code.trim()}</code></pre>`;
  });

  // Titres avec styles daisyUI sobres
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold uppercase tracking-wider text-base-content/80 mt-4 mb-1">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold tracking-tight text-primary border-b border-base-content/10 pb-1.5 mt-5 mb-2.5">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-base-content border-b border-base-content/15 pb-2 mb-3">$1</h1>');

  // Blockquotes daisyUI
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-primary bg-base-200/60 pl-3 py-1.5 my-2 text-xs italic text-base-content/80 rounded-r-box">$1</blockquote>');

  // Séparateur horizontal
  html = html.replace(/^---$/gim, '<div class="divider my-3 opacity-30"></div>');

  // Gras
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-base-content">$1</strong>');

  // Code inline
  html = html.replace(/`([^`]+)`/g, '<code class="bg-base-200 px-1 py-0.5 rounded font-mono text-xs text-primary border border-base-content/10">$1</code>');

  // Math KaTeX basique $...$
  html = html.replace(/\$([^\$]+)\$/g, '<code class="bg-base-100 px-1 py-0.5 rounded font-mono text-xs text-cyan-400 border border-cyan-500/20">$1</code>');

  // Listes à puces
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-xs text-base-content/80 my-0.5">$1</li>');

  // Tables Markdown en daisyUI table table-zebra table-sm
  const lines = html.split('\n');
  const result: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const nextLine = (lines[i + 1] || '').trim();
      const isSep = /^\|(?:\s*:?-+:?\s*\|)+$/.test(nextLine);

      if (!inTable) {
        inTable = true;
        result.push('<div class="overflow-x-auto my-3 rounded-box border border-base-content/10 bg-base-200/40"><table class="table table-zebra table-sm w-full font-mono text-xs">');
      }

      if (isSep) {
        const cells = line.split('|').slice(1, -1).map((c) => `<th class="bg-base-300 text-base-content/80">${c.trim()}</th>`).join('');
        result.push(`<thead><tr>${cells}</tr></thead><tbody>`);
        i++; // Sauter la ligne séparatrice
        continue;
      }

      const cells = line.split('|').slice(1, -1).map((c) => `<td>${c.trim()}</td>`).join('');
      result.push(`<tr>${cells}</tr>`);
    } else {
      if (inTable) {
        result.push('</tbody></table></div>');
        inTable = false;
      }
      if (line.length > 0) {
        if (
          !line.startsWith('<h') &&
          !line.startsWith('<blockquote') &&
          !line.startsWith('<pre') &&
          !line.startsWith('<div') &&
          !line.startsWith('<li') &&
          !line.startsWith('<table')
        ) {
          result.push(`<p class="text-xs text-base-content/80 leading-relaxed mb-1.5">${line}</p>`);
        } else {
          result.push(line);
        }
      }
    }
  }
  if (inTable) {
    result.push('</tbody></table></div>');
  }

  return result.join('\n');
}

// Configurations prédéfinies pour le stress 4D de 03-gpu-scene
const GPU_SCENE_PRESETS: { [key: string]: SceneStressConfig } = {
  'dim-a-10': {
    name: 'Dim A : 10 topologies',
    dimension: 'A-geometry',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-a-100': {
    name: 'Dim A : 100 topologies',
    dimension: 'A-geometry',
    objectCount: 2000,
    geometryCount: 100,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-b-10': {
    name: 'Dim B : 10 matériaux',
    dimension: 'B-material',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-b-100': {
    name: 'Dim B : 100 matériaux',
    dimension: 'B-material',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 100,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-c-25': {
    name: 'Dim C : 25% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.25,
    targetVisibility: 1.0,
  },
  'dim-c-50': {
    name: 'Dim C : 50% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.50,
    targetVisibility: 1.0,
  },
  'dim-c-100': {
    name: 'Dim C : 100% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 1.0,
    targetVisibility: 1.0,
  },
  'dim-d-50': {
    name: 'Dim D : 50% visibilité',
    dimension: 'D-visibility',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 0.5,
  },
  'pain-500': {
    name: 'Pain : 500 topologies',
    dimension: 'A-geometry',
    objectCount: 5000,
    geometryCount: 500,
    materialCount: 50,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'pain-1000': {
    name: 'Torture : 1 000 topologies',
    dimension: 'A-geometry',
    objectCount: 10000,
    geometryCount: 1000,
    materialCount: 100,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
};

// Configurations étalon Spec 13 pour 00-baseline
const BASELINE_00_SCENARIOS: Record<
  string,
  { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string; desc: string }
> = {
  S0: { objects: '1', submit: '0.08 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '3', desc: 'S0 · Baseline minimale (1 objet unique, témoin zéro).' },
  S1: { objects: '500', submit: '0.12 ms', cpuFrame: '0.45 ms', fps: '60 FPS', drawCalls: '3', desc: 'S1 · 500 objets instanciés (instancing valide).' },
  S2: { objects: '1 000', submit: '0.18 ms', cpuFrame: '0.70 ms', fps: '60 FPS', drawCalls: '3', desc: 'S2 · 1 000 objets instanciés (montée en charge).' },
  S3: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 002', desc: 'S3 · 2 000 objets uniques (coude CPU franchi à 3.35 ms).' },
  S4: { objects: '200', submit: '0.45 ms', cpuFrame: '1.10 ms', fps: '60 FPS', drawCalls: '202', desc: 'S4 · 30 lumières dynamiques (goulot passes GPU).' },
  S5: { objects: '5 000', submit: '8.45 ms', cpuFrame: '11.8 ms', fps: '54 FPS', drawCalls: '5 002', desc: 'S5 · 5 000 objets uniques hostile (chute à 54 FPS).' },
};

window.addEventListener('DOMContentLoaded', async () => {
  const canvasWebGpu = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
  const canvasWebGL = document.getElementById('canvas-webgl') as HTMLCanvasElement;
  const chartCanvas = document.getElementById('canvas-chart') as HTMLCanvasElement;
  const viewBaseline = document.getElementById('view-baseline') as HTMLElement | null;
  const viewportEmpty = document.getElementById('viewport-empty') as HTMLElement | null;

  /** Affiche l'état vide du viewport (module sans rendu temps réel). */
  function setViewportEmpty(visible: boolean, title?: string, desc?: string) {
    if (!viewportEmpty) return;
    viewportEmpty.classList.toggle('hidden', !visible);
    viewportEmpty.classList.toggle('flex', visible);
    if (title) {
      const t = document.getElementById('viewport-empty-title');
      if (t) t.innerText = title;
    }
    if (desc) {
      const d = document.getElementById('viewport-empty-desc');
      if (d) d.innerText = desc;
    }
  }

  const selectModule = document.getElementById('select-module') as HTMLSelectElement | null;
  const btnBaselineReportView = document.getElementById('btn-baseline-report-view') as HTMLButtonElement | null;
  const btnBaselineView01 = document.getElementById('btn-baseline-view-01') as HTMLButtonElement | null;
  const btnBaselineView02 = document.getElementById('btn-baseline-view-02') as HTMLButtonElement | null;
  const btnBaselineView03 = document.getElementById('btn-baseline-view-03') as HTMLButtonElement | null;
  const btnBaselineView04 = document.getElementById('btn-baseline-view-04') as HTMLButtonElement | null;
  const btnLaunch01 = document.getElementById('btn-launch-01') as HTMLButtonElement | null;
  const btnLaunch02 = document.getElementById('btn-launch-02') as HTMLButtonElement | null;
  const btnLaunch03 = document.getElementById('btn-launch-03') as HTMLButtonElement | null;
  const btnLaunch04 = document.getElementById('btn-launch-04') as HTMLButtonElement | null;
  const btnBackToGpu = document.getElementById('btn-back-to-gpu') as HTMLButtonElement | null;

  const btnClassic = document.getElementById('btn-classic') as HTMLButtonElement;
  const btnGpuDriven = document.getElementById('btn-gpu-driven') as HTMLButtonElement;
  const btnRunBenchmark = document.getElementById('btn-benchmark') as HTMLButtonElement;
  const btnPainBenchmark = document.getElementById('btn-pain-benchmark') as HTMLButtonElement | null;
  const selectCount = document.getElementById('select-count') as HTMLSelectElement;

  const statMode = document.getElementById('stat-mode') as HTMLElement;
  const statObjects = document.getElementById('stat-objects') as HTMLElement;
  const statSubmit = document.getElementById('stat-submit') as HTMLElement;
  const statCpuFrame = document.getElementById('stat-cpuframe') as HTMLElement;
  const statFps = document.getElementById('stat-fps') as HTMLElement;
  const statDrawCalls = document.getElementById('stat-drawcalls') as HTMLElement;

  /**
   * Vide les compteurs de télémesure.
   * Utilisé quand le module actif ne produit pas de frames : mieux vaut un
   * tiret qu'une valeur laissée par le module précédent ou écrite en dur.
   */
  function clearMetrics() {
    for (const el of [statObjects, statSubmit, statCpuFrame, statFps, statDrawCalls]) {
      if (el) el.innerText = '—';
    }
  }

  /** Dernière campagne 04 mesurée, pour re-afficher au retour sur le module. */
  let lastLodSummary: LodBenchmarkSummary | null = null;

  /**
   * Reporte une campagne 04-gpu-lod dans l'UI : courbes + compteurs.
   * Toutes les valeurs affichées proviennent de la campagne, aucune n'est écrite en dur.
   */
  function applyLodSummary(summary: LodBenchmarkSummary) {
    lastLodSummary = summary;
    setViewportEmpty(
      true,
      '04 · GPU LOD — campagne mesurée',
      `Décimation meshoptimizer : ${summary.generation.originalTriangles.toLocaleString('fr-FR')} triangles → ` +
        `${summary.generation.lod1Triangles.toLocaleString('fr-FR')} (LOD1) → ${summary.generation.lod2Triangles.toLocaleString('fr-FR')} (LOD2), ` +
        `soit ${summary.generation.memorySavedPercent.toFixed(1)} % de mémoire économisée en ${summary.generation.durationMs.toFixed(1)} ms. ` +
        `Erreur projetée max ${summary.contractualErrorCheck.maxObservedErrorPx.toFixed(2)} px ` +
        `(seuil ${summary.contractualErrorCheck.thresholdPx} px) : ${summary.contractualErrorCheck.passed ? 'conforme' : 'NON conforme'}. ` +
        `Courbes CPU/GPU tracées dans le panneau de droite.`
    );

    const counts = summary.cpuSelection.objectCounts;
    const lastIdx = counts.length - 1;
    statObjects.innerText = counts[lastIdx] >= 1000 ? `${counts[lastIdx] / 1000}k` : `${counts[lastIdx]}`;
    const gpuTimes = summary.gpuSelection.computeTimesMs;
    statSubmit.innerText = gpuTimes ? `${gpuTimes[lastIdx].toFixed(2)} ms` : 'n/a';
    statCpuFrame.innerText = `${summary.cpuSelection.latenciesMs[lastIdx].toFixed(2)} ms`;
    statFps.innerText = summary.contractualErrorCheck.passed ? 'Conforme' : 'Hors seuil';
    statDrawCalls.innerText = `${summary.generation.memorySavedPercent.toFixed(0)} %`;

    chart04?.render(summary);
  }
  const benchStatus = document.getElementById('bench-status') as HTMLElement;

  const btnViewReport = document.getElementById('btn-view-report') as HTMLButtonElement | null;
  const btnOpenReports = document.getElementById('btn-open-reports') as HTMLButtonElement | null;
  const openReportHint = document.getElementById('open-report-hint') as HTMLElement | null;

  // Styles de statut : une base unique + une teinte, au lieu de répéter la
  // chaîne complète à chaque affectation (les copies avaient déjà divergé sur
  // `whitespace-nowrap truncate`, ce qui faisait changer la hauteur de la boîte).
  const STATUS_BASE =
    'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight whitespace-nowrap truncate';
  const HINT_BASE = 'text-[10px] text-center font-mono truncate';

  const setBenchStatus = (text: string, tone = 'text-base-content/80') => {
    benchStatus.innerText = text;
    benchStatus.className = `${STATUS_BASE} ${tone}`;
  };
  const setReportHint = (text: string, tone = 'text-base-content/50') => {
    if (!openReportHint) return;
    openReportHint.innerText = text;
    openReportHint.className = `${HINT_BASE} ${tone}`;
  };

  // Dialog daisyUI
  const reportModal = document.getElementById('report-modal') as HTMLDialogElement | null;
  const modalTitle = document.getElementById('modal-report-title') as HTMLElement | null;
  const modalPath = document.getElementById('modal-report-path') as HTMLElement | null;
  const modalBody = document.getElementById('modal-report-body') as HTMLElement | null;
  const modalFeedback = document.getElementById('modal-feedback') as HTMLElement | null;
  const btnRefreshReport = document.getElementById('btn-refresh-report') as HTMLButtonElement | null;
  const btnCopyReport = document.getElementById('btn-copy-report') as HTMLButtonElement | null;
  const btnModalOpenFinder = document.getElementById('btn-modal-open-finder') as HTMLButtonElement | null;

  let currentModuleId = '00-baseline';
  let rawReportContent = '';

  // Initialisation des coureurs de test
  const runner01 = new BenchmarkRunner(canvasWebGpu, canvasWebGL, chartCanvas);
  const webGpuSupported01 = await runner01.init();

  let runner02: GPUSceneBenchmarkRunner | null = null;
  let chart02: GPUSceneChart | null = null;
  let chart04: LodChart | null = null;

  if (webGpuSupported01) {
    setBenchStatus('✅ Pipeline WebGPU natif actif');
  } else {
    setBenchStatus('⚠️ WebGPU non disponible (mode secours)', 'text-warning');
  }

  // Redimensionnement réactif
  function onResize() {
    const container = document.getElementById('viewport-container')!;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvasWebGpu.width = w;
    canvasWebGpu.height = h;
    canvasWebGL.width = w;
    canvasWebGL.height = h;
    runner01.resize(w, h);
    if (runner02) runner02.resize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // Télémesure UI
  function updateTelemetry(module: string, mode: string) {
    const telemetryMode = document.getElementById('viewport-telemetry-mode');
    const telemetryDetail = document.getElementById('viewport-telemetry-detail');

    if (module === '00-baseline') {
      if (telemetryMode) telemetryMode.innerText = 'Three.js Reference Floor';
      if (telemetryDetail) telemetryDetail.innerText = 'Spec 13 Normalized Matrix (S0–S5)';
    } else if (module === '01-indirect-draw') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js WebGL Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'CPU Frustum Culling + Draw Calls';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Native Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Indirect Draw + WGSL Culling';
      }
    } else if (module === '03-gpu-scene') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js Multi-Mesh Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Multi-Geometry & Multi-Material';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Heterogeneous Scene';
        if (telemetryDetail) telemetryDetail.innerText = 'Mega-Buffers + Multi-Draw Indirect';
      }
    } else if (module === '04-gpu-lod') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'CPU Screen-Space Error LOD';
        if (telemetryDetail) telemetryDetail.innerText = '04B : CPU SSE Selection + Three.js';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'GPU Screen-Space Error LOD';
        if (telemetryDetail) telemetryDetail.innerText = '04C : Compute Shader WGSL + Multi-Draw';
      }
    }
  }

  // Mise à jour visuelle des boutons de pipeline Test A / Test B
  function updateModeButtons(mode: 'classic' | 'gpu-driven' | 'gpu-scene') {
    if (mode === 'classic') {
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '04-gpu-lod'
        ? 'Test A (CPU SSE)'
        : currentModuleId === '03-gpu-scene'
        ? 'Test A (Multi-Mesh)'
        : 'Test A (Three.js)';
      statMode.className = 'text-primary font-medium';
    } else {
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '04-gpu-lod'
        ? 'Test B (GPU SSE)'
        : currentModuleId === '03-gpu-scene'
        ? 'Test B (GPU-Scene)'
        : 'Test B (GPU-Driven)';
      statMode.className = 'text-primary font-medium';
    }
    updateTelemetry(currentModuleId, mode);
  }

  // Mise à jour du sélecteur de charge selon le module actif
  function populateSelectorForModule(moduleId: string) {
    selectCount.innerHTML = '';

    if (moduleId === '00-baseline') {
      const options = [
        { val: 'S0', label: 'S0 · 1 objet témoin' },
        { val: 'S1', label: 'S1 · 500 instanciés' },
        { val: 'S2', label: 'S2 · 1 000 instanciés' },
        { val: 'S3', label: 'S3 · 2 000 uniques', selected: true },
        { val: 'S4', label: 'S4 · 30 lumières dynamiques' },
        { val: 'S5', label: 'S5 · 5 000 hostile' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.val;
        o.innerText = opt.label;
        if (opt.selected) {
          o.selected = true;
          o.classList.add('active');
        }
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="file-text" class="w-3.5 h-3.5"></i><span>Consulter le Rapport Étalon</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.style.display = 'none';
      }
    } else if (moduleId === '01-indirect-draw') {
      const options = [
        { val: '500', label: '500 objets uniques' },
        { val: '1000', label: '1 000 objets uniques' },
        { val: '2000', label: '⚡ 2 000 objets', selected: true },
        { val: '5000', label: '5 000 objets uniques' },
        { val: '10000', label: '🔥 10 000 objets' },
        { val: '25000', label: '🔥 25 000 objets' },
        { val: '50000', label: '☠️ 50 000 objets' },
        { val: '100000', label: '☠️ 100 000 objets' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.val;
        o.innerText = opt.label;
        if (opt.selected) {
          o.selected = true;
          o.classList.add('active');
        }
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Benchmark Standard (500 → 5k)</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.innerHTML = '<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>Tests de Douleur (10k → 100k)</span>';
        btnPainBenchmark.style.display = 'inline-flex';
      }
    } else if (moduleId === '03-gpu-scene') {
      const options = [
        { key: 'dim-a-10', label: '⚡ Dim A · 10 topologies' },
        { key: 'dim-a-100', label: '⚡ Dim A · 100 topologies', selected: true },
        { key: 'dim-b-10', label: '⚡ Dim B · 10 matériaux' },
        { key: 'dim-b-100', label: '⚡ Dim B · 100 matériaux' },
        { key: 'dim-c-25', label: '⚡ Dim C · 25% dynamique' },
        { key: 'dim-c-50', label: '⚡ Dim C · 50% dynamique' },
        { key: 'dim-c-100', label: '🔥 Dim C · 100% dynamique' },
        { key: 'dim-d-50', label: '⚡ Dim D · 50% visibilité' },
        { key: 'pain-500', label: '🔥 Pain · 500 topologies' },
        { key: 'pain-1000', label: '☠️ Torture · 1 000 topologies' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.key;
        o.innerText = opt.label;
        if (opt.selected) {
          o.selected = true;
          o.classList.add('active');
        }
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Matrice 4D Complète (Dim A, B, C)</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.innerHTML = '<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>Stress Topologies (10 → 1 000)</span>';
        btnPainBenchmark.style.display = 'inline-flex';
      }
    } else if (moduleId === '04-gpu-lod') {
      const options = [
        { val: '1000', label: '1 000 objets · Multi-LOD' },
        { val: '2000', label: '⚡ 2 000 objets · Multi-LOD', selected: true },
        { val: '5000', label: '5 000 objets · Multi-LOD' },
        { val: '10000', label: '🔥 10 000 objets · Multi-LOD' },
        { val: '50000', label: '☠️ 50 000 objets · Multi-LOD' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.val;
        o.innerText = opt.label;
        if (opt.selected) {
          o.selected = true;
          o.classList.add('active');
        }
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Benchmark LOD (04A / 04B / 04C)</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.innerHTML = '<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>Stress LOD 50k Objets</span>';
        btnPainBenchmark.style.display = 'inline-flex';
      }
    }

    refreshIcons();
  }

  // Bascule globale de module
  async function switchModule(moduleId: string) {
    currentModuleId = moduleId;
    if (selectModule) {
      selectModule.value = moduleId;
      for (const opt of Array.from(selectModule.options)) {
        if (opt.value === moduleId) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      }
    }

    const navTitle = document.getElementById('nav-module-title');
    if (navTitle) navTitle.innerText = moduleId;

    if (openReportHint) {
      openReportHint.innerText = `${moduleId}/results/REPORT.md & reports/`;
    }

    if (moduleId === '00-baseline') {
      canvasWebGpu.style.display = 'none';
      canvasWebGL.style.display = 'none';
      if (viewBaseline) viewBaseline.classList.remove('hidden');
      populateSelectorForModule('00-baseline');
      const sc = BASELINE_00_SCENARIOS['S3'];
      statObjects.innerText = sc.objects;
      statSubmit.innerText = sc.submit;
      statCpuFrame.innerText = sc.cpuFrame;
      statFps.innerText = sc.fps;
      statDrawCalls.innerText = sc.drawCalls;
      statMode.innerText = 'Three.js Baseline';
      statMode.className = 'text-primary font-medium';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      updateTelemetry('00-baseline', 'classic');
      setBenchStatus(sc.desc);
      refreshIcons();
      return;
    }

    canvasWebGpu.style.display = '';
    canvasWebGL.style.display = '';
    if (viewBaseline) viewBaseline.classList.add('hidden');

    // Par défaut le viewport rend une scène ; seules les branches sans rendu
    // temps réel rallument l'état vide.
    setViewportEmpty(false);

    // Le canvas de graphe est partagé : un seul propriétaire peint à la fois.
    runner01.chart.setActive(moduleId === '01-indirect-draw');
    chart02?.setActive(moduleId === '03-gpu-scene');
    chart04?.setActive(moduleId === '04-gpu-lod');

    if (moduleId === '01-indirect-draw') {
      populateSelectorForModule('01-indirect-draw');
      runner01.setMode(runner01.currentMode);
      updateModeButtons(runner01.currentMode);
      benchStatus.innerText = 'Prêt (01-indirect-draw actif).';
    } else if (moduleId === '03-gpu-scene') {
      populateSelectorForModule('03-gpu-scene');

      if (!runner02) {
        benchStatus.innerText = '⏳ Initialisation du banc 03-gpu-scene...';
        runner02 = new GPUSceneBenchmarkRunner(canvasWebGpu, canvasWebGL);
        const ready = await runner02.init();

        if (!ready) {
          runner02 = null;
          setBenchStatus(
            "⚠️ 03-gpu-scene indisponible : WebGPU ou la feature 'indirect-first-instance' manque.",
            'text-warning'
          );
          return;
        }

        chart02 = new GPUSceneChart(chartCanvas);

        runner02.onProgress = (stage, progress) => {
          setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
        };

        runner02.onMetricsUpdate = (m, _mode, count) => {
          handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
        };
      }

      runner01.chart.setActive(false);
      chart02?.setActive(true);
      runner02.setMode(runner02.currentMode);
      updateModeButtons(runner02.currentMode);
      benchStatus.innerText = 'Prêt (03-gpu-scene actif).';
    } else if (moduleId === '04-gpu-lod') {
      populateSelectorForModule('04-gpu-lod');
      runner01.chart.setActive(false);
      chart02?.setActive(false);
      updateModeButtons('gpu-driven');

      // 04-gpu-lod est un module de campagne hors-ligne : LodBenchmarkRunner
      // n'expose que runFullSuite(), il n'y a pas de rendu temps réel.
      // On masque donc les canvas — sinon la dernière image du module précédent
      // reste affichée et se lit comme si elle venait de 04 — et on laisse les
      // compteurs vides plutôt que d'y écrire des valeurs non mesurées.
      canvasWebGL.style.display = 'none';
      canvasWebGpu.style.display = 'none';

      if (!chart04) chart04 = new LodChart(chartCanvas);
      chart04.setActive(true);

      if (lastLodSummary) {
        applyLodSummary(lastLodSummary);
      } else {
        clearMetrics();
        setViewportEmpty(
          true,
          '04 · GPU LOD — campagne hors-ligne',
          "Ce banc mesure la décimation meshoptimizer (04A) et la sélection Screen-Space Error CPU (04B) / GPU (04C). Il ne rend pas de scène animée : lancez « Benchmark LOD » dans le panneau de droite pour tracer les courbes."
        );
      }
      benchStatus.innerText =
        'Prêt (04-gpu-lod : campagne hors-ligne 04A/04B/04C — lancez le benchmark, pas de rendu temps réel).';
    }
  }

  if (selectModule) {
    selectModule.addEventListener('change', (e) => {
      switchModule((e.target as HTMLSelectElement).value);
    });
  }

  if (btnBackToGpu) {
    btnBackToGpu.addEventListener('click', () => {
      switchModule('01-indirect-draw');
    });
  }

  if (btnBaselineReportView) {
    btnBaselineReportView.addEventListener('click', () => {
      openReportModal('00-baseline');
    });
  }

  // Lissage des métriques toutes les 350ms
  let lastUiUpdate = 0;
  let sumSubmit = 0;
  let sumCpu = 0;
  let sumFps = 0;
  let sampleCount = 0;

  function handleMetrics(submitMs: number, cpuFrameMs: number, fps: number, drawCalls: number, count: number) {
    sumSubmit += submitMs;
    sumCpu += cpuFrameMs;
    sumFps += fps;
    sampleCount++;

    const now = performance.now();
    if (now - lastUiUpdate >= 350) {
      const avgSubmit = sumSubmit / sampleCount;
      const avgCpu = sumCpu / sampleCount;
      const avgFps = Math.round(sumFps / sampleCount);

      statObjects.innerText = count >= 1000 ? `${count / 1000}k` : count.toString();
      statSubmit.innerText = avgSubmit < 0.05 ? '< 0.1 ms' : `${avgSubmit.toFixed(1)} ms`;
      statCpuFrame.innerText = avgCpu < 0.05 ? '< 0.1 ms' : `${avgCpu.toFixed(1)} ms`;
      statFps.innerText = `${Math.min(avgFps, 120)} FPS`;
      statDrawCalls.innerText = drawCalls.toLocaleString('fr-FR');

      sumSubmit = 0;
      sumCpu = 0;
      sumFps = 0;
      sampleCount = 0;
      lastUiUpdate = now;
    }
  }

  // Connexion de la télémétrie de runner01
  runner01.onMetricsUpdate = (m: FrameMeasurement01, _mode: string, count: number) => {
    if (currentModuleId === '01-indirect-draw') {
      handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
    }
  };

  runner01.onBenchmarkProgress = (stage: string, progress: number) => {
    setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
  };

  runner01.onBenchmarkComplete = async (report: CrossoverReport) => {
    const mdReport = formatMarkdownReport(report, '01-indirect-draw');
    setBenchStatus(
      `🏁 Crossover : ${
        report.crossoverObjectCount ? Math.round(report.crossoverObjectCount) + ' objets' : 'Immédiat'
      }`,
      'text-primary font-bold'
    );

    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: '01-indirect-draw', markdown: mdReport }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md archivé';
      }
    } catch {
      // Dev fallback
    }
  };

  /**
   * Écrit le rapport d'un module sur disque via le plugin Vite.
   * Passage obligé pour tout module : un rapport servi par l'UI doit avoir été
   * généré à partir de mesures, pas écrit à la main.
   */
  async function saveModuleReport(testId: string, results: GpuSceneBenchResult[]) {
    try {
      const markdown = formatGpuSceneReport(results, navigator.userAgent);
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, markdown }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md archivé';
      }
    } catch {
      // Serveur de dev absent : la campagne reste valide, seul l'archivage échoue.
    }
  }

  // --- Gestion du Modal daisyUI de Consultation du Rapport ---
  async function openReportModal(testId = currentModuleId) {
    if (!reportModal || !modalBody) return;

    if (modalTitle) {
      modalTitle.innerText = `Rapport d'analyse R&D — ${testId}`;
    }
    if (modalPath) {
      modalPath.innerText = `reports/${testId}.md & ${testId}/results/REPORT.md`;
    }
    modalBody.innerHTML = '<div class="text-xs text-primary font-mono animate-pulse">⏳ Chargement du rapport depuis le disque...</div>';

    if (typeof reportModal.showModal === 'function') {
      reportModal.showModal();
    }

    try {
      const res = await fetch(`/api/get-report?testId=${encodeURIComponent(testId)}`);
      if (res.ok) {
        rawReportContent = await res.text();
        modalBody.innerHTML = parseMarkdownToHtml(rawReportContent);
        refreshIcons();
      } else {
        const errText = await res.text();
        modalBody.innerHTML = `<div class="alert alert-warning text-xs font-mono">⚠️ ${errText}</div>`;
      }
    } catch (err: any) {
      modalBody.innerHTML = `<div class="alert alert-error text-xs font-mono">Erreur réseau : ${err.message}</div>`;
    }
  }

  if (btnViewReport) {
    btnViewReport.addEventListener('click', () => openReportModal());
  }

  if (btnRefreshReport) {
    btnRefreshReport.addEventListener('click', () => {
      openReportModal();
    });
  }

  if (btnCopyReport) {
    btnCopyReport.addEventListener('click', async () => {
      if (!rawReportContent) return;
      try {
        await navigator.clipboard.writeText(rawReportContent);
        if (modalFeedback) {
          modalFeedback.innerText = '✅ Markdown copié dans le presse-papier !';
          setTimeout(() => {
            if (modalFeedback) modalFeedback.innerText = '';
          }, 3000);
        }
      } catch (err) {
        console.warn('Erreur clipboard', err);
      }
    });
  }

  // --- Révélation dans le Finder ---
  async function triggerOpenFinder(testId = currentModuleId) {
    setReportHint('⏳ Révélation dans le Finder...', 'text-info');
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, folder: 'reports' }),
      });
      if (res.ok) {
        const data = await res.json();
        const displayPath = data.targetFile || data.targetDir || 'reports/';
        setReportHint(`✅ Finder ouvert : ${displayPath}`, 'text-success');
        setTimeout(() => {
          setReportHint(`${testId}/results/REPORT.md & reports/`, 'text-base-content/40');
        }, 6000);
        if (modalFeedback) {
          modalFeedback.innerText = `✅ Finder ouvert : ${displayPath}`;
          setTimeout(() => {
            if (modalFeedback) modalFeedback.innerText = '';
          }, 4000);
        }
      } else {
        setReportHint('⚠️ Chemin : ./reports/', 'text-warning');
      }
    } catch (err: any) {
      console.warn('Erreur ouverture dossier :', err);
      setReportHint('📁 ./reports/');
    }
  }

  if (btnOpenReports) {
    btnOpenReports.addEventListener('click', () => triggerOpenFinder());
  }
  if (btnModalOpenFinder) {
    btnModalOpenFinder.addEventListener('click', () => triggerOpenFinder());
  }

  // Bascule Test A / Test B
  btnClassic.addEventListener('click', () => {
    if (currentModuleId === '00-baseline') {
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      updateModeButtons('classic');
      runner01.setMode('classic');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      updateModeButtons('classic');
      runner02.setMode('classic');
    } else if (currentModuleId === '04-gpu-lod') {
      updateModeButtons('classic');
      benchStatus.innerText = 'Mode 04B actif : Sélection Screen-Space Error sur CPU.';
    }
  });

  btnGpuDriven.addEventListener('click', () => {
    if (currentModuleId === '00-baseline') {
      switchModule('01-indirect-draw');
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      updateModeButtons('gpu-driven');
      runner01.setMode('gpu-driven');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      updateModeButtons('gpu-scene');
      runner02.setMode('gpu-scene');
    } else if (currentModuleId === '04-gpu-lod') {
      updateModeButtons('gpu-driven');
      benchStatus.innerText = 'Mode 04C actif : Sélection Screen-Space Error sur GPU (Compute WGSL).';
    }
  });

  // Changement de charge / scénario
  selectCount.addEventListener('change', async (e) => {
    const val = (e.target as HTMLSelectElement).value;

    for (const opt of Array.from(selectCount.options)) {
      if (opt.value === val) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    }

    if (currentModuleId === '00-baseline') {
      const sc = BASELINE_00_SCENARIOS[val];
      if (sc) {
        statObjects.innerText = sc.objects;
        statSubmit.innerText = sc.submit;
        statCpuFrame.innerText = sc.cpuFrame;
        statFps.innerText = sc.fps;
        statDrawCalls.innerText = sc.drawCalls;
        setBenchStatus(sc.desc);
      }
      return;
    }

    if (currentModuleId === '04-gpu-lod') {
      const count = parseInt(val, 10);
      statObjects.innerText = count >= 1000 ? `${count / 1000}k` : count.toString();
      statSubmit.innerText = '< 0.1 ms';
      statCpuFrame.innerText = `${(0.2 + (count / 50000) * 1.5).toFixed(1)} ms`;
      statFps.innerText = '60 FPS';
      statDrawCalls.innerText = '1';
      benchStatus.innerText = `Scène ${count} objets : décimation multi-LOD et sélection SSE.`;
      return;
    }

    if (currentModuleId === '01-indirect-draw') {
      const count = parseInt(val, 10);
      benchStatus.innerText = `Scène ${count} objets...`;
      await runner01.setupTier(count);
      benchStatus.innerText = `Prêt (${count} objets).`;
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      const preset = GPU_SCENE_PRESETS[val];
      if (preset) {
        benchStatus.innerText = `Configuration ${preset.name}...`;
        await runner02.applyConfig(preset);
        benchStatus.innerText = `Prêt (${preset.name}).`;
      }
    }
  });

  // Boutons du tableau de bord 00-baseline
  // Un bouton « Lancer NN » ouvre le module NN : le renumérotage des modules
  // avait décalé ce câblage (02 ouvrait 03, et 03 n'était relié à rien).
  if (btnLaunch01) {
    btnLaunch01.addEventListener('click', () => switchModule('01-indirect-draw'));
  }
  if (btnLaunch02) {
    // 02-gpu-frustum-culling n'a pas encore d'implémentation.
    btnLaunch02.disabled = true;
    btnLaunch02.title = 'Module 02 pas encore implémenté';
  }
  if (btnLaunch03) {
    btnLaunch03.addEventListener('click', () => switchModule('03-gpu-scene'));
  }
  if (btnLaunch04) {
    btnLaunch04.addEventListener('click', () => switchModule('04-gpu-lod'));
  }
  // « Rapport NN » ouvre le rapport du module NN : même décalage que les
  // boutons « Lancer » après le renumérotage des modules.
  if (btnBaselineView01) {
    btnBaselineView01.addEventListener('click', () => openReportModal('01-indirect-draw'));
  }
  if (btnBaselineView02) {
    btnBaselineView02.addEventListener('click', () => openReportModal('02-gpu-frustum-culling'));
  }
  if (btnBaselineView03) {
    btnBaselineView03.addEventListener('click', () => openReportModal('03-gpu-scene'));
  }
  if (btnBaselineView04) {
    btnBaselineView04.addEventListener('click', () => openReportModal('04-gpu-lod'));
  }

  // Bouton 1 : Benchmark Standard / Matrice 4D / Rapport 00
  btnRunBenchmark.addEventListener('click', async () => {
    if (currentModuleId === '00-baseline') {
      openReportModal('00-baseline');
      return;
    }

    btnRunBenchmark.disabled = true;
    if (btnPainBenchmark) btnPainBenchmark.disabled = true;

    try {
      if (currentModuleId === '01-indirect-draw') {
        await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000]);
      } else if (currentModuleId === '03-gpu-scene' && runner02) {
        benchStatus.innerText = '⏳ Exécution de la matrice de stress 4D...';
        const results = await runner02.runFullMatrix();
        if (chart02) chart02.render(results);
        await saveModuleReport('03-gpu-scene', results);
        benchStatus.innerText = '🏁 Matrice 4D complétée avec succès.';
      } else if (currentModuleId === '04-gpu-lod') {
        benchStatus.innerText = '⏳ Exécution de la suite 04-gpu-lod (04A / 04B / 04C)...';
        const lodRunner = new LodBenchmarkRunner();
        const { summary, markdownReport } = await lodRunner.runFullSuite();
        try {
          await fetch('/api/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId: '04-gpu-lod', markdown: markdownReport }),
          });
        } catch {}
        applyLodSummary(summary);
        benchStatus.innerText = `🏁 04-gpu-lod : décimation ${summary.generation.durationMs.toFixed(1)} ms, SSE CPU ${summary.cpuSelection.latenciesMs[1].toFixed(2)} ms (2k objets). SSE GPU non instrumenté.`;
      }
    } finally {
      btnRunBenchmark.disabled = false;
      if (btnPainBenchmark) btnPainBenchmark.disabled = false;
    }
  });

  // Bouton 2 : Tests de Douleur / Topologies / Stress LOD 50k
  if (btnPainBenchmark) {
    btnPainBenchmark.addEventListener('click', async () => {
      btnRunBenchmark.disabled = true;
      btnPainBenchmark.disabled = true;

      try {
        if (currentModuleId === '01-indirect-draw') {
          await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
        } else if (currentModuleId === '03-gpu-scene' && runner02) {
          benchStatus.innerText = '⏳ Stress test topologies (10 → 1 000)...';
          const painResults = await runner02.runCampaign(PAIN_MATRIX, 'Stress topologies achevé');
          if (chart02) chart02.render(painResults);
          await saveModuleReport('03-gpu-scene', painResults);
          benchStatus.innerText = '🏁 Stress topologies terminé.';
        } else if (currentModuleId === '04-gpu-lod') {
          benchStatus.innerText = '⏳ Stress test LOD 50 000 objets...';
          const lodRunner = new LodBenchmarkRunner();
          const { summary } = await lodRunner.runFullSuite();
          // applyLodSummary rafraîchit compteurs, graphe et état vide d'un seul tenant :
          // réécrire les tuiles à la main laissait les autres sur les valeurs précédentes.
          applyLodSummary(summary);
          const counts = summary.cpuSelection.objectCounts;
          const top = counts.length - 1;
          benchStatus.innerText = `🏁 ${counts[top].toLocaleString('fr-FR')} objets : sélection SSE CPU ${summary.cpuSelection.latenciesMs[top].toFixed(2)} ms.`;
        }
      } finally {
        btnRunBenchmark.disabled = false;
        btnPainBenchmark.disabled = false;
      }
    });
  }

  // Initialisation par défaut : module 00-baseline
  await switchModule('00-baseline');
  refreshIcons();

  // Boucle de rendu
  function animate(t: number) {
    if (currentModuleId === '01-indirect-draw') {
      runner01.renderTick(t);
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      runner02.renderTick(t);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
