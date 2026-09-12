import type { GpuSceneBenchResult } from '../contracts.ts';

export class GPUSceneChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastResults: GpuSceneBenchResult[] = [];
  /**
   * Le canvas de graphe est partagé entre modules : un graphe inactif ne doit
   * jamais peindre, sinon un simple resize remplace le tracé du module affiché.
   */
  private active = false;
  private observer: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.observer = new ResizeObserver(() => this.render(this.lastResults));
      this.observer.observe(this.canvas);
    }
  }

  /** Donne ou retire à ce graphe la propriété du canvas partagé. */
  public setActive(active: boolean) {
    this.active = active;
    if (active) this.render(this.lastResults);
  }

  public dispose() {
    this.active = false;
    this.observer?.disconnect();
    this.observer = null;
  }

  public reset() {
    this.lastResults = [];
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = '';
    if (this.active) this.render([]);
  }

  public render(results: GpuSceneBenchResult[] = []) {
    this.lastResults = results;
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = [...new Set(results.map(result => result.config.name))].join('|');
    const ctx = this.ctx;
    if (!ctx || !this.active) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : 380;
    const cssH = rect.height > 0 ? rect.height : 176;

    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = cssW;
    const h = cssH;

    // Effacement transparent fluide
    ctx.clearRect(0, 0, w, h);

    const padLeft = 68;
    const padRight = 16;
    const padTop = 26;
    const padBottom = 38;

    const plotW = Math.max(10, w - padLeft - padRight);
    const plotH = Math.max(10, h - padTop - padBottom);

    // Calcul du Y max dynamique (minimum 5ms)
    let maxY = 5.0;
    for (const r of results) {
      if (r.avgCpuSubmitMs > maxY) maxY = r.avgCpuSubmitMs * 1.15;
    }

    // Tracé du cadre du repère
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Grille horizontale (5 pas réguliers)
    const gridSteps = 5;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = (maxY / gridSteps) * i;
      const y = padTop + plotH - (yVal / maxY) * plotH;

      ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`${yVal.toFixed(1)} ms`, padLeft - 6, y + 3.5);
    }

    // Titres des axes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px ui-sans-serif, sans-serif';
    ctx.fillText('Scénarios 4D (Géométries, Matériaux, Dynamique)', padLeft + plotW / 2, h - 8);

    ctx.save();
    ctx.translate(13, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('CPU submit (ms)', 0, 0);
    ctx.restore();

    // Légende compacte en haut à droite
    const legendY = padTop - 10;
    ctx.font = '10px ui-sans-serif, sans-serif';
    ctx.textAlign = 'right';

    const legBText = 'GPU-Scene O(G)';
    const legBWidth = ctx.measureText(legBText).width;
    const legBX = padLeft + plotW;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(legBText, legBX, legendY);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(legBX - legBWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const legAText = 'Three.js O(N)';
    const legAWidth = ctx.measureText(legAText).width;
    const legAX = legBX - legBWidth - 18;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(legAText, legAX, legendY);
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(legAX - legAWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Message d'attente si aucune donnée
    if (results.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.fillText('Prêt pour la matrice 4 dimensions', padLeft + plotW / 2, padTop + plotH / 2 - 7);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '10px ui-sans-serif, sans-serif';
      ctx.fillText('Cliquez sur ▶ Benchmark 4D pour tester la scène', padLeft + plotW / 2, padTop + plotH / 2 + 9);

      ctx.restore();
      return;
    }

    // Tracé en barres ou points groupés par scénario
    const classicResults = results.filter((r) => r.mode === 'classic');
    const gpuResults = results.filter((r) => r.mode === 'gpu-scene');
    const count = Math.max(classicResults.length, gpuResults.length);

    if (count > 0) {
      const barSlot = plotW / count;
      for (let i = 0; i < count; i++) {
        const xCenter = padLeft + (i + 0.5) * barSlot;

        // Tracé barre Classic
        if (i < classicResults.length) {
          const val = classicResults[i].avgCpuSubmitMs;
          const barH = (val / maxY) * plotH;
          ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
          ctx.fillRect(xCenter - barSlot * 0.35, padTop + plotH - barH, barSlot * 0.3, barH);
        }

        // Tracé barre GPU-Scene
        if (i < gpuResults.length) {
          const val = gpuResults[i].avgCpuSubmitMs;
          const barH = (val / maxY) * plotH;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.fillRect(xCenter + barSlot * 0.05, padTop + plotH - barH, barSlot * 0.3, barH);
        }

        // Tick scénario
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${i + 1}`, xCenter, padTop + plotH + 14);
      }
    }

    ctx.restore();
  }
}
