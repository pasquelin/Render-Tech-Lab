export class GenericLabChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private observer: ResizeObserver | null = null;
  private active = false;
  private currentTitle = '';
  private currentUnit = 'ms';
  private currentData: { label: string; valA: number | null; valB: number | null }[] = [];
  private currentActiveIdx = 0;
  private currentMode: 'classic' | 'gpu-driven' = 'gpu-driven';
  private legendA = 'CPU mesurée';
  private legendB = 'GPU';
  private status = 'Prêt pour la campagne de mesure.';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.observer = new ResizeObserver(() => {
        if (this.active) this.draw();
      });
      this.observer.observe(this.canvas);
    }
  }

  public setActive(active: boolean) {
    this.active = active;
    if (active) this.draw();
  }

  public setStatus(status: string) {
    this.status = status;
    if (this.active) this.draw();
  }

  public reset(status = 'Prêt pour la campagne de mesure.') {
    this.currentTitle = '';
    this.currentUnit = 'ms';
    this.currentData = [];
    this.currentActiveIdx = -1;
    this.currentMode = 'gpu-driven';
    this.legendA = 'CPU mesurée';
    this.legendB = 'GPU';
    this.status = status;
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = '';
    if (this.active) this.draw();
  }

  public update(
    title: string,
    unit: string,
    data: { label: string; valA: number | null; valB: number | null }[],
    activeIdx: number,
    mode: 'classic' | 'gpu-driven',
    legends: { a: string; b: string } = { a: 'CPU mesurée', b: 'GPU' },
  ) {
    this.currentTitle = title;
    this.currentUnit = unit;
    this.currentData = data;
    if (this.canvas.dataset) this.canvas.dataset.chartLabels = data.map(point => point.label).join('|');
    this.currentActiveIdx = activeIdx;
    this.currentMode = mode;
    this.legendA = legends.a;
    this.legendB = legends.b;
    if (this.active) this.draw();
  }

  public draw() {
    if (!this.ctx || !this.active) return;
    const ctx = this.ctx;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 360;
    const h = rect.height > 0 ? rect.height : 176;

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Fond dégradé subtil
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(24, 30, 42, 0.95)');
    bgGrad.addColorStop(1, 'rgba(15, 20, 30, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (this.currentData.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.status, w / 2, h / 2, Math.max(120, w - 24));
      ctx.restore();
      return;
    }

    // Titre et unité
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.currentTitle} (${this.currentUnit})`, 12, 16);
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.fillText(this.status, w - 12, 16, Math.max(80, w / 2));

    // Légende sur une ligne réservée, en deux colonnes stables.
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171'; // Rouge Test A
    ctx.fillRect(12, 27, 8, 8);
    ctx.fillText(this.legendA, 24, 34, Math.max(60, w / 2 - 32));

    ctx.fillStyle = '#22d3ee'; // Cyan Test B
    ctx.fillRect(w / 2 + 4, 27, 8, 8);
    ctx.fillText(this.legendB, w / 2 + 16, 34, Math.max(60, w / 2 - 28));

    // Dimensions tracés
    const padLeft = 20;
    const padRight = 20;
    const padTop = 50;
    const padBottom = 26;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Lignes de repère horizontales
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const yLine = padTop + (plotH / 3) * g;
      ctx.beginPath();
      ctx.moveTo(padLeft, yLine);
      ctx.lineTo(w - padRight, yLine);
      ctx.stroke();
    }

    // Valeur max pour échelle
    let maxVal = 0.01;
    for (const d of this.currentData) {
      maxVal = Math.max(maxVal, d.valA ?? 0, d.valB ?? 0);
    }

    const n = this.currentData.length;
    const groupW = plotW / n;
    const barW = Math.min(18, Math.max(8, (groupW - 10) / 2));

    for (let i = 0; i < n; i++) {
      const d = this.currentData[i];
      const centerX = padLeft + i * groupW + groupW / 2;
      const isSelected = i === this.currentActiveIdx;

      // Fond de sélection pour la charge active
      if (isSelected) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.fillRect(padLeft + i * groupW + 2, padTop - 6, groupW - 4, plotH + 8);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
        ctx.strokeRect(padLeft + i * groupW + 2, padTop - 6, groupW - 4, plotH + 8);
      }

      // Barre A (Three.js CPU / Rouge)
      const hA = d.valA === null ? 0 : Math.max(2, (d.valA / maxVal) * (plotH - 12));
      const yA = padTop + plotH - hA;
      if (d.valA !== null) {
        ctx.fillStyle = this.currentMode === 'classic' ? '#f87171' : 'rgba(248, 113, 113, 0.40)';
        ctx.fillRect(centerX - barW - 1, yA, barW, hA);
      }

      // Barre B (GPU-Driven / Cyan)
      const hB = d.valB === null ? 0 : Math.max(2, (d.valB / maxVal) * (plotH - 12));
      const yB = padTop + plotH - hB;
      if (d.valB !== null) {
        ctx.fillStyle = this.currentMode === 'gpu-driven' ? '#22d3ee' : 'rgba(34, 211, 238, 0.40)';
        ctx.fillRect(centerX + 1, yB, barW, hB);
      }

      // Valeur numérique au-dessus
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      if (isSelected) {
        ctx.fillStyle = this.currentMode === 'classic' ? '#f87171' : '#22d3ee';
        const v = this.currentMode === 'classic' ? d.valA : d.valB;
        if (v === null) continue;
        const valStr = v < 1 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
        const topY = this.currentMode === 'classic' ? yA : yB;
        ctx.fillText(valStr, centerX, Math.max(padTop - 1, topY - 3));
      }

      // Libellé sous la colonne
      ctx.font = isSelected ? 'bold 9px monospace' : '8px monospace';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.fillText(d.label, centerX, h - 10);
    }

    ctx.restore();
  }

  public dispose(): void {
    this.active = false;
    this.observer?.disconnect?.();
    this.observer = null;
  }
}
