import '../src/style.css';
import { BenchmarkRunner } from './benchmark/runner.ts';
import { formatMarkdownReport } from './benchmark/reporter.ts';
import type { FrameMeasurement, CrossoverReport } from './types.ts';

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

  // Citations / blockquote avec bordure primaire sobre
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

  // Traitement des tables Markdown en daisyUI table table-zebra table-sm
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
        i++; // Sauter la ligne de séparation
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

  // Dialog daisyUI natif
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

  const runner = new BenchmarkRunner(canvasWebGpu, canvasWebGL, chartCanvas);
  const webGpuSupported = await runner.init();

  if (!webGpuSupported) {
    benchStatus.innerText = '⚠️ WebGPU non disponible. Mode secours actif.';
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-warning';
  } else {
    benchStatus.innerText = '✅ WebGPU natif actif (Metal / Direct3D / Vulkan)';
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-base-content/80';
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
    runner.resize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // Gestion du sélecteur de module (01-gpu-driven vs 00-baseline)
  function switchModule(moduleId: string) {
    currentModuleId = moduleId;
    if (selectModule) selectModule.value = moduleId;

    const navTitle = document.getElementById('nav-module-title');
    if (navTitle) navTitle.innerText = moduleId;

    if (moduleId === '00-baseline') {
      canvasWebGpu.style.display = 'none';
      canvasWebGL.style.display = 'none';
      if (viewBaseline) viewBaseline.classList.remove('hidden');
    } else {
      if (viewBaseline) viewBaseline.classList.add('hidden');
      runner.setMode(runner.currentMode);
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

  // Mise à jour visuelle des boutons Test A / Test B avec daisyUI (Cohérence Nordic)
  function updateModeButtons(mode: 'classic' | 'gpu-driven') {
    const telemetryMode = document.getElementById('viewport-telemetry-mode');
    const telemetryDetail = document.getElementById('viewport-telemetry-detail');

    if (mode === 'classic') {
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-primary text-primary-content font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = 'Test A (Three.js)';
      statMode.className = 'text-primary font-medium';
      if (telemetryMode) telemetryMode.innerText = 'Three.js WebGL Pipeline';
      if (telemetryDetail) telemetryDetail.innerText = 'CPU Frustum Culling + Draw Calls';
    } else {
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-primary text-primary-content font-medium shadow-xs';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = 'Test B (GPU-Driven)';
      statMode.className = 'text-primary font-medium';
      if (telemetryMode) telemetryMode.innerText = 'WebGPU Native Pipeline';
      if (telemetryDetail) telemetryDetail.innerText = 'Indirect Draw + WGSL Culling';
    }
  }

  // Lissage des métriques toutes les 350ms
  let lastUiUpdate = 0;
  let sumSubmit = 0;
  let sumCpu = 0;
  let sumFps = 0;
  let sampleCount = 0;

  runner.onMetricsUpdate = (m: FrameMeasurement, _mode: string, count: number) => {
    sumSubmit += m.submitMs;
    sumCpu += m.cpuFrameMs;
    sumFps += m.fps;
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
      statDrawCalls.innerText = m.drawCalls.toLocaleString('fr-FR');

      sumSubmit = 0;
      sumCpu = 0;
      sumFps = 0;
      sampleCount = 0;
      lastUiUpdate = now;
    }
  };

  runner.onBenchmarkProgress = (stage: string, progress: number) => {
    benchStatus.innerText = `⏳ [${Math.round(progress * 100)}%] ${stage}...`;
    benchStatus.className = 'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight text-primary';
  };

  runner.onBenchmarkComplete = async (report: CrossoverReport) => {
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
      // Dev mode fallback
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
              openReportHint.innerText = '01-gpu-driven/results/REPORT.md & reports/';
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

  // Bascule instantanée entre Test A (Three.js) et Test B (GPU-Driven)
  btnClassic.addEventListener('click', () => {
    updateModeButtons('classic');
    runner.setMode('classic');
  });

  btnGpuDriven.addEventListener('click', () => {
    updateModeButtons('gpu-driven');
    runner.setMode('gpu-driven');
  });

  selectCount.addEventListener('change', async (e) => {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    benchStatus.innerText = `Scène ${val} objets...`;
    await runner.setupTier(val);
    benchStatus.innerText = `Prêt (${val} objets).`;
  });

  const btnPainBenchmark = document.getElementById('btn-pain-benchmark') as HTMLButtonElement | null;

  btnRunBenchmark.addEventListener('click', async () => {
    btnRunBenchmark.disabled = true;
    if (btnPainBenchmark) btnPainBenchmark.disabled = true;
    try {
      await runner.runAutomatedBenchmark([500, 1000, 2000, 5000]);
    } finally {
      btnRunBenchmark.disabled = false;
      if (btnPainBenchmark) btnPainBenchmark.disabled = false;
    }
  });

  if (btnPainBenchmark) {
    btnPainBenchmark.addEventListener('click', async () => {
      btnRunBenchmark.disabled = true;
      btnPainBenchmark.disabled = true;
      try {
        await runner.runAutomatedBenchmark([500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
      } finally {
        btnRunBenchmark.disabled = false;
        btnPainBenchmark.disabled = false;
      }
    });
  }

  // Initialisation de l'état des boutons au lancement
  updateModeButtons('gpu-driven');

  // Boucle d'animation
  function animate(t: number) {
    runner.renderTick(t);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
