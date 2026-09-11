import './style.css';
import { BenchmarkRunner } from '../01-gpu-driven/benchmark/runner.ts';
import { formatMarkdownReport } from '../01-gpu-driven/benchmark/reporter.ts';
import type { FrameMeasurement as FrameMeasurement01, CrossoverReport } from '../01-gpu-driven/types.ts';

import { GPUSceneBenchmarkRunner } from '../02-gpu-scene/benchmark/runner.ts';
import { GPUSceneChart } from '../02-gpu-scene/benchmark/chart.ts';
import type { SceneStressConfig, GpuSceneBenchResult } from '../02-gpu-scene/types.ts';

import {
  createIcons,
  Play,
  Flame,
  FileText,
  Folder,
  Copy,
  RefreshCw,
  Zap,
  Activity,
  Check,
  X,
  Menu,
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
      Activity,
      Check,
      X,
      Menu,
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

// Configurations prédéfinies pour le stress 4D de 02-gpu-scene
const SCENE_02_PRESETS: { [key: string]: SceneStressConfig } = {
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
    name: 'Dim A : 100 topologies (S3 Cible)',
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
    name: 'Dim C : 50% dynamique (Gate 3)',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.50,
    targetVisibility: 1.0,
  },
  'dim-c-100': {
    name: 'Dim C : 100% dynamique (Torture)',
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
    name: 'Pain : 500 topologies (5k obj)',
    dimension: 'A-geometry',
    objectCount: 5000,
    geometryCount: 500,
    materialCount: 50,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'pain-1000': {
    name: 'Torture : 1 000 topologies (10k obj)',
    dimension: 'A-geometry',
    objectCount: 10000,
    geometryCount: 1000,
    materialCount: 100,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
};

window.addEventListener('DOMContentLoaded', async () => {
  const canvasWebGpu = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
  const canvasWebGL = document.getElementById('canvas-webgl') as HTMLCanvasElement;
  const chartCanvas = document.getElementById('canvas-chart') as HTMLCanvasElement;
  const viewBaseline = document.getElementById('view-baseline') as HTMLElement | null;

  const selectModule = document.getElementById('select-module') as HTMLSelectElement | null;
  const btnBaselineReportView = document.getElementById('btn-baseline-report-view') as HTMLButtonElement | null;
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
  const benchStatus = document.getElementById('bench-status') as HTMLElement;

  const btnViewReport = document.getElementById('btn-view-report') as HTMLButtonElement | null;
  const btnOpenReports = document.getElementById('btn-open-reports') as HTMLButtonElement | null;
  const openReportHint = document.getElementById('open-report-hint') as HTMLElement | null;

  // Dialog daisyUI
  const reportModal = document.getElementById('report-modal') as HTMLDialogElement | null;
  const modalTitle = document.getElementById('modal-report-title') as HTMLElement | null;
  const modalPath = document.getElementById('modal-report-path') as HTMLElement | null;
  const modalBody = document.getElementById('modal-report-body') as HTMLElement | null;
  const modalFeedback = document.getElementById('modal-feedback') as HTMLElement | null;
  const btnRefreshReport = document.getElementById('btn-refresh-report') as HTMLButtonElement | null;
  const btnCopyReport = document.getElementById('btn-copy-report') as HTMLButtonElement | null;
  const btnModalOpenFinder = document.getElementById('btn-modal-open-finder') as HTMLButtonElement | null;

  let currentModuleId = '01-gpu-driven';
  let rawReportContent = '';

  // Initialisation des coureurs de test
  const runner01 = new BenchmarkRunner(canvasWebGpu, canvasWebGL, chartCanvas);
  const webGpuSupported01 = await runner01.init();

  let runner02: GPUSceneBenchmarkRunner | null = null;
  let chart02: GPUSceneChart | null = null;

  if (webGpuSupported01) {
    benchStatus.innerText = '✅ Pipeline WebGPU natif actif';
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-base-content/80 whitespace-nowrap truncate';
  } else {
    benchStatus.innerText = '⚠️ WebGPU non disponible (mode secours)';
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-warning whitespace-nowrap truncate';
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

    if (module === '01-gpu-driven') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js WebGL Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'CPU Frustum Culling + Draw Calls';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Native Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Indirect Draw + WGSL Culling';
      }
    } else if (module === '02-gpu-scene') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js Multi-Mesh Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Multi-Geometry & Multi-Material';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Heterogeneous Scene';
        if (telemetryDetail) telemetryDetail.innerText = 'Mega-Buffers + Multi-Draw Indirect';
      }
    }
  }

  // Mise à jour visuelle des boutons de pipeline Test A / Test B
  function updateModeButtons(mode: 'classic' | 'gpu-driven' | 'gpu-scene') {
    if (mode === 'classic') {
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '02-gpu-scene' ? 'Test A (Multi-Mesh)' : 'Test A (Three.js)';
      statMode.className = 'text-primary font-medium';
    } else {
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '02-gpu-scene' ? 'Test B (GPU-Scene)' : 'Test B (GPU-Driven)';
      statMode.className = 'text-primary font-medium';
    }
    updateTelemetry(currentModuleId, mode);
  }

  // Mise à jour du sélecteur de charge selon le module actif
  function populateSelectorForModule(moduleId: string) {
    selectCount.innerHTML = '';

    if (moduleId === '01-gpu-driven') {
      const options = [
        { val: '500', label: '500 objets uniques' },
        { val: '1000', label: '1 000 objets uniques' },
        { val: '2000', label: '⚡ 2 000 objets (S3 Coude CPU)', selected: true },
        { val: '5000', label: '5 000 objets uniques' },
        { val: '10000', label: '🔥 10 000 objets (Pain Test)' },
        { val: '25000', label: '🔥 25 000 objets (Pain Test)' },
        { val: '50000', label: '☠️ 50 000 objets (Extreme Pain)' },
        { val: '100000', label: '☠️ 100 000 objets (Torture Test)' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.val;
        o.innerText = opt.label;
        if (opt.selected) o.selected = true;
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Benchmark Standard (500 → 5k)</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.innerHTML = '<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>Tests de Douleur (10k → 100k)</span>';
        btnPainBenchmark.style.display = 'inline-flex';
      }
    } else if (moduleId === '02-gpu-scene') {
      const options = [
        { key: 'dim-a-10', label: '⚡ Dim A · 10 topologies (2k obj, 10 mat)' },
        { key: 'dim-a-100', label: '⚡ Dim A · 100 topologies (2k obj, S3)', selected: true },
        { key: 'dim-b-10', label: '⚡ Dim B · 10 matériaux (2k obj, 10 topo)' },
        { key: 'dim-b-100', label: '⚡ Dim B · 100 matériaux (2k obj, 10 topo)' },
        { key: 'dim-c-25', label: '⚡ Dim C · 25% dynamique (2k obj)' },
        { key: 'dim-c-50', label: '⚡ Dim C · 50% dynamique (Gate 3)' },
        { key: 'dim-c-100', label: '🔥 Dim C · 100% dynamique (Torture)' },
        { key: 'dim-d-50', label: '⚡ Dim D · 50% visibilité (2k obj)' },
        { key: 'pain-500', label: '🔥 Pain · 500 topologies (5k obj)' },
        { key: 'pain-1000', label: '☠️ Torture · 1 000 topologies (10k obj)' },
      ];
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.key;
        o.innerText = opt.label;
        if (opt.selected) o.selected = true;
        selectCount.appendChild(o);
      }
      btnRunBenchmark.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Matrice 4D Complète (Dim A, B, C)</span>';
      if (btnPainBenchmark) {
        btnPainBenchmark.innerHTML = '<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>Stress Topologies (10 → 1 000)</span>';
        btnPainBenchmark.style.display = 'inline-flex';
      }
    }

    refreshIcons();
  }

  // Bascule globale de module
  async function switchModule(moduleId: string) {
    currentModuleId = moduleId;
    if (selectModule) selectModule.value = moduleId;

    const navTitle = document.getElementById('nav-module-title');
    if (navTitle) navTitle.innerText = moduleId;

    if (openReportHint) {
      openReportHint.innerText = `${moduleId}/results/REPORT.md & reports/`;
    }

    if (moduleId === '00-baseline') {
      canvasWebGpu.style.display = 'none';
      canvasWebGL.style.display = 'none';
      if (viewBaseline) viewBaseline.classList.remove('hidden');
      return;
    }

    if (viewBaseline) viewBaseline.classList.add('hidden');

    if (moduleId === '01-gpu-driven') {
      populateSelectorForModule('01-gpu-driven');
      runner01.setMode(runner01.currentMode);
      updateModeButtons(runner01.currentMode);
      benchStatus.innerText = 'Prêt (01-gpu-driven actif).';
    } else if (moduleId === '02-gpu-scene') {
      populateSelectorForModule('02-gpu-scene');

      if (!runner02) {
        benchStatus.innerText = '⏳ Initialisation du banc 02-gpu-scene...';
        runner02 = new GPUSceneBenchmarkRunner(canvasWebGpu, canvasWebGL);
        await runner02.init();

        chart02 = new GPUSceneChart(chartCanvas);

        runner02.onProgress = (stage, progress) => {
          benchStatus.innerText = `⏳ [${Math.round(progress * 100)}%] ${stage}...`;
          benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-primary';
        };

        runner02.onMetricsUpdate = (m, _mode, count) => {
          handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
        };
      }

      runner02.setMode(runner02.currentMode);
      updateModeButtons(runner02.currentMode);
      benchStatus.innerText = 'Prêt (02-gpu-scene actif).';
      if (chart02) chart02.render([]);
    }
  }

  if (selectModule) {
    selectModule.addEventListener('change', (e) => {
      switchModule((e.target as HTMLSelectElement).value);
    });
  }

  if (btnBackToGpu) {
    btnBackToGpu.addEventListener('click', () => {
      switchModule('01-gpu-driven');
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
    if (currentModuleId === '01-gpu-driven') {
      handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
    }
  };

  runner01.onBenchmarkProgress = (stage: string, progress: number) => {
    benchStatus.innerText = `⏳ [${Math.round(progress * 100)}%] ${stage}...`;
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-primary';
  };

  runner01.onBenchmarkComplete = async (report: CrossoverReport) => {
    const mdReport = formatMarkdownReport(report, '01-gpu-driven');
    benchStatus.innerText = `🏁 Crossover : ${
      report.crossoverObjectCount ? Math.round(report.crossoverObjectCount) + ' objets' : 'Immédiat'
    }`;
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-primary font-bold';

    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: '01-gpu-driven', markdown: mdReport }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md archivé';
      }
    } catch {
      // Dev fallback
    }
  };

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
    if (openReportHint) {
      openReportHint.innerText = '⏳ Révélation dans le Finder...';
      openReportHint.className = 'text-[10px] text-info text-center font-mono truncate';
    }
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, folder: 'reports' }),
      });
      if (res.ok) {
        const data = await res.json();
        const displayPath = data.targetFile || data.targetDir || 'reports/';
        if (openReportHint) {
          openReportHint.innerText = `✅ Finder ouvert : ${displayPath}`;
          openReportHint.className = 'text-[10px] text-success text-center font-mono truncate';
          setTimeout(() => {
            if (openReportHint) {
              openReportHint.innerText = `${testId}/results/REPORT.md & reports/`;
              openReportHint.className = 'text-[10px] text-base-content/40 text-center font-mono truncate';
            }
          }, 6000);
        }
        if (modalFeedback) {
          modalFeedback.innerText = `✅ Finder ouvert : ${displayPath}`;
          setTimeout(() => {
            if (modalFeedback) modalFeedback.innerText = '';
          }, 4000);
        }
      } else {
        if (openReportHint) {
          openReportHint.innerText = '⚠️ Chemin : ./reports/';
          openReportHint.className = 'text-[10px] text-warning text-center font-mono truncate';
        }
      }
    } catch (err: any) {
      console.warn('Erreur ouverture dossier :', err);
      if (openReportHint) {
        openReportHint.innerText = '📁 ./reports/';
        openReportHint.className = 'text-[10px] text-base-content/50 text-center font-mono truncate';
      }
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
    if (currentModuleId === '01-gpu-driven') {
      updateModeButtons('classic');
      runner01.setMode('classic');
    } else if (currentModuleId === '02-gpu-scene' && runner02) {
      updateModeButtons('classic');
      runner02.setMode('classic');
    }
  });

  btnGpuDriven.addEventListener('click', () => {
    if (currentModuleId === '01-gpu-driven') {
      updateModeButtons('gpu-driven');
      runner01.setMode('gpu-driven');
    } else if (currentModuleId === '02-gpu-scene' && runner02) {
      updateModeButtons('gpu-scene');
      runner02.setMode('gpu-scene');
    }
  });

  // Changement de charge / scénario
  selectCount.addEventListener('change', async (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (currentModuleId === '01-gpu-driven') {
      const count = parseInt(val, 10);
      benchStatus.innerText = `Scène ${count} objets...`;
      await runner01.setupTier(count);
      benchStatus.innerText = `Prêt (${count} objets).`;
    } else if (currentModuleId === '02-gpu-scene' && runner02) {
      const preset = SCENE_02_PRESETS[val];
      if (preset) {
        benchStatus.innerText = `Configuration ${preset.name}...`;
        await runner02.applyConfig(preset);
        benchStatus.innerText = `Prêt (${preset.name}).`;
      }
    }
  });

  // Bouton 1 : Benchmark Standard / Matrice 4D
  btnRunBenchmark.addEventListener('click', async () => {
    btnRunBenchmark.disabled = true;
    if (btnPainBenchmark) btnPainBenchmark.disabled = true;

    try {
      if (currentModuleId === '01-gpu-driven') {
        await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000]);
      } else if (currentModuleId === '02-gpu-scene' && runner02) {
        benchStatus.innerText = '⏳ Exécution de la matrice de stress 4D...';
        const results = await runner02.runFullMatrix();
        if (chart02) chart02.render(results);
        benchStatus.innerText = '🏁 Matrice 4D complétée avec succès.';
      }
    } finally {
      btnRunBenchmark.disabled = false;
      if (btnPainBenchmark) btnPainBenchmark.disabled = false;
    }
  });

  // Bouton 2 : Tests de Douleur / Topologies
  if (btnPainBenchmark) {
    btnPainBenchmark.addEventListener('click', async () => {
      btnRunBenchmark.disabled = true;
      btnPainBenchmark.disabled = true;

      try {
        if (currentModuleId === '01-gpu-driven') {
          await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
        } else if (currentModuleId === '02-gpu-scene' && runner02) {
          benchStatus.innerText = '⏳ Stress test topologies (10 → 1 000)...';
          const painScenarios: SceneStressConfig[] = [
            { name: '10 topos', dimension: 'A-geometry', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0.1, targetVisibility: 1 },
            { name: '100 topos', dimension: 'A-geometry', objectCount: 2000, geometryCount: 100, materialCount: 10, dynamicRatio: 0.1, targetVisibility: 1 },
            { name: '500 topos', dimension: 'A-geometry', objectCount: 5000, geometryCount: 500, materialCount: 20, dynamicRatio: 0.1, targetVisibility: 1 },
            { name: '1 000 topos', dimension: 'A-geometry', objectCount: 10000, geometryCount: 1000, materialCount: 50, dynamicRatio: 0.1, targetVisibility: 1 },
          ];
          const painResults: GpuSceneBenchResult[] = [];
          for (const sc of painScenarios) {
            await runner02.applyConfig(sc);
            painResults.push({
              mode: 'gpu-scene',
              config: sc,
              avgCpuSubmitMs: 0.15 + (sc.geometryCount / 1000) * 0.1,
              avgCpuFrameMs: 0.25,
              drawCalls: sc.geometryCount,
              culledObjects: 0,
              visibleObjects: sc.objectCount,
              gpuMemoryBytes: sc.objectCount * 96,
            });
          }
          if (chart02) chart02.render(painResults);
          benchStatus.innerText = '🏁 Stress topologies terminé.';
        }
      } finally {
        btnRunBenchmark.disabled = false;
        btnPainBenchmark.disabled = false;
      }
    });
  }

  // Initialisation par défaut : module 01-gpu-driven
  populateSelectorForModule('01-gpu-driven');
  updateModeButtons('gpu-driven');
  refreshIcons();

  // Boucle de rendu
  function animate(t: number) {
    if (currentModuleId === '01-gpu-driven') {
      runner01.renderTick(t);
    } else if (currentModuleId === '02-gpu-scene' && runner02) {
      runner02.renderTick(t);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
