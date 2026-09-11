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

    // Fond sombre
    ctx.fillStyle = '#11151c';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 60;
    const padRight = 40;
    const padTop = 40;
    const padBottom = 50;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Extraction dynamique des paliers testés
    const paliersSet = new Set<number>();
    classicResults.forEach((r) => paliersSet.add(r.objectCount));
    gpuDrivenResults.forEach((r) => paliersSet.add(r.objectCount));
    const paliers = Array.from(paliersSet).sort((a, b) => a - b);
    const maxObjects = paliers.length > 0 ? Math.max(...paliers) : 5000;

    // Calcul du Y max
    let maxSubmit = 5.0; // minimum 5ms
    for (const r of [...classicResults, ...gpuDrivenResults]) {
      if (r.avgSubmitMs > maxSubmit) maxSubmit = r.avgSubmitMs * 1.15;
    }

    // Grille horizontale
    ctx.strokeStyle = '#222d3d';
    ctx.lineWidth = 1;
    const gridSteps = 5;
    ctx.fillStyle = '#6b7d96';
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
    for (const p of paliers) {
      const x = padLeft + (p / maxObjects) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      const label = p >= 1000 ? `${p / 1000}k` : `${p}`;
      ctx.fillText(label, x, h - padBottom + 18);
    }

    // Titres des axes
    ctx.fillStyle = '#94a3b8';
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
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // Courbe Test A (Classic Three.js - Rouge orangé)
    drawCurve(classicResults, '#ef4444');

    // Courbe Test B (GPU-driven - Cyan électrique)
    drawCurve(gpuDrivenResults, '#06b6d4');

    // Mise en évidence du point de croisement (Crossover)
    if (crossoverObjectCount !== null) {
      const xCross = padLeft + (crossoverObjectCount / maxObjects) * plotW;

      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xCross, padTop);
      ctx.lineTo(xCross, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Crossover ~${Math.round(crossoverObjectCount)} obj`, xCross, padTop - 12);
    }

    // Légende en haut à droite
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';

    // Légende Classic
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(w - 220, padTop + 10, 14, 14);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText('Test A : Three.js classique O(N)', w - 200, padTop + 22);

    // Légende GPU-driven
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(w - 220, padTop + 32, 14, 14);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText('Test B : GPU-driven O(1)', w - 200, padTop + 44);
  }
}
