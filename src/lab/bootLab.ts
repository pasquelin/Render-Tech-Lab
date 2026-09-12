import { idleExecution } from './execution.ts';
import { canvasVisibility } from './canvasVisibility.ts';
import { BenchmarkRunner } from '../../01-indirect-draw/index.ts';
import { formatMarkdownReport } from '../../01-indirect-draw/index.ts';
import type { FrameMeasurement as FrameMeasurement01, CrossoverReport } from '../../01-indirect-draw/index.ts';
import { GPUSceneBenchmarkRunner, PAIN_MATRIX } from '../../03-gpu-scene/index.ts';
import { formatGpuSceneReport } from '../../03-gpu-scene/index.ts';
import { GPUSceneChart } from '../../03-gpu-scene/index.ts';
import type { GpuSceneBenchResult } from '../../03-gpu-scene/index.ts';
import { LodBenchmarkRunner } from '../../04-gpu-lod/index.ts';
import { LodChart } from '../../04-gpu-lod/index.ts';
import type { LodBenchmarkSummary } from '../../04-gpu-lod/index.ts';
import { GenericLabChart } from './GenericLabChart.ts';
import { createIntegratedRunner, isIntegratedRunnerId, type IntegratedMetric, type IntegratedRunResult } from '../../bench/runners.ts';
import { navigateLabRoute } from './navigation.ts';
import { getSharedDevice, releaseSharedGLRenderer } from '../common/gpuContext.ts';
import { parseMarkdownToHtml } from './markdown.ts';
import { BASELINE_00_SCENARIOS, GPU_SCENE_PRESETS, MODULE_DESCRIPTORS } from './modules.ts';
import { MODULE_SCHEMAS } from './schemas.ts';
import { LIVE_MODULES } from './catalog.ts';
import {
  emptyModal,
  initialSnapshot,
  type LabActions,
  type LabMode,
  type LabSnapshot,
} from './labState.ts';
import type { LabProgress, ProgressItemType } from './execution.ts';

const progressOperation: Record<string, { itemType: ProgressItemType; message: string }> = {
  '15-virtualized-integration': { itemType: 'buffers', message: 'Préparation des clusters, des pages GPU et des contrôles A/B.' },
  '01-indirect-draw': { itemType: 'buffers', message: 'Préparation des instances et buffers indirects.' },
  '02-gpu-frustum-culling': { itemType: 'shaders', message: 'Compilation du culling frustum et préparation du readback.' },
  '03-gpu-scene': { itemType: 'scène', message: 'Préparation des géométries, matériaux et objets de la scène.' },
  '04-gpu-lod': { itemType: 'scène', message: 'Préparation des niveaux de détail et du raster WebGPU.' },
  '05-meshlets': { itemType: 'calcul', message: 'Partition des meshlets.' },
  '06-meshlet-culling': { itemType: 'calcul', message: 'Culling frustum, cône et subpixel des meshlets.' },
  '07-hiz': { itemType: 'buffers', message: 'Construction de la pyramide de profondeur Hi-Z.' },
  '08-occlusion-culling': { itemType: 'calcul', message: 'Évaluation de l’occlusion sur la pyramide Hi-Z.' },
  '09-gpu-compaction': { itemType: 'buffers', message: 'Compaction des commandes GPU et contrôle du readback.' },
  '10-material-batching': { itemType: 'buffers', message: 'Construction des lots et tables de matériaux.' },
  '11-geometry-streaming': { itemType: 'buffers', message: 'Chargement et éviction des pages de géométrie.' },
  '12-visibility-buffer': { itemType: 'buffers', message: 'Encodage puis contrôle du visibility buffer.' },
  '13-full-gpu-driven': { itemType: 'scène', message: 'Contrôle de disponibilité du pipeline complet.' },
  '14-open-world': { itemType: 'modèles', message: 'Chargement du décor Bistro et de ses ressources.' },
};

const initialProgress = (moduleId: string): LabProgress => ({ phase: 'Préparer', ...(progressOperation[moduleId] ?? { itemType: 'scène' as const, message: 'Préparation du banc.' }) });
const nextVisualFrame = async () => {
  if (typeof requestAnimationFrame !== 'function') return;
  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(finish);
    setTimeout(finish, 32);
  });
};
export const MIN_RESULT_PRESENTATION_MS = 2000;

type Canvases = {
  webgpu: HTMLCanvasElement;
  webgl: HTMLCanvasElement;
  chart: HTMLCanvasElement;
};

export class LabSession {
  state: LabSnapshot;
  readonly actions: LabActions;
  private readonly canvases: Canvases;
  private readonly listeners = new Set<(state: LabSnapshot) => void>();
  private runner01: BenchmarkRunner | null = null;
  private runner02: GPUSceneBenchmarkRunner | null = null;
  private chart02: GPUSceneChart | null = null;
  private chart04: LodChart | null = null;
  private genericChart: GenericLabChart | null = null;
  private lastLodSummary: LodBenchmarkSummary | null = null;
  private raf = 0;
  private disposed = false;
  private campaignAborted = false;
  private lastUiUpdate = 0;
  private sumSubmit = 0;
  private sumCpu = 0;
  private sumFps = 0;
  private fpsSamples = 0;
  private sampleCount = 0;
  private integratedAbortController: AbortController | null = null;
  private campaignSequence = 0;
  private activeCampaign: { moduleId: string; token: number } | null = null;
  private firstPresentedAt = 0;
  private presentationAbortController: AbortController | null = null;
  presentationDurationMs = MIN_RESULT_PRESENTATION_MS;

  constructor(canvases: Canvases) {
    this.canvases = canvases;
    this.state = initialSnapshot('00-baseline');
    this.actions = {
      newExecution: () => {
        if(this.state.running || this.disposed) return;
        cancelAnimationFrame(this.raf);this.raf=0;
        this.patch({execution:{...this.state.execution,status:'idle',phase:''},progress:null,framePresented:false,stats:initialSnapshot(this.state.moduleId).stats});
      },
      switchModule: (moduleId) => {
        void this.switchModule(moduleId);
      },
      setMode: (mode) => {
        this.setMode(mode);
      },
      setScenario: (value) => {
        void this.setScenario(value);
      },
      stopBenchmark: () => {
        this.campaignAborted = true;
        this.presentationAbortController?.abort();
        this.integratedAbortController?.abort();
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.patch({ execution: { ...this.state.execution, status: 'stopped', phase: 'Arrêt manuel · dernières mesures complètes conservées.' } });
      },
      runBenchmark: () => {
        void this.runBenchmark();
      },
      runPain: () => {
        void this.runPain();
      },
      openReport: (testId) => {
        void this.openReportModal(testId);
      },
      closeReport: () => {
        this.patch({ reportModal: { ...this.state.reportModal, open: false, feedback: '' } });
      },
      copyReport: () => {
        void this.copyReport();
      },
      refreshReport: () => {
        void this.openReportModal();
      },
      openFinder: () => {
        void this.triggerOpenFinder();
      },
    };
  }

  subscribe(listener: (state: LabSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    this.genericChart = new GenericLabChart(this.canvases.chart);
    window.addEventListener('resize', this.onResize);
    this.onResize();

    const requested = new URLSearchParams(window.location.search).get('test') ?? '00-baseline';
    await this.switchModule(Object.hasOwn(MODULE_DESCRIPTORS, requested) ? requested : '00-baseline');
  }

  private async ensureRunner01(): Promise<BenchmarkRunner> {
    if (this.runner01) return this.runner01;
    const runner = new BenchmarkRunner(this.canvases.webgpu, this.canvases.webgl, this.canvases.chart);
    runner.canRender = () => !this.disposed && !this.campaignAborted && this.state.moduleId === '01-indirect-draw' && this.state.running;
    runner.onModeChange = mode => this.publishRunnerMode('01-indirect-draw', mode);
    await runner.init();
    runner.onMetricsUpdate = (measurement: FrameMeasurement01, _mode: string, count: number) => this.handleMetrics(measurement.submitMs, measurement.cpuFrameMs, measurement.fps, measurement.drawCalls, count, this.state.running);
    runner.onFramePresented = () => { if (this.state.moduleId === '01-indirect-draw' && this.state.running) this.markFramePresented(); };
    runner.onBenchmarkProgress = (stage, progress) => this.setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
    runner.onBenchmarkComplete = async (report: CrossoverReport) => {
      this.patch({ execution: { ...this.state.execution, lastCampaign: { timestamp: report.timestamp, status: 'Terminée', configuration: `${report.tiers.join(' / ')} objets`, series: [{ label: 'A · Three.js WebGL', values: report.classicResults.map(r => r.avgSubmitMs), unit: 'ms CPU submit' }, { label: 'B · WebGPU natif', values: report.gpuDrivenResults.map(r => r.avgSubmitMs), unit: 'ms CPU submit' }] } } });
      const markdown = formatMarkdownReport(report, '01-indirect-draw');
      try { const response = await fetch('/api/save-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testId: '01-indirect-draw', markdown, latest: report }) }); if (!response.ok) throw new Error(`Archive HTTP ${response.status}`); }
      catch (error) { if (!this.disposed) this.setBenchStatus(`Mesures terminées · archivage à réessayer : ${String(error)}`, 'text-warning'); }
    };
    this.runner01 = runner;
    return runner;
  }

  private async ensureRunner03(): Promise<GPUSceneBenchmarkRunner> {
    if (this.runner02) return this.runner02;
    const runner = new GPUSceneBenchmarkRunner(this.canvases.webgpu, this.canvases.webgl);
    runner.canRender = () => !this.disposed && !this.campaignAborted && this.state.moduleId === '03-gpu-scene' && this.state.running;
    runner.onModeChange = mode => this.publishRunnerMode('03-gpu-scene', mode === 'classic' ? 'classic' : 'gpu-driven');
    if (!await runner.init()) throw new Error("03-gpu-scene indisponible : WebGPU ou 'indirect-first-instance' manque.");
    runner.onProgress = (stage, progress) => this.setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
    runner.onMetricsUpdate = (measurement, _mode, count) => this.handleMetrics(measurement.submitMs, measurement.cpuFrameMs, measurement.fps, measurement.drawCalls, count);
    runner.onFramePresented = () => { if (this.state.moduleId === '03-gpu-scene' && this.state.running) this.markFramePresented(); };
    this.runner02 = runner; this.chart02 = new GPUSceneChart(this.canvases.chart);
    return runner;
  }

  dispose(): void {
    this.disposed = true;
    this.integratedAbortController?.abort();
    this.presentationAbortController?.abort();
    this.integratedAbortController = null;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    // ResizeObservers from an old React session must not repaint the shared canvas.
    this.runner01?.chart.setActive(false);
    this.chart02?.setActive(false);
    this.chart04?.setActive(false);
    if (this.canvases.webgl) releaseSharedGLRenderer(this.canvases.webgl);
    this.genericChart?.setActive(false);
    this.genericChart?.dispose();
    this.listeners.clear();
  }

  private notify(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) listener(snapshot);
  }

  private patch(partial: Partial<LabSnapshot>): void {
    const next = { ...this.state, ...partial };
    this.state = { ...next, ...canvasVisibility(next.moduleId, next.mode) };
    this.notify();
  }

  private setBenchStatus(text: string, tone = 'text-base-content/80'): void {
    const progress = this.state.running && this.state.progress ? { ...this.state.progress, phase: text, message: text.replace(/^⏳\s*(?:\[\d+%\]\s*)?/, '') } : this.state.progress;
    this.patch({ benchStatus: text, benchTone: tone, progress, execution: { ...this.state.execution, phase: text } });
  }

  private setReportHint(text: string): void {
    this.patch({ reportHint: text });
  }

  private onResize = (): void => {
    const container = document.getElementById('viewport-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvases.webgpu.width = width;
    this.canvases.webgpu.height = height;
    this.canvases.webgl.width = width;
    this.canvases.webgl.height = height;
    this.runner01?.resize(width, height);
    this.runner02?.resize(width, height);
  };

  private handleMetrics(submitMs: number, cpuFrameMs: number, fps: number | null, drawCalls: number, count: number, force = false): void {
    this.markFramePresented();
    this.sumSubmit += submitMs;
    this.sumCpu += cpuFrameMs;
    if (fps !== null) {
      this.sumFps += fps;
      this.fpsSamples += 1;
    }
    this.sampleCount += 1;
    const now = performance.now();
    if (!force && now - this.lastUiUpdate < 350) return;
    const avgSubmit = this.sumSubmit / this.sampleCount;
    const avgCpu = this.sumCpu / this.sampleCount;
    const avgFps = this.fpsSamples ? Math.round(this.sumFps / this.fpsSamples) : null;
    this.patch({ framePresented: true,
      stats: {
        ...this.state.stats,
        objects: count >= 1000 ? `${count / 1000}k` : count.toString(),
        submit: avgSubmit < 0.05 ? '< 0.1 ms' : `${avgSubmit.toFixed(1)} ms`,
        cpuFrame: avgCpu < 0.05 ? '< 0.1 ms' : `${avgCpu.toFixed(1)} ms`,
        fps: avgFps === null ? 'non mesuré' : `${avgFps} FPS`,
        drawCalls: drawCalls.toLocaleString('fr-FR'),
      },
    });
    this.sumSubmit = 0;
    this.sumCpu = 0;
    this.sumFps = 0;
    this.fpsSamples = 0;
    this.sampleCount = 0;
    this.lastUiUpdate = now;
  }

  private markFramePresented(): void {
    if (!this.firstPresentedAt) this.firstPresentedAt = performance.now();
    if (!this.state.framePresented) this.patch({ framePresented: true });
  }

  private async holdCompletedMeasurement(moduleId: string, token: number): Promise<void> {
    if (!this.isCurrentCampaign(moduleId, token) || this.campaignAborted) return;
    const measuredAt = this.state.execution.lastCampaign?.timestamp ?? new Date().toISOString();
    const remaining = this.presentationDurationMs;
    const endsAt = new Date(Date.now() + remaining).toISOString();
    this.patch({
      progress: { ...(this.state.progress ?? initialProgress(moduleId)), phase: 'finalize', message: 'Mesure terminée · préparation du rapport.' },
      execution: { ...this.state.execution, status: 'running', phase: 'Mesure terminée · préparation du rapport.', measurementCompletedAt: measuredAt, presentationEndsAt: endsAt },
    });
    if (!remaining) return;
    const controller = new AbortController();
    this.presentationAbortController = controller;
    await new Promise<void>(resolve => {
      const timer = globalThis.setTimeout(resolve, remaining);
      controller.signal.addEventListener('abort', () => { globalThis.clearTimeout(timer); resolve(); }, { once: true });
    });
    if (this.presentationAbortController === controller) this.presentationAbortController = null;
  }

  private async holdReadinessPresentation(moduleId: string, token: number): Promise<void> {
    if (!this.isCurrentCampaign(moduleId, token) || this.campaignAborted) return;
    const remaining = Math.max(0, this.presentationDurationMs - (performance.now() - (this.firstPresentedAt || performance.now())));
    this.patch({ execution: { ...this.state.execution, status: 'running', phase: 'Contrôle terminé · préparation du rapport.', presentationEndsAt: new Date(Date.now() + remaining).toISOString() } });
    if (!remaining) return;
    const controller = new AbortController(); this.presentationAbortController = controller;
    await new Promise<void>(resolve => { const timer = globalThis.setTimeout(resolve, remaining); controller.signal.addEventListener('abort', () => { globalThis.clearTimeout(timer); resolve(); }, { once: true }); });
    if (this.presentationAbortController === controller) this.presentationAbortController = null;
  }

  private async runReadiness13(token: number): Promise<void> {
    const checks = [
      { label: 'Meshlets 05', ready: isIntegratedRunnerId('05-meshlets') },
      { label: 'Culling 06–08', ready: ['06-meshlet-culling', '07-hiz', '08-occlusion-culling'].every(isIntegratedRunnerId) },
      { label: 'Compaction 09', ready: isIntegratedRunnerId('09-gpu-compaction') },
      { label: 'Matériaux / streaming / visibilité 10–12', ready: ['10-material-batching', '11-geometry-streaming', '12-visibility-buffer'].every(isIntegratedRunnerId) },
      { label: 'Orchestrateur physique 13', ready: false },
    ];
    this.markFramePresented();
    for (let index = 0; index < checks.length; index++) {
      if (!this.isCurrentCampaign('13-full-gpu-driven', token) || this.campaignAborted) return;
      const check = checks[index];
      this.patch({ progress: { phase: 'verify', itemType: 'calcul', itemName: check.label, completed: index + 1, total: checks.length, message: `${check.label} · ${check.ready ? 'prêt' : 'bloqué'}`, details: checks.slice(0, index + 1).map(item => ({ label: item.label, value: item.ready ? 'Prêt' : 'Bloqué' })) }, execution: { ...this.state.execution, status: 'running', phase: `Contrôle ${index + 1}/${checks.length} · ${check.label}` } });
      await nextVisualFrame();
    }
    await this.holdReadinessPresentation('13-full-gpu-driven', token);
    if (!this.isCurrentCampaign('13-full-gpu-driven', token) || this.campaignAborted) return;
    const phase = 'Préparation incomplète : les briques 05–12 sont raccordées, mais aucun orchestrateur physique 13 ne produit encore de campagne GPU complète.';
    this.patch({ execution: { ...this.state.execution, status: 'error', phase, lastCampaign: null }, benchStatus: phase, benchTone: 'text-warning' });
  }

  private telemetryFor(moduleId: string, mode: LabMode): { telemetryMode: string; telemetryDetail: string } {
    if (moduleId === '00-baseline') {
      return { telemetryMode: 'Three.js Reference Floor', telemetryDetail: 'Spec 13 Normalized Matrix (S0–S5)' };
    }
    if (moduleId === '01-indirect-draw') {
      return mode === 'classic'
        ? { telemetryMode: 'Three.js WebGL Pipeline', telemetryDetail: 'CPU Frustum Culling + Draw Calls' }
        : { telemetryMode: 'WebGPU Native Pipeline', telemetryDetail: 'Indirect Draw + WGSL Culling' };
    }
    if (moduleId === '03-gpu-scene') {
      return mode === 'classic'
        ? { telemetryMode: 'Three.js Multi-Mesh Pipeline', telemetryDetail: 'Multi-Geometry & Multi-Material' }
        : { telemetryMode: 'WebGPU Heterogeneous Scene', telemetryDetail: 'Mega-Buffers + Multi-Draw Indirect' };
    }
    const desc = MODULE_DESCRIPTORS[moduleId];
    return {
      telemetryMode: desc?.telemetryMode ?? this.state.telemetryMode,
      telemetryDetail: desc?.telemetryDetail ?? this.state.telemetryDetail,
    };
  }

  private modeLabel(moduleId: string, mode: LabMode): string {
    if (moduleId === '00-baseline' && mode === 'classic') return 'Three.js Baseline';
    if (mode === 'classic') {
      if (moduleId === '04-gpu-lod') return 'Test A (CPU SSE)';
      if (moduleId === '03-gpu-scene') return 'Test A (Multi-Mesh)';
      return 'Test A (Three.js)';
    }
    if (moduleId === '04-gpu-lod') return 'Test B (GPU SSE)';
    if (moduleId === '03-gpu-scene') return 'Test B (GPU-Scene)';
    return 'Test B (GPU-Driven)';
  }

  private populateSelector(moduleId: string): { scenarioOptions: LabSnapshot['scenarioOptions']; benchLabel: string; painLabel: string; showPain: boolean; scenarioVal: string } {
    const desc = MODULE_DESCRIPTORS[moduleId];
    const selected = desc.options.find((option) => option.selected)?.val ?? desc.options[0]?.val ?? '';
    return {
      scenarioOptions: desc.options.map((option) => ({
        val: option.val,
        label: option.label,
        selected: option.val === selected,
        disabled: option.disabled,
      })),
      benchLabel: desc.benchLabel,
      painLabel: desc.painLabel ?? '',
      showPain: Boolean(desc.painLabel),
      scenarioVal: selected,
    };
  }

  private applyScenario(moduleId: string, scenarioVal: string, mode: LabMode): void {
    const desc = MODULE_DESCRIPTORS[moduleId];
    if (!desc) return;
    let scenario = desc.options.find((option) => option.val === scenarioVal);
    if (!scenario && desc.options.length > 0) scenario = desc.options[0];
    const stats = mode === 'classic' ? scenario?.statsClassic || desc.stats : scenario?.statsGpu || desc.stats;
    const workbench = !LIVE_MODULES.has(moduleId) && moduleId !== '04-gpu-lod'
      ? {
          ...this.state.workbench,
          visible: true,
          title: `${desc.number} · ${desc.name}`,
          desc: `${desc.subtitle}. ${desc.description}`,
          badge: desc.badge,
          idLabel: `Banc R&D ${desc.number}`,
          principle: desc.technicalPrinciple.split('.')[0],
          schemaHtml: MODULE_SCHEMAS[moduleId] || '',
          metrics: [{ label: 'Mesures', val: 'Non exécutées' }],
        }
      : { ...this.state.workbench, visible: false };

    this.patch({
      moduleId,
      mode,
      scenarioVal: scenario?.val ?? scenarioVal,
      stats: {
        objects: stats.objects,
        submit: 'non mesuré',
        cpuFrame: 'non mesuré',
        fps: 'non mesuré',
        drawCalls: 'non mesuré',
        modeLabel: this.modeLabel(moduleId, mode),
      },
      classicActive: mode === 'classic',
      workbench,
      ...this.telemetryFor(moduleId, mode),
      benchStatus: scenario?.desc ? 'Scénario chargé — lancer le banc pour recueillir des mesures.' : this.state.benchStatus,
      benchTone: scenario?.desc ? 'text-base-content/60' : this.state.benchTone,
    });
  }

  private applyLodSummary(summary: LodBenchmarkSummary): void {
    this.lastLodSummary = summary;
    const counts = summary.cpuSelection.objectCounts;
    const lastIdx = counts.length - 1;
    const gpuTimes = summary.gpuSelection.computeTimesMs;
    this.patch({
      workbench: {
        ...this.state.workbench,
        visible: true,
        title: '04 · GPU LOD — campagne mesurée',
        desc:
          `Décimation meshoptimizer : ${summary.generation.originalTriangles.toLocaleString('fr-FR')} triangles → ` +
          `${summary.generation.lod1Triangles.toLocaleString('fr-FR')} (LOD1) → ${summary.generation.lod2Triangles.toLocaleString('fr-FR')} (LOD2), ` +
          `soit ${summary.generation.memorySavedPercent.toFixed(1)} % de mémoire économisée en ${summary.generation.durationMs.toFixed(1)} ms. ` +
          `Erreur projetée max ${summary.contractualErrorCheck.maxObservedErrorPx.toFixed(2)} px ` +
          `(seuil ${summary.contractualErrorCheck.thresholdPx} px) : ${summary.contractualErrorCheck.passed ? 'conforme' : 'NON conforme'}. ` +
          `Courbes CPU/GPU tracées dans le panneau de droite.`,
      },
      stats: {
        ...this.state.stats,
        objects: counts[lastIdx] >= 1000 ? `${counts[lastIdx] / 1000}k` : `${counts[lastIdx]}`,
        submit: gpuTimes ? `${gpuTimes[lastIdx].toFixed(2)} ms` : 'n/a',
        cpuFrame: `${summary.cpuSelection.latenciesMs[lastIdx].toFixed(2)} ms`,
        fps: summary.contractualErrorCheck.passed ? 'Conforme' : 'Hors seuil',
        drawCalls: `${summary.generation.memorySavedPercent.toFixed(0)} %`,
      },
    });
    this.chart04?.render(summary);
  }

  private async loadWorkbenchReport(moduleId: string): Promise<void> {
    this.patch({
      workbench: {
        ...this.state.workbench,
        reportPath: `reports/${moduleId}.md & ${moduleId}/results/REPORT.md`,
        reportHtml: '<div class="text-xs text-primary font-mono animate-pulse">⏳ Chargement de l\'analyse technique in-situ...</div>',
      },
    });
    try {
      const response = await fetch(`/api/get-report?testId=${encodeURIComponent(moduleId)}`);
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        const html =
          contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')
            ? `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`
            : parseMarkdownToHtml(text);
        this.patch({ workbench: { ...this.state.workbench, reportHtml: html } });
      } else {
        this.patch({
          workbench: {
            ...this.state.workbench,
            reportHtml: `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`,
          },
        });
      }
    } catch {
      this.patch({
        workbench: {
          ...this.state.workbench,
          reportHtml: `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`,
        },
      });
    }
  }

  private async switchModule(moduleId: string): Promise<void> {
    if (this.disposed || this.state.running) return;
    this.activeCampaign = null;
    this.campaignSequence += 1;
    this.runner01?.chart.reset();
    this.chart02?.reset();
    this.chart04?.setActive(false);
    this.genericChart?.reset('Aucune mesure pour le banc sélectionné.');
    this.markChartOwner(moduleId);
    if (moduleId === '04-gpu-lod' && new URLSearchParams(window.location.search).get('backend') !== 'legacy') {
      navigateLabRoute('04-gpu-lod');
      return;
    }
    if (moduleId === '14-open-world') {
      navigateLabRoute('14-open-world');
      return;
    }
    const desc = MODULE_DESCRIPTORS[moduleId];
    if (!desc) return;
    if (moduleId !== this.state.moduleId) this.patch({ execution: idleExecution() });
    const selector = this.populateSelector(moduleId);
    const url = new URL(window.location.href);
    if (url.searchParams.get('test') !== moduleId) {
      url.searchParams.set('test', moduleId);
      window.history.replaceState({}, '', url);
    }

    if (moduleId === '00-baseline') {
      this.runner01?.chart.setActive(false);
      this.chart02?.setActive(false);
      this.chart04?.setActive(false);
      this.genericChart?.setActive(false);
      this.patch({
        moduleId,
        showBaseline: true,
        showWebgl: false,
        showWebgpu: false,
        showLodComparison: false,
        workbench: { ...this.state.workbench, visible: false },
        reportHint: `${moduleId}/results/REPORT.md & reports/`,
        ...selector,
        classicActive: true,
        stats: { ...this.state.stats, modeLabel: 'Three.js Baseline' },
        ...this.telemetryFor('00-baseline', 'classic'),
      });
      this.applyScenario('00-baseline', 'S3', 'classic');
      return;
    }

    if (moduleId === '01-indirect-draw') {
      this.runner01?.chart.setActive(true);
      this.genericChart?.setActive(false);
      this.chart02?.setActive(false);
      this.chart04?.setActive(false);
      this.patch({
        moduleId,
        showBaseline: false,
        mode: this.runner01?.currentMode ?? 'gpu-driven',
        showChart: true,
        showLodComparison: false,
        workbench: { ...this.state.workbench, visible: false },
        reportHint: `${moduleId}/results/REPORT.md & reports/`,
        ...selector,
        benchStatus: 'Prêt (01-indirect-draw actif).',
        benchTone: 'text-base-content/80',
      });
      return;
    }

    if (moduleId === '03-gpu-scene') {
      if (!this.chart02) this.chart02 = new GPUSceneChart(this.canvases.chart);
      this.chart02.reset();
      this.chart02.setActive(true);
      this.patch({
        moduleId,
        showBaseline: false,
        mode: this.runner02?.currentMode === 'classic' ? 'classic' : 'gpu-driven',
        showLodComparison: false,
        workbench: { ...this.state.workbench, visible: false },
        reportHint: `${moduleId}/results/REPORT.md & reports/`,
        ...selector,
        benchStatus: 'Prêt (03-gpu-scene actif).',
        benchTone: 'text-base-content/80',
      });
      this.genericChart?.setActive(false);
      this.runner01?.chart.setActive(false);
      this.chart04?.setActive(false);
      return;
    }

    this.runner01?.chart.setActive(false);
    this.chart02?.setActive(false);
    if (moduleId === '04-gpu-lod') {
      if (!this.chart04) this.chart04 = new LodChart(this.canvases.chart);
      this.chart04.setActive(true);
      this.genericChart?.setActive(false);
    } else {
      this.chart04?.setActive(false);
      this.genericChart?.setActive(true);
    }

    this.patch({
      moduleId,
      showBaseline: false,
      showWebgl: false,
      showWebgpu: false,
      showLodComparison: moduleId === '04-gpu-lod',
      reportHint: `${moduleId}/results/REPORT.md & reports/`,
      ...selector,
      countLabel: moduleId === '15-virtualized-integration' ? 'Scène :' : this.state.countLabel,
      workbench: {
        ...this.state.workbench,
        terminal: `[${desc.number} · ${desc.name}] Prêt pour l'évaluation.\nSélectionnez une charge ou cliquez sur « Benchmark » dans le panneau de droite pour exécuter le banc en direct.`,
        terminalBusy: false,
        terminalDuration: '',
      },
    });
    this.applyScenario(moduleId, selector.scenarioVal, 'gpu-driven');
    void this.loadWorkbenchReport(moduleId);
    if (moduleId === '04-gpu-lod' && this.lastLodSummary) this.applyLodSummary(this.lastLodSummary);
  }

  private publishRunnerMode(moduleId: string, mode: LabMode): void {
    if (this.disposed || this.state.moduleId !== moduleId) return;
    this.sumSubmit = this.sumCpu = this.sumFps = this.fpsSamples = this.sampleCount = 0;
    this.patch({ mode, classicActive: mode === 'classic',
      stats: { ...this.state.stats, modeLabel: this.modeLabel(moduleId, mode) },
      ...this.telemetryFor(moduleId, mode) });
  }

  private setMode(mode: LabMode): void {
    if (this.disposed || this.state.running) return;
    const moduleId = this.state.moduleId;
    if (moduleId === '00-baseline') {
      this.applyScenario('00-baseline', this.state.scenarioVal || 'S3', mode);
      return;
    }
    if (moduleId === '01-indirect-draw') {
      this.runner01?.setMode(mode);
    } else if (moduleId === '03-gpu-scene' && this.runner02) {
      this.runner02.setMode(mode === 'classic' ? 'classic' : 'gpu-scene');
    } else if (moduleId === '04-gpu-lod') {
      this.setBenchStatus(
        mode === 'classic' ? 'Mode 04B actif : Sélection Screen-Space Error sur CPU.' : '04C non exécuté : la sélection GPU reste à instrumenter.',
      );
    } else {
      this.applyScenario(moduleId, this.state.scenarioVal, mode);
      return;
    }
    this.patch({
      mode,
      classicActive: mode === 'classic',
      stats: { ...this.state.stats, modeLabel: this.modeLabel(moduleId, mode) },
      ...this.telemetryFor(moduleId, mode),
    });
  }

  private async setScenario(value: string): Promise<void> {
    if (this.disposed || this.state.running) return;
    const moduleId = this.state.moduleId;
    this.patch({
      scenarioVal: value,
      scenarioOptions: this.state.scenarioOptions.map((option) => ({ ...option, selected: option.val === value })),
    });
    if (moduleId === '00-baseline') {
      const scenario = BASELINE_00_SCENARIOS[value];
      if (scenario) {
        this.patch({
          stats: {
            ...this.state.stats,
            objects: scenario.objects,
            submit: 'non mesuré',
            cpuFrame: 'non mesuré',
            fps: 'non mesuré',
            drawCalls: 'non mesuré',
          },
        });
        this.setBenchStatus('Scénario de référence non remesuré.');
      }
      return;
    }
    if (moduleId === '04-gpu-lod') {
      const count = parseInt(value, 10);
      this.patch({
        stats: {
          ...this.state.stats,
          objects: count >= 1000 ? `${count / 1000}k` : count.toString(),
          submit: 'non mesuré',
          cpuFrame: 'non mesuré',
          fps: 'non mesuré',
          drawCalls: 'non mesuré',
        },
      });
      this.setBenchStatus(`Scène ${count} objets : décimation multi-LOD et sélection SSE.`);
      return;
    }
    if (moduleId === '01-indirect-draw') {
      const count = parseInt(value, 10);
      this.setBenchStatus(`Scène ${count} objets...`);
      await this.runner01?.setupTier(count);
      this.setBenchStatus(`Prêt (${count} objets).`);
      return;
    }
    if (moduleId === '03-gpu-scene' && this.runner02) {
      const preset = GPU_SCENE_PRESETS[value];
      if (preset) {
        this.setBenchStatus(`Configuration ${preset.name}...`);
        await this.runner02.applyConfig(preset);
        this.setBenchStatus(`Prêt (${preset.name}).`);
      }
      return;
    }
    this.applyScenario(moduleId, value, this.state.mode);
  }

  private async saveModuleReport(testId: string, results: GpuSceneBenchResult[], timestamp = new Date().toISOString()): Promise<void> {
    try {
      const markdown = formatGpuSceneReport(results, navigator.userAgent, timestamp);
      const response = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, markdown, latest: { test: testId, timestamp, status: 'completed', results } }),
      });
      if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
      this.setBenchStatus(`${this.state.benchStatus} | 💾 REPORT.md archivé`);
    } catch (error) {
      this.setBenchStatus(`${this.state.benchStatus} | Archivage à réessayer : ${String(error)}`, 'text-warning');
    }
  }

  private async openReportModal(testId = this.state.moduleId): Promise<void> {
    this.patch({
      reportModal: {
        ...emptyModal(),
        open: true,
        title: `Rapport d'analyse R&D — ${testId}`,
        path: `reports/${testId}.md & ${testId}/results/REPORT.md`,
        html: '<div class="text-xs text-primary font-mono animate-pulse">⏳ Chargement du rapport depuis le disque...</div>',
      },
    });
    try {
      const response = await fetch(testId === '15-virtualized-integration' ? '/api/integration-archive' : `/api/get-report?testId=${encodeURIComponent(testId)}`);
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          this.patch({
            reportModal: {
              ...this.state.reportModal,
              html: `<div class="alert alert-warning text-xs font-mono">⚠️ Rapport Markdown non disponible pour ${testId}.</div>`,
            },
          });
        } else {
          this.patch({
            reportModal: {
              ...this.state.reportModal,
              raw: text,
              html: parseMarkdownToHtml(text),
            },
          });
        }
      } else {
        const errText = (await response.text())
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        this.patch({
          reportModal: {
            ...this.state.reportModal,
            html: `<div class="alert alert-warning text-xs font-mono">⚠️ ${errText}</div>`,
          },
        });
      }
    } catch (error) {
      this.patch({
        reportModal: {
          ...this.state.reportModal,
          html: `<div class="alert alert-error text-xs font-mono">Erreur réseau : ${error instanceof Error ? error.message : String(error)}</div>`,
        },
      });
    }
  }

  private async copyReport(): Promise<void> {
    const raw = this.state.reportModal.raw;
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      this.patch({ reportModal: { ...this.state.reportModal, feedback: '✅ Markdown copié dans le presse-papier !' } });
      window.setTimeout(() => {
        if (!this.disposed) this.patch({ reportModal: { ...this.state.reportModal, feedback: '' } });
      }, 3000);
    } catch (error) {
      console.warn('Erreur clipboard', error);
    }
  }

  private async triggerOpenFinder(testId = this.state.moduleId): Promise<void> {
    this.setReportHint('⏳ Révélation dans le Finder...');
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, folder: 'reports' }),
      });
      if (response.ok) {
        const data = await response.json();
        const displayPath = data.targetFile || data.targetDir || 'reports/';
        this.setReportHint(`✅ Finder ouvert : ${displayPath}`);
        this.patch({ reportModal: { ...this.state.reportModal, feedback: `✅ Finder ouvert : ${displayPath}` } });
        window.setTimeout(() => {
          if (!this.disposed) this.setReportHint(`${testId}/results/REPORT.md & reports/`);
        }, 6000);
      } else {
        this.setReportHint('⚠️ Chemin : ./reports/');
      }
    } catch (error) {
      console.warn('Erreur ouverture dossier :', error);
      this.setReportHint('📁 ./reports/');
    }
  }

  private resetIntegratedCampaign(): void {
    this.sumSubmit = this.sumCpu = this.sumFps = this.fpsSamples = this.sampleCount = 0;
    this.genericChart?.reset('Préparation de la campagne courante…');
    this.patch({
      stats: { ...this.state.stats, submit: 'non mesuré', cpuFrame: 'non mesuré', fps: 'non mesuré', drawCalls: 'non mesuré' },
      execution: { status: 'running', phase: 'Préparer', lastCampaign: null }, framePresented: false,
      progress: initialProgress(this.state.moduleId),
      workbench: { ...this.state.workbench, visible: false, terminal: '', terminalBusy: false, terminalDuration: '' },
    });
  }

  private isCurrentCampaign(moduleId: string, token: number): boolean {
    return !this.disposed && this.state.moduleId === moduleId && this.activeCampaign?.moduleId === moduleId && this.activeCampaign.token === token;
  }

  private markChartOwner(moduleId: string, token?: number): void {
    if (!this.canvases.chart?.dataset) return;
    this.canvases.chart.dataset.chartOwner = token === undefined ? moduleId : `${moduleId}:${token}`;
  }

  private publishIntegratedMetric(metric: IntegratedMetric, records: readonly IntegratedMetric[], token: number): void {
    if (!this.isCurrentCampaign(metric.test, token)) return;
    const cpu = metric.cpuMs;
    const gpu = metric.gpuMs;
    const physicalSubmission = metric.custom.scope === 'webgpu-physical' || metric.custom.scope === 'virtualized-dyadic-patches';
    const detailLabels: Record<string, string> = { meshlets: 'Groupes meshlets', triangles: 'Triangles couverts', vertexDuplication: 'Duplication sommets', visible: 'Meshlets visibles', rejected: 'Meshlets rejetés', frustumRejected: 'Rejets frustum', coneRejected: 'Rejets cône', mips: 'Niveaux Hi-Z', logicalBytes: 'Octets logiques', objects: 'Objets', pipelineTransitions: 'Transitions pipeline', bindGroupTransitions: 'Transitions bind groups', occluded: 'Éléments occlus' };
    const details = Object.entries(metric.custom).filter(([label, value]) => label !== 'scope' && (typeof value === 'number' || typeof value === 'string')).slice(0, 4).map(([label, value]) => ({ label: detailLabels[label] ?? label, value: typeof value === 'number' ? value.toLocaleString('fr-FR') : String(value) }));
    this.markFramePresented();
    this.patch({ progress: { phase: 'measure', ...progressOperation[metric.test], itemName: metric.variant, completed: records.length, total: createIntegratedRunner(metric.test).variants.length, message: `Résultat réel · ${metric.variant}`, details },
      stats: {
        ...this.state.stats,
        submit: physicalSubmission && cpu !== null ? `${cpu.toFixed(2)} ms` : 'non mesuré',
        cpuFrame: !physicalSubmission && cpu !== null ? `${cpu.toFixed(2)} ms` : 'non mesuré',
        fps: 'non mesuré',
        drawCalls: 'non mesuré',
        modeLabel: metric.variant,
      },
    });
    this.genericChart?.update('Durées mesurées de la campagne', 'ms', records.map(record => ({
      label: record.variant,
      valA: record.cpuMs,
      valB: record.gpuMs,
    })), records.length - 1, gpu !== null ? 'gpu-driven' : 'classic');
  }

  private finishIntegratedCampaign(result: IntegratedRunResult, token: number, timestamp = new Date().toISOString()): void {
    if (!this.isCurrentCampaign(result.test, token)) return;
    if (result.status === 'not-run') {
      this.patch({ execution: { status: 'error', phase: result.reason ?? result.gates.detail, lastCampaign: null } });
      this.setBenchStatus(`Banc non exécuté : ${result.reason ?? result.gates.detail}`, 'text-warning');
      return;
    }
    const cpu = result.records.filter(record => record.cpuMs !== null);
    const gpu = result.records.filter(record => record.gpuMs !== null);
    const cpuOracle = result.records.every(record => String(record.custom.scope).startsWith('cpu-'));
    const series = [
      ...(cpu.length ? [{ label: cpuOracle ? 'Temps oracle CPU' : result.records.some(record => record.custom.scope === 'webgpu-physical') ? 'Encodage et soumission JS' : 'Durée CPU mesurée', values: cpu.map(record => record.cpuMs!), unit: 'ms' }] : []),
      ...(gpu.length ? [{ label: 'Durée GPU mesurée', values: gpu.map(record => record.gpuMs!), unit: 'ms GPU' }] : []),
    ];
    const scenarioLabels: Record<string, string> = { 'exact-resident': 'Résidence complète', 'lod-resident': 'Niveau de détail résident', 'streaming-pressure': 'Pression du streaming' };
    const scenarioChecks = result.test === '15-virtualized-integration' ? Object.entries(scenarioLabels).map(([id, label]) => {
      const variants = result.records.map(record => record.variant.split(':')).filter(parts => parts[0] === id);
      const archiveScenario = (result as { archive?: { virtualized?: { scenarios?: Array<{ id?: string; quality?: Array<{ passed?: boolean }> }> } } }).archive?.virtualized?.scenarios?.find(scenario => scenario.id === id);
      return { id, label, a: variants.filter(parts => parts[1] === 'A').length, b: variants.filter(parts => parts[1] === 'B').length,
        quality: archiveScenario?.quality?.every(check => check.passed === true) ? 'Qualité validée' : 'Qualité non validée' };
    }) : undefined;
    this.patch({ execution: { status: 'running', phase: result.gates.detail, lastCampaign: {
      timestamp, status: 'Terminée',
      configuration: result.test === '15-virtualized-integration' ? '3 scénarios procéduraux · contrôles A/B' : result.records.map(record => record.variant).join(' / '), series, scenarioChecks,
    } } });
    this.setBenchStatus(`🏁 ${result.records.length} variante${result.records.length > 1 ? 's' : ''} mesurée${result.records.length > 1 ? 's' : ''} · ${result.gates.detail}`);
  }

  private async archiveIntegratedCampaign(result: IntegratedRunResult, timestamp: string): Promise<void> {
    const cpuOracle = result.records.every(record => String(record.custom.scope).startsWith('cpu-'));
    const rows = result.records.map(record => `| ${record.variant} | ${record.cpuMs?.toFixed(3) ?? 'non mesuré'} | ${record.gpuMs?.toFixed(3) ?? 'non mesuré'} | ${String(record.custom.instances ?? 'non renseigné')} |`).join('\n');
    const provenance = cpuOracle ? 'Exécution : oracle CPU. Aucun dispatch, timestamp ni readback GPU n’a été exécuté.' : 'Exécution : runner physique WebGPU.';
    const markdown = `# ${result.test} — campagne intégrée\n\nDate : ${timestamp}.\nStatut : ${result.status}.\nContrôle : ${result.gates.detail}\n${provenance}\n\n| Stratégie | CPU (ms) | GPU (ms) | Éléments traités |\n|---|---:|---:|---:|\n${rows}\n\nLa durée de présentation de l’interface est exclue.\n`;
    try { await fetch('/api/save-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testId: result.test, markdown, latest: { ...result, timestamp } }) }); } catch { /* archive optional */ }
  }

  private async runIntegrated(moduleId: string, pain: boolean, token: number): Promise<void> {
    if (!isIntegratedRunnerId(moduleId)) return;
    this.resetIntegratedCampaign();
    if (moduleId === '15-virtualized-integration') this.patch({ framePresented: true });
    await nextVisualFrame();
    const controller = new AbortController();
    this.integratedAbortController = controller;
    const records: IntegratedMetric[] = [];
    try {
      const device = moduleId === '07-hiz' ? undefined : await getSharedDevice();
      if (controller.signal.aborted) throw new DOMException('Campagne interrompue', 'AbortError');
      const measurementCanvas = moduleId === '15-virtualized-integration' ? this.canvases.webgpu.ownerDocument.createElement('canvas') : this.canvases.webgpu;
      const result = await createIntegratedRunner(moduleId).run({
        // The 15 control poses render on a dedicated surface; the main viewport
        // remains a stable visualization and never exposes internal A/A/B frames.
        canvas: measurementCanvas,
        device,
        samples: moduleId === '15-virtualized-integration' ? 4 : pain ? 12 : 3,
        warmup: pain ? 8 : 2,
        signal: controller.signal,
        onPhase: event => {
          if (!this.isCurrentCampaign(moduleId, token)) return;
          const progress = event.total ? Math.round(event.completed / event.total * 100) : 0;
          const details = moduleId === '09-gpu-compaction' ? [
            { label: 'Charge par stratégie', value: `${Number(this.state.scenarioVal).toLocaleString('fr-FR')} éléments` },
            { label: 'Stratégies terminées', value: `${event.completed}/${event.total}` },
          ] : this.state.progress?.details;
          this.patch({ progress: { phase: event.phase, ...progressOperation[moduleId], itemName: event.variant, completed: event.completed, total: event.total, message: event.message, details } });
          this.setBenchStatus(`⏳ [${progress}%] ${event.message}`, 'text-primary');
        },
        onMetrics: metric => {
          records.push(metric);
          this.publishIntegratedMetric(metric, records, token);
        },
        scenario: this.state.scenarioVal,
      });
      if (!this.isCurrentCampaign(moduleId, token)) return;
      let archiveError = '';
      if (moduleId === '15-virtualized-integration') {
        if (this.isCurrentCampaign(moduleId, token)) this.setBenchStatus('Archivage des données brutes et des contrôles…', 'text-primary');
        try {
          const saved = await fetch('/api/integration-archive', { signal: AbortSignal.timeout(5000), method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
          if (!saved.ok) throw new Error(`Archive HTTP ${saved.status}`);
        } catch (error) { archiveError = ` · Archivage indisponible : ${String(error)}`; }
      }
      if (!controller.signal.aborted) {
        const timestamp = new Date().toISOString();
        this.finishIntegratedCampaign(result, token, timestamp);
        if (archiveError && this.isCurrentCampaign(moduleId, token)) this.setBenchStatus(this.state.benchStatus + archiveError, 'text-warning');
        if (result.status === 'measured' && moduleId !== '15-virtualized-integration') await this.archiveIntegratedCampaign(result, timestamp);
      }
    } finally {
      if (this.integratedAbortController === controller) this.integratedAbortController = null;
    }
  }

  private async runBenchmark(): Promise<void> {
    if (this.disposed || this.state.running) return;
    const moduleId = this.state.moduleId;

    if (moduleId === '00-baseline') {
      void this.openReportModal('00-baseline');
      return;
    }
    const desc = MODULE_DESCRIPTORS[moduleId];
    const campaignToken = ++this.campaignSequence;
    this.activeCampaign = { moduleId, token: campaignToken };
    this.markChartOwner(moduleId, campaignToken);
    this.campaignAborted = false;
    this.firstPresentedAt = 0;
    this.presentationAbortController?.abort();
    this.patch({
      running: true,
      framePresented: false,
      stats: { ...this.state.stats, objects: 'non mesuré', submit: 'non mesuré', cpuFrame: 'non mesuré', fps: 'non mesuré', drawCalls: 'non mesuré' },
      progress: initialProgress(moduleId),
      execution: { status: 'running', phase: 'Préparer', lastCampaign: null },
    });
    try {
      if (isIntegratedRunnerId(moduleId)) {
        await this.runIntegrated(moduleId, false, campaignToken);
      } else if (moduleId === '01-indirect-draw') {
        const runner = await this.ensureRunner01();
        this.setBenchStatus('⏳ Exécution du banc 01 dans le laboratoire...');
        const campaign = runner.runAutomatedBenchmark([500, 1000, 2000, 5000]);
        await campaign;
      } else if (moduleId === '03-gpu-scene') {
        this.chart02?.reset();
        const runner = await this.ensureRunner03();
        this.setBenchStatus('⏳ Exécution de la matrice de stress 4D...');
        const liveResults: GpuSceneBenchResult[] = [];
        runner.onResult = result => {
          if (!this.isCurrentCampaign(moduleId, campaignToken)) return;
          liveResults.push(result);
          this.chart02?.render(liveResults);
        };
        const campaign = runner.runFullMatrix();
        const results = await campaign;
        if (this.isCurrentCampaign(moduleId, campaignToken)) this.chart02?.render(results);
        const timestamp = new Date().toISOString();
        const classic = results.filter(result => result.mode === 'classic');
        const gpu = results.filter(result => result.mode === 'gpu-scene');
        this.patch({ execution: { ...this.state.execution, lastCampaign: { timestamp, status: 'Terminée', configuration: 'Matrice 4D · 12 scénarios · 24 blocs A/B', series: [
          { label: 'A · Three.js multi-maillages', values: classic.map(result => result.avgCpuSubmitMs), unit: 'ms CPU submit' },
          { label: 'B · WebGPU GPU-Scene', values: gpu.map(result => result.avgCpuSubmitMs), unit: 'ms CPU submit' },
        ] } } });
        await this.saveModuleReport('03-gpu-scene', results, timestamp);
        this.setBenchStatus('🏁 Matrice 4D complétée avec succès.');
      } else if (moduleId === '04-gpu-lod') {
        this.setBenchStatus('⏳ Exécution de la suite 04-gpu-lod (04A / 04B / 04C)...');
        const lodRunner = new LodBenchmarkRunner();
        const { summary, markdownReport } = await lodRunner.runFullSuite();
        try {
          await fetch('/api/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId: '04-gpu-lod', markdown: markdownReport }),
          });
        } catch {
          // ignore archive errors
        }
        this.applyLodSummary(summary);
        this.setBenchStatus(
          `🏁 04-gpu-lod : décimation ${summary.generation.durationMs.toFixed(1)} ms, SSE CPU ${summary.cpuSelection.latenciesMs[1].toFixed(2)} ms (2k objets).`,
        );
      } else if (moduleId === '13-full-gpu-driven') {
        await this.runReadiness13(campaignToken);
      } else if (desc) {
        this.patch({ execution: { status: 'error', phase: `Aucun runner intégré pour ${moduleId}.`, lastCampaign: null } });
        this.setBenchStatus(`Banc ${desc.number} non exécuté : aucun runner intégré.`, 'text-warning');
      }
      if (this.state.execution.status === 'running' && this.state.execution.lastCampaign) {
        await this.holdCompletedMeasurement(moduleId, campaignToken);
      }
    } catch (error) {
      if (!this.disposed) {
        this.patch({ execution: { ...this.state.execution, status: this.campaignAborted ? 'stopped' : 'error' } });
        this.setBenchStatus(this.campaignAborted ? 'Arrêt manuel · dernières mesures complètes conservées.' : error instanceof Error ? error.message : String(error), 'text-warning');
      }
    } finally {
      if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf); this.raf = 0;
      if (this.isCurrentCampaign(moduleId, campaignToken)) this.patch({ running: false, execution: { ...this.state.execution, status: this.state.execution.status === 'running' ? 'completed' : this.state.execution.status } });
    }
  }

  private async runPain(): Promise<void> {
    if (this.disposed || this.state.running) return;
    const moduleId = this.state.moduleId;

    const desc = MODULE_DESCRIPTORS[moduleId];
    const campaignToken = ++this.campaignSequence;
    this.activeCampaign = { moduleId, token: campaignToken };
    this.markChartOwner(moduleId, campaignToken);
    this.campaignAborted = false;
    this.firstPresentedAt = 0;
    this.presentationAbortController?.abort();
    this.patch({
      running: true,
      framePresented: false,
      stats: { ...this.state.stats, objects: 'non mesuré', submit: 'non mesuré', cpuFrame: 'non mesuré', fps: 'non mesuré', drawCalls: 'non mesuré' },
      progress: initialProgress(moduleId),
      execution: { status: 'running', phase: 'Préparer', lastCampaign: null },
    });
    try {
      if (isIntegratedRunnerId(moduleId)) {
        await this.runIntegrated(moduleId, true, campaignToken);
      } else if (moduleId === '01-indirect-draw') {
        const runner = await this.ensureRunner01();
        this.setBenchStatus('⏳ Exécution du banc 01 dans le laboratoire...');
        const campaign = runner.runAutomatedBenchmark([500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
        await campaign;
      } else if (moduleId === '03-gpu-scene') {
        const runner = await this.ensureRunner03();
        this.setBenchStatus('⏳ Stress test topologies (10 → 1 000)...');
        const campaign = runner.runCampaign(PAIN_MATRIX, 'Stress topologies achevé');
        const painResults = await campaign;
        if (this.isCurrentCampaign(moduleId, campaignToken)) this.chart02?.render(painResults);
        await this.saveModuleReport('03-gpu-scene', painResults);
        this.setBenchStatus('🏁 Stress topologies terminé.');
      } else if (moduleId === '04-gpu-lod') {
        this.setBenchStatus('⏳ Stress test LOD 50 000 objets...');
        const lodRunner = new LodBenchmarkRunner();
        const { summary } = await lodRunner.runFullSuite();
        this.applyLodSummary(summary);
        const counts = summary.cpuSelection.objectCounts;
        const top = counts.length - 1;
        this.setBenchStatus(`🏁 ${counts[top].toLocaleString('fr-FR')} objets : sélection SSE CPU ${summary.cpuSelection.latenciesMs[top].toFixed(2)} ms.`);
      } else if (moduleId === '13-full-gpu-driven') {
        this.patch({ execution: { status: 'error', phase: 'Readiness uniquement : aucun stress test physique intégré.', lastCampaign: null } });
        this.setBenchStatus('Banc 13 : readiness seulement, aucun stress test exécuté.', 'text-warning');
      } else if (desc) {
        this.patch({ execution: { status: 'error', phase: `Aucun runner de stress intégré pour ${moduleId}.`, lastCampaign: null } });
        this.setBenchStatus(`Test ${desc.number} non exécuté : aucun runner de stress intégré.`, 'text-warning');
      }
      if (this.state.execution.status === 'running' && this.state.execution.lastCampaign) {
        await this.holdCompletedMeasurement(moduleId, campaignToken);
      }
    } catch (error) {
      if (!this.disposed) {
        this.patch({ execution: { ...this.state.execution, status: this.campaignAborted ? 'stopped' : 'error' } });
        this.setBenchStatus(this.campaignAborted ? 'Arrêt manuel · dernières mesures complètes conservées.' : error instanceof Error ? error.message : String(error), 'text-warning');
      }
    } finally {
      if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf); this.raf = 0;
      if (this.isCurrentCampaign(moduleId, campaignToken)) this.patch({ running: false, execution: { ...this.state.execution, status: this.state.execution.status === 'running' ? 'completed' : this.state.execution.status } });
    }
  }
}
