import type { BenchmarkResult } from '../contracts.ts';

export class CrossoverChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastClassic: BenchmarkResult[] = [];
  private lastGpuDriven: BenchmarkResult[] = [];
  private lastCrossover: number | null = null;
  /**
   * Le canvas de graphe est partagé entre modules : un graphe inactif ne doit
   * jamais peindre, sinon un simple resize remplace le tracé du module affiché.
   */
  public active = true;
  private observer: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Redimensionnement automatique réactif
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.observer = new ResizeObserver(() => {
        this.render(this.lastClassic, this.lastGpuDriven, this.lastCrossover);
      });
      this.observer.observe(this.canvas);
    }

    // Affichage immédiat de la grille et des axes dès l'instanciation (évite un rectangle vide)
    this.render([], [], null);
  }

  /** Donne ou retire à ce graphe la propriété du canvas partagé. */
  public setActive(active: boolean) {
    this.active = active;
    if (active) this.render(this.lastClassic, this.lastGpuDriven, this.lastCrossover);
  }

  public dispose() {
    this.active = false;
    this.observer?.disconnect();
    this.observer = null;
  }

  public reset() {
    this.lastClassic = [];
    this.lastGpuDriven = [];
    this.lastCrossover = null;
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = '';
    if (this.active) this.render([], [], null);
  }

  public render(
    classicResults: BenchmarkResult[] = [],
    gpuDrivenResults: BenchmarkResult[] = [],
    crossoverObjectCount: number | null = null
  ) {
    this.lastClassic = classicResults;
    this.lastGpuDriven = gpuDrivenResults;
    this.lastCrossover = crossoverObjectCount;
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = [...classicResults, ...gpuDrivenResults].map(result => String(result.objectCount)).join('|');

    const ctx = this.ctx;
    if (!ctx || !this.active) return;

    // Support Retina / HiDPI pour une netteté maximale sur Mac
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : (this.canvas.width / dpr || 380);
    const cssH = rect.height > 0 ? rect.height : (this.canvas.height / dpr || 176);

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

    // Effacement transparent fluide : le conteneur parent assure bg-base-100 et rounded-box overflow-hidden
    ctx.clearRect(0, 0, w, h);

    const padLeft = 68;
    const padRight = 16;
    const padTop = 26;
    const padBottom = 38;

    const plotW = Math.max(10, w - padLeft - padRight);
    const plotH = Math.max(10, h - padTop - padBottom);

    // Extraction dynamique des paliers (tiers) ou paliers étalons par défaut (500 → 5k)
    const tiersSet = new Set<number>();
    classicResults.forEach((r) => tiersSet.add(r.objectCount));
    gpuDrivenResults.forEach((r) => tiersSet.add(r.objectCount));
    const recordedTiers = Array.from(tiersSet).sort((a, b) => a - b);
    const tiers = recordedTiers.length > 0 ? recordedTiers : [500, 1000, 2000, 5000];
    const maxObjects = Math.max(...tiers);

    // Calcul du Y max dynamique (minimum 5.0 ms pour une échelle lisible au repos)
    let maxSubmit = 5.0;
    for (const r of [...classicResults, ...gpuDrivenResults]) {
      if (r.avgSubmitMs > maxSubmit) maxSubmit = r.avgSubmitMs * 1.15;
    }

    // Tracé du cadre du repère
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Grille horizontale (5 pas réguliers)
    const gridSteps = 5;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = (maxSubmit / gridSteps) * i;
      const y = padTop + plotH - (yVal / maxSubmit) * plotH;

      ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`${yVal.toFixed(1)} ms`, padLeft - 6, y + 3.5);
    }

    // Grille verticale & labels X
    ctx.textAlign = 'center';
    for (const p of tiers) {
      const x = padLeft + (p / maxObjects) * plotW;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      const label = p >= 1000 ? `${p / 1000}k` : `${p}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(label, x, padTop + plotH + 15);
    }

    // Titres des axes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText("Nombre d'objets uniques", padLeft + plotW / 2, h - 8);

    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('CPU submit (ms)', 0, 0);
    ctx.restore();

    // Légende compacte en haut à droite
    const legendY = padTop - 10;
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';

    // Test B (GPU-driven)
    const legBText = 'GPU-driven O(1)';
    const legBWidth = ctx.measureText(legBText).width;
    const legBX = padLeft + plotW;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(legBText, legBX, legendY);
    ctx.fillStyle = '#38bdf8'; // Cyan WebGPU
    ctx.beginPath();
    ctx.arc(legBX - legBWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Test A (Three.js Classic)
    const legAText = 'Three.js O(N)';
    const legAWidth = ctx.measureText(legAText).width;
    const legAX = legBX - legBWidth - 18;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(legAText, legAX, legendY);
    ctx.fillStyle = '#f87171'; // Coral CPU
    ctx.beginPath();
    ctx.arc(legAX - legAWidth - 6, legendY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Message d'état informatif si aucune mesure n'a encore été effectuée
    const hasData = classicResults.length > 0 || gpuDrivenResults.length > 0;
    if (!hasData) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Prêt pour la campagne de mesure', padLeft + plotW / 2, padTop + plotH / 2 - 7);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Cliquez sur ▶ Benchmark pour tracer les courbes', padLeft + plotW / 2, padTop + plotH / 2 + 9);

      ctx.restore();
      return;
    }

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

    // Courbe Test A (Classic Three.js)
    drawCurve(classicResults, '#f87171');

    // Courbe Test B (GPU-driven)
    drawCurve(gpuDrivenResults, '#38bdf8');

    // Mise en évidence du point de croisement (Crossover)
    if (crossoverObjectCount !== null) {
      const xCross = padLeft + (crossoverObjectCount / maxObjects) * plotW;

      ctx.strokeStyle = '#facc15';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xCross, padTop);
      ctx.lineTo(xCross, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Crossover ~${Math.round(crossoverObjectCount)} obj`, xCross, padTop + 14);
    }

    ctx.restore();
  }
}
