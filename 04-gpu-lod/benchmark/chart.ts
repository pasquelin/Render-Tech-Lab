import type { LodBenchmarkSummary } from '../types.ts';
import { LOD_OBJECT_COUNTS } from '../types.ts';

/**
 * Courbe de sélection LOD : latence Screen-Space Error CPU (04B) contre
 * temps de compute GPU (04C), par palier d'objets.
 *
 * Le canvas de graphe est partagé entre modules : comme les autres graphes,
 * celui-ci ne peint que lorsqu'il est actif.
 */
export class LodChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last: LodBenchmarkSummary | null = null;
  private active = false;

  private raf = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      // Coalescé sur une frame : pendant un glissement de séparateur, l'observer
      // tire à chaque frame et chaque render force un layout + une réallocation
      // du backing-store du canvas.
      const ro = new ResizeObserver(() => {
        if (this.raf) return;
        this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          this.render(this.last);
        });
      });
      ro.observe(this.canvas);
    }
  }

  /** Donne ou retire à ce graphe la propriété du canvas partagé. */
  public setActive(active: boolean) {
    this.active = active;
    if (active) this.render(this.last);
  }

  public render(summary: LodBenchmarkSummary | null = null) {
    this.last = summary;
    const ctx = this.ctx;
    if (!ctx || !this.active) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : this.canvas.width / dpr || 380;
    const cssH = rect.height > 0 ? rect.height : this.canvas.height / dpr || 176;

    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const padLeft = 68;
    const padRight = 16;
    const padTop = 26;
    const padBottom = 38;
    const plotW = Math.max(10, cssW - padLeft - padRight);
    const plotH = Math.max(10, cssH - padTop - padBottom);

    const counts = summary?.cpuSelection.objectCounts ?? LOD_OBJECT_COUNTS;
    const cpu = summary?.cpuSelection.latenciesMs ?? [];
    // 04C n'est pas instrumenté tant que le compute shader n'est pas dispatché.
    const gpu = summary?.gpuSelection.computeTimesMs ?? null;
    const maxCount = Math.max(...counts);

    let maxY = 1.0;
    for (const v of cpu) if (v > maxY) maxY = v * 1.15;
    if (gpu) for (const v of gpu) if (v > maxY) maxY = v * 1.15;

    // Cadre
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Grille horizontale + labels Y
    const steps = 5;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= steps; i++) {
      const yVal = (maxY / steps) * i;
      const y = padTop + plotH - (yVal / maxY) * plotH;
      ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`${yVal.toFixed(2)} ms`, padLeft - 6, y + 3.5);
    }

    // Grille verticale + labels X (échelle logarithmique : 1k → 50k)
    const logMin = Math.log(counts[0]);
    const logSpan = Math.log(maxCount) - logMin;
    const xOf = (c: number) => padLeft + ((Math.log(c) - logMin) / logSpan) * plotW;

    ctx.textAlign = 'center';
    for (const c of counts) {
      const x = xOf(c);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(c >= 1000 ? `${c / 1000}k` : `${c}`, x, padTop + plotH + 15);
    }

    // Titres des axes
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText("Objets évalués", padLeft + plotW / 2, cssH - 8);
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Sélection LOD (ms)', 0, 0);
    ctx.restore();

    // Légende
    const legendY = padTop - 10;
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const legBText = gpu ? 'GPU SSE (04C)' : 'GPU SSE (04C) — non mesuré';
    const legBWidth = ctx.measureText(legBText).width;
    const legBX = padLeft + plotW;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(legBText, legBX, legendY);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(legBX - legBWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const legAText = 'CPU SSE (04B)';
    const legAWidth = ctx.measureText(legAText).width;
    const legAX = legBX - legBWidth - 18;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(legAText, legAX, legendY);
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(legAX - legAWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (!summary || cpu.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Prêt pour la campagne 04A / 04B / 04C', padLeft + plotW / 2, padTop + plotH / 2 - 7);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Cliquez sur ▶ Benchmark LOD pour tracer les courbes', padLeft + plotW / 2, padTop + plotH / 2 + 9);
      ctx.restore();
      return;
    }

    const drawCurve = (values: number[], color: string) => {
      if (values.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xOf(counts[i]);
        const y = padTop + plotH - (v / maxY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = color;
      values.forEach((v, i) => {
        const x = xOf(counts[i]);
        const y = padTop + plotH - (v / maxY) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    drawCurve(cpu, '#f87171');
    if (gpu) drawCurve(gpu, '#38bdf8');

    ctx.restore();
  }
}
