import { BenchmarkRunner } from './benchmark/runner.ts';
import { formatMarkdownReport } from './benchmark/reporter.ts';
import type { FrameMeasurement, CrossoverReport } from './types.ts';

// Parser Markdown vers HTML propre et sécurisé
function parseMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Blocs de code ```...```
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Titres #, ##, ###
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Citations / blockquote >
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Séparateur horizontal ---
  html = html.replace(/^---$/gim, '<hr>');

  // Gras **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Code inline `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Math KaTeX basique $...$
  html = html.replace(/\$([^\$]+)\$/g, '<code style="color: #a5f3fc; background: #0c1a2e;">$1</code>');

  // Listes à puces - item
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');

  // Traitement des tables Markdown (| th | th | ...)
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
        result.push('<table>');
      }

      if (isSep) {
        const cells = line.split('|').slice(1, -1).map((c) => `<th>${c.trim()}</th>`).join('');
        result.push(`<thead><tr>${cells}</tr></thead><tbody>`);
        i++; // Sauter le séparateur
        continue;
      }

      const cells = line.split('|').slice(1, -1).map((c) => `<td>${c.trim()}</td>`).join('');
      result.push(`<tr>${cells}</tr>`);
    } else {
      if (inTable) {
        result.push('</tbody></table>');
        inTable = false;
      }
      if (line.length > 0) {
        if (
          !line.startsWith('<h') &&
          !line.startsWith('<blockquote') &&
          !line.startsWith('<pre') &&
          !line.startsWith('<hr') &&
          !line.startsWith('<li>') &&
          !line.startsWith('<table')
        ) {
          result.push(`<p>${line}</p>`);
        } else {
          result.push(line);
        }
      }
    }
  }
  if (inTable) {
    result.push('</tbody></table>');
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

  // Éléments du Modal Rapport
  const reportModal = document.getElementById('report-modal') as HTMLElement | null;
  const modalTitle = document.getElementById('modal-report-title') as HTMLElement | null;
  const modalPath = document.getElementById('modal-report-path') as HTMLElement | null;
  const modalBody = document.getElementById('modal-report-body') as HTMLElement | null;
  const modalFeedback = document.getElementById('modal-feedback') as HTMLElement | null;
  const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement | null;
  const btnModalClose = document.getElementById('btn-modal-close') as HTMLButtonElement | null;
  const btnRefreshReport = document.getElementById('btn-refresh-report') as HTMLButtonElement | null;
  const btnCopyReport = document.getElementById('btn-copy-report') as HTMLButtonElement | null;
  const btnModalOpenFinder = document.getElementById('btn-modal-open-finder') as HTMLButtonElement | null;

  let currentModuleId = '01-gpu-driven';
  let rawReportContent = '';

  const runner = new BenchmarkRunner(canvasWebGpu, canvasWebGL, chartCanvas);
  const webGpuSupported = await runner.init();

  if (!webGpuSupported) {
    benchStatus.innerText = '⚠️ WebGPU natif non disponible sur ce navigateur. Mode émulation/secours actif.';
    benchStatus.style.color = '#f59e0b';
  } else {
    benchStatus.innerText = '✅ WebGPU natif actif (Metal / Direct3D / Vulkan backend détecté)';
    benchStatus.style.color = '#10b981';
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

    if (moduleId === '00-baseline') {
      canvasWebGpu.style.display = 'none';
      canvasWebGL.style.display = 'none';
      if (viewBaseline) viewBaseline.style.display = 'block';
    } else {
      if (viewBaseline) viewBaseline.style.display = 'none';
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

  // Lissage et stabilisation des métriques (mise à jour toutes les 350ms)
  let lastUiUpdate = 0;
  let sumSubmit = 0;
  let sumCpu = 0;
  let sumFps = 0;
  let sampleCount = 0;

  runner.onMetricsUpdate = (m: FrameMeasurement, mode: string, count: number) => {
    sumSubmit += m.submitMs;
    sumCpu += m.cpuFrameMs;
    sumFps += m.fps;
    sampleCount++;

    const now = performance.now();
    if (now - lastUiUpdate >= 350) {
      const avgSubmit = sumSubmit / sampleCount;
      const avgCpu = sumCpu / sampleCount;
      const avgFps = Math.round(sumFps / sampleCount);

      statMode.innerText = mode === 'classic' ? 'Test A (Three.js WebGL)' : 'Test B (GPU-Driven WebGPU)';
      statMode.style.color = mode === 'classic' ? '#ef4444' : '#06b6d4';
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
    benchStatus.style.color = '#38bdf8';
  };

  runner.onBenchmarkComplete = async (report: CrossoverReport) => {
    const mdReport = formatMarkdownReport(report, '01-gpu-driven');
    benchStatus.innerText = `🏁 Benchmark terminé ! Crossover : ${
      report.crossoverObjectCount ? Math.round(report.crossoverObjectCount) + ' objets' : 'Immédiat'
    }`;
    benchStatus.style.color = '#10b981';

    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: '01-gpu-driven', markdown: mdReport }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md actualisé sur disque';
      }
    } catch {
      // Dev mode fallback
    }
  };

  // --- Gestion du Modal de Consultation du Rapport ---
  async function openReportModal(testId = currentModuleId) {
    if (!reportModal || !modalBody) return;

    if (modalTitle) {
      modalTitle.innerText = `Rapport d'analyse R&D — ${testId}`;
    }
    if (modalPath) {
      modalPath.innerText = `reports/${testId}.md & ${testId}/results/REPORT.md`;
    }
    modalBody.innerHTML = '<div style="color: #38bdf8;">⏳ Chargement du rapport depuis le disque...</div>';
    reportModal.style.display = 'flex';

    try {
      const res = await fetch(`/api/get-report?testId=${encodeURIComponent(testId)}`);
      if (res.ok) {
        rawReportContent = await res.text();
        modalBody.innerHTML = parseMarkdownToHtml(rawReportContent);
      } else {
        const errText = await res.text();
        modalBody.innerHTML = `<div style="color: #f87171;">⚠️ ${errText}</div>`;
      }
    } catch (err: any) {
      modalBody.innerHTML = `<div style="color: #f87171;">Erreur réseau : ${err.message}</div>`;
    }
  }

  function closeReportModal() {
    if (reportModal) {
      reportModal.style.display = 'none';
    }
  }

  if (btnViewReport) {
    btnViewReport.addEventListener('click', () => openReportModal());
  }
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeReportModal);
  }
  if (btnModalClose) {
    btnModalClose.addEventListener('click', closeReportModal);
  }
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) closeReportModal();
    });
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

  // --- Gestion de l'ouverture du dossier Finder / Explorateur ---
  async function triggerOpenFinder(testId = currentModuleId) {
    if (openReportHint) {
      openReportHint.innerText = '⏳ Ouverture du Finder...';
      openReportHint.style.color = '#38bdf8';
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
          openReportHint.innerText = `✅ Ouvert dans Finder : ${displayPath}`;
          openReportHint.style.color = '#10b981';
          setTimeout(() => {
            if (openReportHint) {
              openReportHint.innerText = 'Chemins : 01-gpu-driven/results/REPORT.md & reports/';
              openReportHint.style.color = '#64748b';
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
          openReportHint.innerText = '⚠️ Impossible d\'ouvrir automatiquement le Finder. Chemin : ./reports/';
          openReportHint.style.color = '#f59e0b';
        }
      }
    } catch (err: any) {
      console.warn('Erreur ouverture dossier :', err);
      if (openReportHint) {
        openReportHint.innerText = '📁 Chemin manuel : render-tech-lab/reports/';
        openReportHint.style.color = '#94a3b8';
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
    btnClassic.classList.add('active');
    btnGpuDriven.classList.remove('active');
    runner.setMode('classic');
  });

  btnGpuDriven.addEventListener('click', () => {
    btnGpuDriven.classList.add('active');
    btnClassic.classList.remove('active');
    runner.setMode('gpu-driven');
  });

  selectCount.addEventListener('change', async (e) => {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    benchStatus.innerText = `Génération de la scène avec ${val} objets...`;
    await runner.setupPalier(val);
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

  // Boucle d'animation
  function animate(t: number) {
    runner.renderTick(t);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
