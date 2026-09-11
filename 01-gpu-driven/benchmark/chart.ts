import type { BenchmarkResult } from '../types.ts';

export class CrossoverChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public render(
    classicResults: BenchmarkResult[],
    gpuDrivenResults: BenchmarkResult[],
    crossoverObjectCount: number | null
  ) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fond sombre Nordic Polar Night
    ctx.fillStyle = '#242933';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 60;
    const padRight = 40;
    const padTop = 40;
    const padBottom = 50;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Extraction dynamique des tiers testés
    const tiersSet = new Set<number>();
    classicResults.forEach((r) => tiersSet.add(r.objectCount));
    gpuDrivenResults.forEach((r) => tiersSet.add(r.objectCount));
    const tiers = Array.from(tiersSet).sort((a, b) => a - b);
    const maxObjects = tiers.length > 0 ? Math.max(...tiers) : 5000;

    // Calcul du Y max
    let maxSubmit = 5.0; // minimum 5ms
    for (const r of [...classicResults, ...gpuDrivenResults]) {
      if (r.avgSubmitMs > maxSubmit) maxSubmit = r.avgSubmitMs * 1.15;
    }

    // Grille horizontale Nordic
    ctx.strokeStyle = '#3b4252';
    ctx.lineWidth = 1;
    const gridSteps = 5;
    ctx.fillStyle = '#d8dee9';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = (maxSubmit / gridSteps) * i;
      const y = padTop + plotH - (yVal / maxSubmit) * plotH;

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillText(`${yVal.toFixed(1)} ms`, padLeft - 8, y + 4);
    }

    // Grille verticale & labels X
    ctx.textAlign = 'center';
    for (const p of tiers) {
      const x = padLeft + (p / maxObjects) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      const label = p >= 1000 ? `${p / 1000}k` : `${p}`;
      ctx.fillText(label, x, h - padBottom + 18);
    }

    // Titres des axes
    ctx.fillStyle = '#d8dee9';
    ctx.font = '12px sans-serif';
    ctx.fillText('Nombre d\'objets uniques', padLeft + plotW / 2, h - 15);

    ctx.save();
    ctx.translate(16, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('CPU submit (ms)', 0, 0);
    ctx.restore();

    // Fonction de tracé de courbe
    const drawCurve = (results: BenchmarkResult[], color: string) => {
      if (results.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      results.forEach((r, idx) => {
        const x = padLeft + (r.objectCount / maxObjects) * plotW;
        const y = padTop + plotH - (r.avgSubmitMs / maxSubmit) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Points
      ctx.fillStyle = color;
      results.forEach((r) => {
        const x = padLeft + (r.objectCount / maxObjects) * plotW;
        const y = padTop + plotH - (r.avgSubmitMs / maxSubmit) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // Courbe Test A (Classic Three.js - Nordic Muted Coral / Terracotta #d08770)
    drawCurve(classicResults, '#d08770');

    // Courbe Test B (GPU-driven - Nordic Frost Cyan #88c0d0)
    drawCurve(gpuDrivenResults, '#88c0d0');

    // Mise en évidence du point de croisement (Crossover - Nordic Gold #ebcb8b)
    if (crossoverObjectCount !== null) {
      const xCross = padLeft + (crossoverObjectCount / maxObjects) * plotW;

      ctx.strokeStyle = '#ebcb8b';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xCross, padTop);
      ctx.lineTo(xCross, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ebcb8b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Crossover ~${Math.round(crossoverObjectCount)} obj`, xCross, padTop - 10);
    }

    // Légende en haut à droite
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';

    // Légende Classic
    ctx.fillStyle = '#d08770';
    ctx.fillRect(w - 210, padTop + 8, 12, 12);
    ctx.fillStyle = '#eceff4';
    ctx.fillText('Test A : Three.js classique O(N)', w - 192, padTop + 18);

    // Légende GPU-driven
    ctx.fillStyle = '#88c0d0';
    ctx.fillRect(w - 210, padTop + 26, 12, 12);
    ctx.fillStyle = '#eceff4';
    ctx.fillText('Test B : GPU-driven O(1)', w - 192, padTop + 36);
  }
}
