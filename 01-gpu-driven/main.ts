import { BenchmarkRunner } from './benchmark/runner.ts';
import { formatMarkdownReport } from './benchmark/reporter.ts';
import type { FrameMeasurement, CrossoverReport } from './types.ts';

window.addEventListener('DOMContentLoaded', async () => {
  const canvasWebGpu = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
  const canvasWebGL = document.getElementById('canvas-webgl') as HTMLCanvasElement;
  const chartCanvas = document.getElementById('canvas-chart') as HTMLCanvasElement;

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
  const resultsJson = document.getElementById('results-json') as HTMLPreElement;

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

  // Mise à jour de l'UI
  runner.onMetricsUpdate = (m: FrameMeasurement, mode: string, count: number) => {
    statMode.innerText = mode === 'classic' ? 'Test A (Three.js Classique)' : 'Test B (GPU-Driven Indirect)';
    statMode.style.color = mode === 'classic' ? '#ef4444' : '#06b6d4';
    statObjects.innerText = count.toString();
    statSubmit.innerText = `${m.submitMs.toFixed(2)} ms`;
    statCpuFrame.innerText = `${m.cpuFrameMs.toFixed(2)} ms`;
    statFps.innerText = `${Math.round(m.fps)} FPS`;
    statDrawCalls.innerText = m.drawCalls.toString();
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
    resultsJson.innerText = mdReport;

    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: '01-gpu-driven', markdown: mdReport }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md sauvegardé sur disque';
      }
    } catch {
      // Ignore si exécuté hors du serveur de dev Vite
    }
  };

  // Interactions boutons
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
