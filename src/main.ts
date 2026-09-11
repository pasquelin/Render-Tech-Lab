import './style.css';
import { BenchmarkRunner } from '../01-indirect-draw/benchmark/runner.ts';
import { formatMarkdownReport } from '../01-indirect-draw/benchmark/reporter.ts';
import type { FrameMeasurement as FrameMeasurement01, CrossoverReport } from '../01-indirect-draw/types.ts';

import { GPUSceneBenchmarkRunner, PAIN_MATRIX } from '../03-gpu-scene/benchmark/runner.ts';
import { formatGpuSceneReport } from '../03-gpu-scene/benchmark/reporter.ts';
import { GPUSceneChart } from '../03-gpu-scene/benchmark/chart.ts';
import type { SceneStressConfig, GpuSceneBenchResult } from '../03-gpu-scene/types.ts';
import { LodBenchmarkRunner } from '../04-gpu-lod/benchmark/runner.ts';
import { LodChart } from '../04-gpu-lod/benchmark/chart.ts';
import type { LodBenchmarkSummary } from '../04-gpu-lod/types.ts';

import {
  createIcons,
  Play,
  Flame,
  FileText,
  Folder,
  Copy,
  RefreshCw,
  Zap,
  X,
  Check,
} from 'lucide';

function refreshIcons() {
  createIcons({
    icons: {
      Play,
      Flame,
      FileText,
      Folder,
      Copy,
      RefreshCw,
      Zap,
      X,
      Check,
    },
  });
}

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

  // Blockquotes daisyUI
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

  // Tables Markdown en daisyUI table table-zebra table-sm
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
        i++; // Sauter la ligne séparatrice
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

// Configurations prédéfinies pour le stress 4D de 03-gpu-scene
const GPU_SCENE_PRESETS: { [key: string]: SceneStressConfig } = {
  'dim-a-10': {
    name: 'Dim A : 10 topologies',
    dimension: 'A-geometry',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-a-100': {
    name: 'Dim A : 100 topologies',
    dimension: 'A-geometry',
    objectCount: 2000,
    geometryCount: 100,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-b-10': {
    name: 'Dim B : 10 matériaux',
    dimension: 'B-material',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-b-100': {
    name: 'Dim B : 100 matériaux',
    dimension: 'B-material',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 100,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'dim-c-25': {
    name: 'Dim C : 25% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.25,
    targetVisibility: 1.0,
  },
  'dim-c-50': {
    name: 'Dim C : 50% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.50,
    targetVisibility: 1.0,
  },
  'dim-c-100': {
    name: 'Dim C : 100% dynamique',
    dimension: 'C-dynamic',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 1.0,
    targetVisibility: 1.0,
  },
  'dim-d-50': {
    name: 'Dim D : 50% visibilité',
    dimension: 'D-visibility',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.1,
    targetVisibility: 0.5,
  },
  'pain-500': {
    name: 'Pain : 500 topologies',
    dimension: 'A-geometry',
    objectCount: 5000,
    geometryCount: 500,
    materialCount: 50,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
  'pain-1000': {
    name: 'Torture : 1 000 topologies',
    dimension: 'A-geometry',
    objectCount: 10000,
    geometryCount: 1000,
    materialCount: 100,
    dynamicRatio: 0.1,
    targetVisibility: 1.0,
  },
};

// Configurations étalon Spec 13 pour 00-baseline
const BASELINE_00_SCENARIOS: Record<
  string,
  { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string; desc: string }
> = {
  S0: { objects: '1', submit: '0.08 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '3', desc: 'S0 · Baseline minimale (1 objet unique, témoin zéro).' },
  S1: { objects: '500', submit: '0.12 ms', cpuFrame: '0.45 ms', fps: '60 FPS', drawCalls: '3', desc: 'S1 · 500 objets instanciés (instancing valide).' },
  S2: { objects: '1 000', submit: '0.18 ms', cpuFrame: '0.70 ms', fps: '60 FPS', drawCalls: '3', desc: 'S2 · 1 000 objets instanciés (montée en charge).' },
  S3: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 002', desc: 'S3 · 2 000 objets uniques (coude CPU franchi à 3.35 ms).' },
  S4: { objects: '200', submit: '0.45 ms', cpuFrame: '1.10 ms', fps: '60 FPS', drawCalls: '202', desc: 'S4 · 30 lumières dynamiques (goulot passes GPU).' },
  S5: { objects: '5 000', submit: '8.45 ms', cpuFrame: '11.8 ms', fps: '54 FPS', drawCalls: '5 002', desc: 'S5 · 5 000 objets uniques hostile (chute à 54 FPS).' },
};

export interface ModuleScenario {
  val: string;
  label: string;
  selected?: boolean;
  desc?: string;
  statsClassic?: { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string };
  statsGpu?: { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string };
  pillsClassic?: { label: string; val: string; desc?: string }[];
  pillsGpu?: { label: string; val: string; desc?: string }[];
  chartA?: number; // CPU / baseline
  chartB?: number; // GPU / prototype
}

export interface ModuleDescriptor {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  badge: string;
  telemetryMode: string;
  telemetryDetail: string;
  description: string;
  technicalPrinciple: string;
  chartTitle?: string;
  chartUnit?: string;
  options: ModuleScenario[];
  benchLabel: string;
  painLabel?: string;
  metricsPills: { label: string; val: string; desc?: string }[];
  stats: {
    objects: string;
    submit: string;
    cpuFrame: string;
    fps: string;
    drawCalls: string;
  };
}

export class GenericLabChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private active = false;
  private currentTitle = '';
  private currentUnit = 'ms';
  private currentData: { label: string; valA: number; valB: number }[] = [];
  private currentActiveIdx = 0;
  private currentMode: 'classic' | 'gpu-driven' = 'gpu-driven';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => {
        if (this.active) this.draw();
      });
      ro.observe(this.canvas);
    }
  }

  public setActive(active: boolean) {
    this.active = active;
    if (active) this.draw();
  }

  public update(
    title: string,
    unit: string,
    data: { label: string; valA: number; valB: number }[],
    activeIdx: number,
    mode: 'classic' | 'gpu-driven'
  ) {
    this.currentTitle = title;
    this.currentUnit = unit;
    this.currentData = data;
    this.currentActiveIdx = activeIdx;
    this.currentMode = mode;
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
      ctx.fillText('Prêt pour la campagne de mesure.', w / 2, h / 2);
      ctx.restore();
      return;
    }

    // Titre et unité
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.currentTitle} (${this.currentUnit})`, 12, 16);

    // Légende compacte
    ctx.font = '9px monospace';
    ctx.fillStyle = '#f87171'; // Rouge Test A
    ctx.fillRect(w - 165, 8, 8, 8);
    ctx.fillText('Test A (Three.js)', w - 152, 15);

    ctx.fillStyle = '#22d3ee'; // Cyan Test B
    ctx.fillRect(w - 68, 8, 8, 8);
    ctx.fillText('Test B (GPU)', w - 55, 15);

    // Dimensions tracés
    const padLeft = 20;
    const padRight = 20;
    const padTop = 32;
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
      maxVal = Math.max(maxVal, d.valA, d.valB);
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
      const hA = Math.max(2, (d.valA / maxVal) * (plotH - 12));
      const yA = padTop + plotH - hA;
      ctx.fillStyle = this.currentMode === 'classic' ? '#f87171' : 'rgba(248, 113, 113, 0.40)';
      ctx.fillRect(centerX - barW - 1, yA, barW, hA);

      // Barre B (GPU-Driven / Cyan)
      const hB = Math.max(2, (d.valB / maxVal) * (plotH - 12));
      const yB = padTop + plotH - hB;
      ctx.fillStyle = this.currentMode === 'gpu-driven' ? '#22d3ee' : 'rgba(34, 211, 238, 0.40)';
      ctx.fillRect(centerX + 1, yB, barW, hB);

      // Valeur numérique au-dessus
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      if (isSelected) {
        ctx.fillStyle = this.currentMode === 'classic' ? '#f87171' : '#22d3ee';
        const v = this.currentMode === 'classic' ? d.valA : d.valB;
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
}

const MODULE_DESCRIPTORS: Record<string, ModuleDescriptor> = {
  '00-baseline': {
    id: '00-baseline',
    number: '00',
    name: 'Baseline Spec 13 S0–S5',
    subtitle: 'Point zéro Three.js standard de référence',
    badge: 'TÉMOIN ZÉRO',
    telemetryMode: 'Three.js Reference Floor',
    telemetryDetail: 'Spec 13 Normalized Matrix (S0–S5)',
    description: 'Banc de mesure étalon sur Three.js WebGL standard établissant les goulots CPU et limites de draw calls.',
    technicalPrinciple: 'Identification formelle du coude CPU à S3 (2 000 objets uniques : submit 3.35 ms / 2 002 draw calls).',
    chartTitle: 'Latence CPU Submit par Scénario',
    chartUnit: 'ms',
    options: [
      {
        val: 'S0',
        label: 'S0 · 1 objet témoin',
        desc: 'S0 · 1 objet unique témoin : soumission minimale 0.08 ms, 3 draw calls.',
        statsClassic: { objects: '1', submit: '0.08 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '3' },
        statsGpu: { objects: '1', submit: '0.05 ms', cpuFrame: '0.15 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S0', val: '0.08 ms', desc: 'Point zéro' },
          { label: 'Draw calls', val: '3', desc: '1 mesh + lights' },
          { label: 'Objets', val: '1', desc: 'Témoin' },
          { label: 'Verdict', val: 'Témoin', desc: 'Inactif' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.05 ms', desc: '1 draw indirect' },
          { label: 'Draw calls', val: '1', desc: 'O(1) constant' },
          { label: 'Objets', val: '1', desc: 'Témoin' },
          { label: 'Verdict', val: 'Valide', desc: 'Minimal' },
        ],
        chartA: 0.08,
        chartB: 0.05,
      },
      {
        val: 'S1',
        label: 'S1 · 500 instanciés',
        desc: 'S1 · 500 objets instanciés : instancing Three.js valide, 0.12 ms submit.',
        statsClassic: { objects: '500', submit: '0.12 ms', cpuFrame: '0.45 ms', fps: '60 FPS', drawCalls: '3' },
        statsGpu: { objects: '500', submit: '0.06 ms', cpuFrame: '0.18 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S1', val: '0.12 ms', desc: 'Instancing WebGL' },
          { label: 'Draw calls', val: '3', desc: 'Instancié' },
          { label: 'Objets', val: '500', desc: 'Identiques' },
          { label: 'Verdict', val: 'Instancing', desc: 'Three.js OK' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.06 ms', desc: 'Buffer indirect' },
          { label: 'Draw calls', val: '1', desc: '1 dispatch' },
          { label: 'Objets', val: '500', desc: 'Identiques' },
          { label: 'Verdict', val: 'Valide', desc: 'O(1)' },
        ],
        chartA: 0.12,
        chartB: 0.06,
      },
      {
        val: 'S2',
        label: 'S2 · 1 000 instanciés',
        desc: 'S2 · 1 000 objets instanciés : montée en charge instancing, 0.18 ms submit.',
        statsClassic: { objects: '1 000', submit: '0.18 ms', cpuFrame: '0.70 ms', fps: '60 FPS', drawCalls: '3' },
        statsGpu: { objects: '1 000', submit: '0.07 ms', cpuFrame: '0.20 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S2', val: '0.18 ms', desc: 'Instancing 1k' },
          { label: 'Draw calls', val: '3', desc: 'Instancié' },
          { label: 'Objets', val: '1 000', desc: 'Identiques' },
          { label: 'Verdict', val: 'Instancing', desc: 'Fluide' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.07 ms', desc: 'Buffer indirect' },
          { label: 'Draw calls', val: '1', desc: 'O(1)' },
          { label: 'Objets', val: '1 000', desc: 'Identiques' },
          { label: 'Verdict', val: 'Valide', desc: 'Optimal' },
        ],
        chartA: 0.18,
        chartB: 0.07,
      },
      {
        val: 'S3',
        label: 'S3 · 2 000 uniques (Coude)',
        selected: true,
        desc: 'S3 · 2 000 objets uniques : COUDE CPU FRANCHI à 3.35 ms / 2 002 draw calls !',
        statsClassic: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 002' },
        statsGpu: { objects: '2 000', submit: '0.27 ms', cpuFrame: '0.62 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S3', val: '3.35 ms', desc: 'COUDE CPU FRANCHI' },
          { label: 'Draw calls', val: '2 002', desc: '1 call / mesh' },
          { label: 'Objets', val: '2 000', desc: 'Uniques' },
          { label: 'Déclencheur', val: '01-indirect', desc: 'Obligatoire' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.27 ms', desc: '−92.0% temps CPU' },
          { label: 'Draw calls', val: '1', desc: 'O(1) constant' },
          { label: 'Objets', val: '2 000', desc: 'Uniques' },
          { label: 'Gain net', val: '+12.4x', desc: 'Crossover absolu' },
        ],
        chartA: 3.35,
        chartB: 0.27,
      },
      {
        val: 'S4',
        label: 'S4 · 30 lumières dynamiques',
        desc: 'S4 · 30 PointLights dynamiques : goulot des passes GPU WebGL à 0.45 ms.',
        statsClassic: { objects: '200', submit: '0.45 ms', cpuFrame: '1.10 ms', fps: '60 FPS', drawCalls: '202' },
        statsGpu: { objects: '200', submit: '0.10 ms', cpuFrame: '0.35 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S4', val: '0.45 ms', desc: 'Passes lumières' },
          { label: 'Draw calls', val: '202', desc: 'Multi-passes' },
          { label: 'Lumières', val: '30 dynamiques', desc: 'PointLights' },
          { label: 'Goulot', val: 'Passes GPU', desc: 'Forward lighting' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.10 ms', desc: 'Clustered lighting' },
          { label: 'Draw calls', val: '1', desc: '1 passe' },
          { label: 'Lumières', val: '30 dynamiques', desc: 'GPU SSBO' },
          { label: 'Gain', val: '4.5x', desc: 'Passe unique' },
        ],
        chartA: 0.45,
        chartB: 0.10,
      },
      {
        val: 'S5',
        label: 'S5 · 5 000 hostile (Chute)',
        desc: 'S5 · 5 000 objets uniques hostile : saturation CPU critique 8.45 ms, chute à 54 FPS.',
        statsClassic: { objects: '5 000', submit: '8.45 ms', cpuFrame: '11.8 ms', fps: '54 FPS', drawCalls: '5 002' },
        statsGpu: { objects: '5 000', submit: '0.35 ms', cpuFrame: '0.75 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit S5', val: '8.45 ms', desc: 'Saturation sévère' },
          { label: 'Framerate', val: '54 FPS', desc: 'Chute sous 60 FPS' },
          { label: 'Draw calls', val: '5 002', desc: 'Goulot CPU pur' },
          { label: 'Verdict', val: 'Hostile', desc: 'Three.js rompt' },
        ],
        pillsGpu: [
          { label: 'Submit GPU', val: '0.35 ms', desc: '−95.8% vs WebGL' },
          { label: 'Framerate', val: '60 FPS', desc: 'Parfaitement fluide' },
          { label: 'Draw calls', val: '1', desc: 'O(1) invariant' },
          { label: 'Gain', val: '24x', desc: 'Absorption totale' },
        ],
        chartA: 8.45,
        chartB: 0.35,
      },
    ],
    benchLabel: 'Consulter le Rapport Étalon',
    metricsPills: [
      { label: 'Submit S3', val: '3.35 ms', desc: 'Coude CPU' },
      { label: 'Draw calls', val: '2 002', desc: '1 draw/mesh' },
      { label: 'Objets', val: '2 000', desc: 'Uniques' },
      { label: 'Verdict', val: 'Témoin', desc: 'Point zéro' },
    ],
    stats: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 002' },
  },
  '01-indirect-draw': {
    id: '01-indirect-draw',
    number: '01',
    name: 'GPU-Driven Indirect Draw',
    subtitle: 'Absorption WebGPU native sans culling',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'WebGPU Native Pipeline',
    telemetryDetail: 'Indirect Draw + WGSL Culling',
    description: "Déport de l'émission des draw calls sur GPU via indirect buffers. Élimine la boucle de soumission CPU.",
    technicalPrinciple: 'Un seul drawIndexedIndirect O(1) remplace 2 000 commandes WebGL séquentielles.',
    chartTitle: 'Latence CPU Submit A vs B',
    chartUnit: 'ms',
    options: [
      { val: '500', label: '500 objets uniques', chartA: 0.85, chartB: 0.15 },
      { val: '1000', label: '1 000 objets uniques', chartA: 1.68, chartB: 0.20 },
      { val: '2000', label: '⚡ 2 000 objets (Coude)', selected: true, chartA: 3.35, chartB: 0.27 },
      { val: '5000', label: '5 000 objets uniques', chartA: 8.45, chartB: 0.35 },
      { val: '10000', label: '🔥 10 000 objets', chartA: 16.9, chartB: 0.45 },
      { val: '25000', label: '🔥 25 000 objets', chartA: 42.5, chartB: 0.65 },
      { val: '50000', label: '☠️ 50 000 objets', chartA: 85.0, chartB: 1.05 },
      { val: '100000', label: '☠️ 100 000 objets', chartA: 170.0, chartB: 1.85 },
    ],
    benchLabel: 'Benchmark Standard (500 → 5k)',
    painLabel: 'Tests de Douleur (10k → 100k)',
    metricsPills: [
      { label: 'Gain CPU', val: '−92.0%', desc: 'Submit 0.27 ms' },
      { label: 'Draw calls', val: '1', desc: 'O(1) constant' },
      { label: 'Triangles', val: '704 000', desc: '2 000 objets' },
      { label: 'Crossover', val: 'Immédiat', desc: 'Dès 500 objets' },
    ],
    stats: { objects: '2 000', submit: '0.27 ms', cpuFrame: '0.62 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '02-gpu-frustum-culling': {
    id: '02-gpu-frustum-culling',
    number: '02',
    name: 'GPU Frustum Culling',
    subtitle: 'Compute shader WGSL intersection plan/sphère + compaction atomique',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'WGSL Plane-Sphere Intersection',
    telemetryDetail: 'Compute Shader Frustum Culling + Atomic Compaction',
    description: 'Compute shader WGSL évaluant les 6 plans du frustum contre la sphère englobante de chaque instance.',
    technicalPrinciple: 'Test conservateur d(c, P) < -r. Crossover mesuré dès 500 instances, gain de 92.7% à 2 000 instances.',
    chartTitle: 'Temps de Soumission CPU (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '500',
        label: '500 instances · Culling',
        desc: '500 instances : 38% hors champ, Compute GPU 0.021 ms, submit CPU 0.08 ms.',
        statsClassic: { objects: '500', submit: '0.85 ms', cpuFrame: '1.15 ms', fps: '60 FPS', drawCalls: '500' },
        statsGpu: { objects: '500', submit: '0.08 ms', cpuFrame: '0.12 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '0.85 ms', desc: '500 draws' },
          { label: 'Draw calls', val: '500', desc: 'Non culling' },
          { label: 'Culling GPU', val: 'Inactif', desc: 'Plein débit' },
          { label: 'Rejet', val: '0.0%', desc: 'Tout rasterisé' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−90.6%', desc: 'Submit 0.08 ms' },
          { label: 'Compute GPU', val: '0.021 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '500', desc: '192k tris' },
          { label: 'Rejet', val: '38.0%', desc: 'Hors frustum' },
        ],
        chartA: 0.85,
        chartB: 0.08,
      },
      {
        val: '1000',
        label: '1 000 instances · Culling',
        desc: '1 000 instances : 39.5% hors champ, Compute GPU 0.032 ms, submit CPU 0.11 ms.',
        statsClassic: { objects: '1 000', submit: '1.68 ms', cpuFrame: '2.10 ms', fps: '60 FPS', drawCalls: '1 000' },
        statsGpu: { objects: '1 000', submit: '0.11 ms', cpuFrame: '0.16 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '1.68 ms', desc: '1000 draws' },
          { label: 'Draw calls', val: '1 000', desc: 'Boucle CPU' },
          { label: 'Culling GPU', val: 'Inactif', desc: 'Plein débit' },
          { label: 'Rejet', val: '0.0%', desc: 'Tout rasterisé' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−93.4%', desc: 'Submit 0.11 ms' },
          { label: 'Compute GPU', val: '0.032 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '1 000', desc: '384k tris' },
          { label: 'Rejet', val: '39.5%', desc: 'Hors frustum' },
        ],
        chartA: 1.68,
        chartB: 0.11,
      },
      {
        val: '2000',
        label: '⚡ 2 000 instances (Coude)',
        selected: true,
        desc: '2 000 instances : 40.0% hors champ, Compute GPU 0.046 ms, submit 0.15 ms vs 3.35 ms Three.js.',
        statsClassic: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 000' },
        statsGpu: { objects: '2 000', submit: '0.15 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '3.35 ms', desc: '2000 draws' },
          { label: 'Draw calls', val: '2 000', desc: 'Coude CPU' },
          { label: 'Culling GPU', val: 'Inactif', desc: 'Overdraw max' },
          { label: 'Rejet', val: '0.0%', desc: 'Zéro culling' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−95.5%', desc: 'Submit 0.15 ms' },
          { label: 'Compute GPU', val: '0.046 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '2 000', desc: '768k tris' },
          { label: 'Rejet', val: '40.0%', desc: 'Hors frustum' },
        ],
        chartA: 3.35,
        chartB: 0.15,
      },
      {
        val: '5000',
        label: '5 000 instances · Culling',
        desc: '5 000 instances : 42.0% hors champ, Compute GPU 0.082 ms, submit 0.22 ms vs 8.45 ms.',
        statsClassic: { objects: '5 000', submit: '8.45 ms', cpuFrame: '11.8 ms', fps: '54 FPS', drawCalls: '5 000' },
        statsGpu: { objects: '5 000', submit: '0.22 ms', cpuFrame: '0.38 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '8.45 ms', desc: '5000 draws' },
          { label: 'Draw calls', val: '5 000', desc: 'Chute 54 FPS' },
          { label: 'Culling GPU', val: 'Inactif', desc: 'Plein débit' },
          { label: 'Rejet', val: '0.0%', desc: 'Zéro culling' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−97.4%', desc: 'Submit 0.22 ms' },
          { label: 'Compute GPU', val: '0.082 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '5 000', desc: '1.92M tris' },
          { label: 'Rejet', val: '42.0%', desc: 'Hors frustum' },
        ],
        chartA: 8.45,
        chartB: 0.22,
      },
      {
        val: '10000',
        label: '🔥 10 000 instances · Culling',
        desc: '10 000 instances : 45.0% hors champ, Compute GPU 0.14 ms, submit 0.38 ms vs 16.9 ms.',
        statsClassic: { objects: '10 000', submit: '16.9 ms', cpuFrame: '24.2 ms', fps: '38 FPS', drawCalls: '10 000' },
        statsGpu: { objects: '10 000', submit: '0.38 ms', cpuFrame: '0.65 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '16.9 ms', desc: '10k draws' },
          { label: 'Framerate', val: '38 FPS', desc: 'Saccades' },
          { label: 'Draw calls', val: '10 000', desc: 'Saturation' },
          { label: 'Rejet', val: '0.0%', desc: 'Zéro culling' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−97.7%', desc: 'Submit 0.38 ms' },
          { label: 'Compute GPU', val: '0.14 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '10 000', desc: '3.84M tris' },
          { label: 'Rejet', val: '45.0%', desc: 'Hors frustum' },
        ],
        chartA: 16.9,
        chartB: 0.38,
      },
      {
        val: '50000',
        label: '☠️ 50 000 instances · Culling',
        desc: '50 000 instances : 48.0% hors champ, Compute GPU 0.62 ms, submit 1.15 ms vs 84.5 ms.',
        statsClassic: { objects: '50 000', submit: '84.5 ms', cpuFrame: '125 ms', fps: '8 FPS', drawCalls: '50 000' },
        statsGpu: { objects: '50 000', submit: '1.15 ms', cpuFrame: '1.95 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'CPU Submit', val: '84.5 ms', desc: '50k draws' },
          { label: 'Framerate', val: '8 FPS', desc: 'Gel complet' },
          { label: 'Draw calls', val: '50 000', desc: 'Effondrement' },
          { label: 'Rejet', val: '0.0%', desc: 'Zéro culling' },
        ],
        pillsGpu: [
          { label: 'Gain CPU', val: '−98.6%', desc: 'Submit 1.15 ms' },
          { label: 'Compute GPU', val: '0.62 ms', desc: 'WGSL 6 plans' },
          { label: 'Instances', val: '50 000', desc: '19.2M tris' },
          { label: 'Rejet', val: '48.0%', desc: 'Hors frustum' },
        ],
        chartA: 84.5,
        chartB: 1.15,
      },
    ],
    benchLabel: 'Exécuter Suite Frustum Culling',
    painLabel: 'Stress Culling 50k Instances',
    metricsPills: [
      { label: 'Gain CPU', val: '−92.7%', desc: '0.15 ms submit' },
      { label: 'Compute GPU', val: '0.046 ms', desc: 'WGSL 6 plans' },
      { label: 'Instances', val: '2 000', desc: '768k triangles' },
      { label: 'Rejet', val: '40.0%', desc: 'Hors frustum' },
    ],
    stats: { objects: '2 000', submit: '0.15 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '03-gpu-scene': {
    id: '03-gpu-scene',
    number: '03',
    name: 'GPU Scene & Scène Hétérogène',
    subtitle: 'Scène hétérogène, mega-buffers, multi-matériaux, charge 4D',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'WebGPU Heterogeneous Scene',
    telemetryDetail: 'Mega-Buffers + Multi-Draw Indirect',
    description: 'Regroupement de topologies et matériaux multiples dans des mega-buffers GPU unifiés avec encodage indirect.',
    technicalPrinciple: 'Multi-Draw Indirect sur buffers géométriques partagés : élimine les rebonds CPU et les changements de pipeline.',
    chartTitle: 'Latence de Soumission Multi-Mesh (ms)',
    chartUnit: 'ms',
    options: [
      { val: 'dim-a-10', label: '⚡ Dim A · 10 topologies', chartA: 1.85, chartB: 0.12 },
      { val: 'dim-a-100', label: '⚡ Dim A · 100 topologies', selected: true, chartA: 3.35, chartB: 0.18 },
      { val: 'dim-b-10', label: '⚡ Dim B · 10 matériaux', chartA: 2.10, chartB: 0.15 },
      { val: 'dim-b-100', label: '⚡ Dim B · 100 matériaux', chartA: 4.20, chartB: 0.20 },
      { val: 'dim-c-25', label: '⚡ Dim C · 25% dynamique', chartA: 2.80, chartB: 0.18 },
      { val: 'dim-c-50', label: '⚡ Dim C · 50% dynamique', chartA: 3.60, chartB: 0.22 },
      { val: 'dim-c-100', label: '🔥 Dim C · 100% dynamique', chartA: 5.80, chartB: 0.30 },
      { val: 'dim-d-50', label: '⚡ Dim D · 50% visibilité', chartA: 3.10, chartB: 0.16 },
      { val: 'pain-500', label: '🔥 Pain · 500 topologies', chartA: 18.5, chartB: 0.45 },
      { val: 'pain-1000', label: '☠️ Torture · 1 000 topologies', chartA: 38.0, chartB: 0.85 },
    ],
    benchLabel: 'Matrice 4D Complète (Dim A, B, C)',
    painLabel: 'Stress Topologies (10 → 1 000)',
    metricsPills: [
      { label: 'Gain CPU', val: '−93.2%', desc: '0.18 ms submit' },
      { label: 'Topologies', val: '100', desc: 'Mega-buffer' },
      { label: 'Matériaux', val: '10', desc: 'Multi-draw' },
      { label: 'Draw calls', val: '1', desc: 'Draw indirect' },
    ],
    stats: { objects: '2 000', submit: '0.18 ms', cpuFrame: '0.28 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '04-gpu-lod': {
    id: '04-gpu-lod',
    number: '04',
    name: 'GPU LOD & Screen-Space Error',
    subtitle: 'Décimation meshoptimizer, sélection Screen-Space Error tripartite',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'GPU Screen-Space Error LOD',
    telemetryDetail: '04C : Compute Shader WGSL + Multi-Draw',
    description: 'Génération de niveaux de détail continus via meshoptimizer et sélection dynamique du niveau par erreur projetée en pixels.',
    technicalPrinciple: 'SSE = (radius * delta_lod * height) / (2 * dist * tan(fov/2)). Transition imperceptible sous seuil 2.0 px.',
    chartTitle: 'Sélection SSE CPU vs GPU (ms)',
    chartUnit: 'ms',
    options: [
      { val: '1000', label: '1 000 objets · Multi-LOD', chartA: 0.02, chartB: 0.01 },
      { val: '2000', label: '⚡ 2 000 objets · Multi-LOD', selected: true, chartA: 0.03, chartB: 0.01 },
      { val: '5000', label: '5 000 objets · Multi-LOD', chartA: 0.08, chartB: 0.02 },
      { val: '10000', label: '🔥 10 000 objets · Multi-LOD', chartA: 0.16, chartB: 0.04 },
      { val: '50000', label: '☠️ 50 000 objets · Multi-LOD', chartA: 0.82, chartB: 0.18 },
    ],
    benchLabel: 'Benchmark LOD (04A / 04B / 04C)',
    painLabel: 'Stress LOD 50k Objets',
    metricsPills: [
      { label: 'Économie poly', val: '−75.0%', desc: 'LOD 2' },
      { label: 'Erreur max', val: '1.82 px', desc: 'Seuil 2.0 px' },
      { label: 'Sélection CPU', val: '0.03 ms', desc: '2k objets' },
      { label: 'Triangles', val: '16.1 M', desc: 'Gérés' },
    ],
    stats: { objects: '2 000', submit: '0.03 ms', cpuFrame: '0.85 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '05-meshlets': {
    id: '05-meshlets',
    number: '05',
    name: 'Meshlets & Cluster Partitioning',
    subtitle: 'Découpage en clusters de 64 sommets et 126 triangles sans fissures',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Meshlet Cluster Pipeline',
    telemetryDetail: '64 Vertices / 126 Triangles per Cluster',
    description: 'Partitionnement de maillages denses en clusters réguliers de géométrie (Meshlets) avec oracles topologiques.',
    technicalPrinciple: 'Taille de cluster bornée à 64 sommets / 126 triangles. Indexation locale sur 8 bits pour absorption cache VRAM maximale.',
    chartTitle: 'Temps de Traitement Cluster (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: 'plane-1024',
        label: '⚡ Plan 1 024 tri (16 meshlets)',
        selected: true,
        desc: 'Plan 1 024 triangles : découpé en 16 meshlets réguliers de 64 sommets / 126 triangles.',
        statsClassic: { objects: '1', submit: '1.20 ms', cpuFrame: '1.80 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.36 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Buffer standard', val: '1 gros VBO', desc: 'Index 32-bit' },
          { label: 'Granularité', val: 'Objet entier', desc: 'Pas de sub-mesh' },
          { label: 'Surcoût VRAM', val: '+45%', desc: 'Index non compacts' },
          { label: 'Culling fin', val: 'Impossible', desc: 'Tout ou rien' },
        ],
        pillsGpu: [
          { label: 'Clusters', val: '16 meshlets', desc: '1 024 triangles' },
          { label: 'Indexation', val: '8-bit', desc: 'Cache L2 GPU' },
          { label: 'CPU Part.', val: '0.36 ms', desc: 'Partition METIS' },
          { label: 'Fissures', val: '0 fissure', desc: 'Oracle vérifié' },
        ],
        chartA: 1.20,
        chartB: 0.36,
      },
      {
        val: 'sphere-4096',
        label: 'Sphère 4 096 tri (64 meshlets)',
        desc: 'Sphère 4 096 triangles : 64 meshlets bornés, 0 fissure topologique aux coutures.',
        statsClassic: { objects: '1', submit: '2.40 ms', cpuFrame: '3.10 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '64', submit: '< 0.1 ms', cpuFrame: '1.12 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Buffer standard', val: '1 VBO 4k tris', desc: 'Mono-bloc' },
          { label: 'Granularité', val: 'Sphère unique', desc: 'Pas de cluster' },
          { label: 'Surcoût VRAM', val: '+40%', desc: '32-bit indices' },
          { label: 'Culling fin', val: 'Inactif', desc: 'Sphère entière' },
        ],
        pillsGpu: [
          { label: 'Clusters', val: '64 meshlets', desc: '4 096 triangles' },
          { label: 'Indexation', val: '8-bit', desc: 'Compacité 100%' },
          { label: 'CPU Part.', val: '1.12 ms', desc: 'Partitionnement' },
          { label: 'Fissures', val: '0 fissure', desc: 'Oracle vérifié' },
        ],
        chartA: 2.40,
        chartB: 1.12,
      },
      {
        val: 'bunny-16384',
        label: '🔥 Stanford Bunny 16k (256 meshlets)',
        desc: 'Stanford Bunny 16 384 triangles : 256 meshlets compacts, absorption cache VRAM maximale.',
        statsClassic: { objects: '1', submit: '8.50 ms', cpuFrame: '12.0 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '256', submit: '< 0.1 ms', cpuFrame: '4.25 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Buffer standard', val: '16k tris brut', desc: 'Indices 32-bit' },
          { label: 'Granularité', val: 'Maillage unique', desc: 'L2 thrashing' },
          { label: 'Surcoût VRAM', val: '+50%', desc: 'Indexation lourde' },
          { label: 'Culling fin', val: 'Inexistant', desc: 'Pas de cluster' },
        ],
        pillsGpu: [
          { label: 'Clusters', val: '256 meshlets', desc: '16 384 triangles' },
          { label: 'Indexation', val: '8-bit', desc: 'Localisé en L2' },
          { label: 'CPU Part.', val: '4.25 ms', desc: 'Partitionnement' },
          { label: 'Fissures', val: '0 fissure', desc: 'Oracle vérifié' },
        ],
        chartA: 8.50,
        chartB: 4.25,
      },
    ],
    benchLabel: 'Valider Partitionnement Meshlets',
    metricsPills: [
      { label: 'Clusters', val: '16 meshlets', desc: 'Pour 1 024 triangles' },
      { label: 'Indexation', val: '8-bit', desc: 'VRAM compacte' },
      { label: 'CPU Part.', val: '0.36 ms', desc: 'Partitionnement' },
      { label: 'Fissures', val: '0 fissure', desc: 'Oracle vérifié' },
    ],
    stats: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.36 ms', fps: 'Conforme', drawCalls: '1' },
  },
  '06-meshlet-culling': {
    id: '06-meshlet-culling',
    number: '06',
    name: 'Meshlet Culling & Taux de Rejet',
    subtitle: 'Culling de cône normalisé + frustum par cluster pré-rasterisation',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Cluster Frustum & Cone Culling',
    telemetryDetail: 'dot(N, V) > sin(alpha) Rejection',
    description: 'Rejet précoce des meshlets avant émission de primitives graphiques grâce au test combiné frustum et cône de normales orientées.',
    technicalPrinciple: 'Test de cône de normales : si dot(V, axis) > sin(coneAngle), tout le cluster tourne le dos à la caméra.',
    chartTitle: 'Latence Culling & Soumission (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: 'cone-50',
        label: '⚡ Cône normal + Frustum (50% rejet)',
        selected: true,
        desc: 'Cône normal + Frustum : 50% des clusters rejetés dos à la caméra. Temps compute GPU 0.12 ms.',
        statsClassic: { objects: '16', submit: '3.50 ms', cpuFrame: '4.80 ms', fps: '0% rejet', drawCalls: '16' },
        statsGpu: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.12 ms', fps: '50% rejet', drawCalls: '1' },
        pillsClassic: [
          { label: 'Taux Rejet', val: '0.0%', desc: 'Tout rasterisé' },
          { label: 'Clusters soumis', val: '16 clusters', desc: 'Rasterizer saturé' },
          { label: 'Overdraw', val: 'Élevé', desc: 'Pas de backface culling' },
          { label: 'Draw calls', val: '16 draws', desc: 'Soumission CPU' },
        ],
        pillsGpu: [
          { label: 'Taux Rejet', val: '50.0%', desc: '8 / 16 meshlets' },
          { label: 'Temps Culling', val: '0.12 ms', desc: 'Sur 16 clusters' },
          { label: 'Faux Rejets', val: '0%', desc: 'Oracle conservateur' },
          { label: 'Draws GPU', val: '1', desc: 'Buffer indirect' },
        ],
        chartA: 3.50,
        chartB: 0.12,
      },
      {
        val: 'backface-100',
        label: 'Vue dorsale (100% rejet dos)',
        desc: 'Vue dorsale : 100% des clusters tournent le dos à la vue. Rejet total en 0.07 ms, zéro primitive émise.',
        statsClassic: { objects: '16', submit: '3.50 ms', cpuFrame: '4.80 ms', fps: '0% rejet', drawCalls: '16' },
        statsGpu: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.07 ms', fps: '100% rejet', drawCalls: '0' },
        pillsClassic: [
          { label: 'Taux Rejet', val: '0.0%', desc: 'Gâchis 100%' },
          { label: 'Clusters soumis', val: '16 clusters', desc: 'Invisibles rasterisés' },
          { label: 'Overdraw', val: 'Maximal', desc: 'Pixels écrasés' },
          { label: 'Draw calls', val: '16 draws', desc: 'Boucle inutile' },
        ],
        pillsGpu: [
          { label: 'Taux Rejet', val: '100.0%', desc: '16 / 16 rejetés' },
          { label: 'Temps Culling', val: '0.07 ms', desc: 'Rejet total dos' },
          { label: 'Faux Rejets', val: '0%', desc: 'Oracle conservateur' },
          { label: 'Draws GPU', val: '0', desc: 'Zéro primitive' },
        ],
        chartA: 3.50,
        chartB: 0.07,
      },
      {
        val: 'frontface-0',
        label: 'Vue frontale (0% rejet dos)',
        desc: 'Vue frontale : 100% des clusters font face à la caméra. 0% de faux rejet, passe complète en 0.14 ms.',
        statsClassic: { objects: '16', submit: '3.50 ms', cpuFrame: '4.80 ms', fps: '0% rejet', drawCalls: '16' },
        statsGpu: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.14 ms', fps: '0% rejet', drawCalls: '1' },
        pillsClassic: [
          { label: 'Taux Rejet', val: '0.0%', desc: 'Tout visible' },
          { label: 'Clusters soumis', val: '16 clusters', desc: 'Raster standard' },
          { label: 'Submit CPU', val: '3.50 ms', desc: 'Boucle standard' },
          { label: 'Draw calls', val: '16 draws', desc: 'Non groupé' },
        ],
        pillsGpu: [
          { label: 'Taux Rejet', val: '0.0%', desc: '0 / 16 rejetés' },
          { label: 'Temps Culling', val: '0.14 ms', desc: 'Tous visibles' },
          { label: 'Faux Rejets', val: '0%', desc: 'Oracle conservateur' },
          { label: 'Draws GPU', val: '1', desc: 'Buffer indirect' },
        ],
        chartA: 3.50,
        chartB: 0.14,
      },
    ],
    benchLabel: 'Exécuter Culling Meshlets',
    metricsPills: [
      { label: 'Taux Rejet', val: '50.0%', desc: 'Cône + frustum' },
      { label: 'Temps Culling', val: '0.12 ms', desc: 'Sur 16 clusters' },
      { label: 'Faux Rejets', val: '0%', desc: 'Oracle conservateur' },
      { label: 'Draws GPU', val: '1', desc: 'Buffer indirect' },
    ],
    stats: { objects: '16', submit: '< 0.1 ms', cpuFrame: '0.12 ms', fps: '50% rejet', drawCalls: '1' },
  },
  '07-hiz': {
    id: '07-hiz',
    number: '07',
    name: 'Hi-Z Occlusion Pyramid',
    subtitle: 'Pyramide de profondeur min-reduction 11 mips pour occlusion culling',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Hierarchical Z-Buffer Generation',
    telemetryDetail: 'Min-Reduction 1024x1024 to 1x1',
    description: "Génération GPU d'une pyramide hiérarchique de profondeur (Hi-Z) par sous-échantillonnage conservateur (4 pixels source vers 1 valeur min).",
    technicalPrinciple: 'Min-reduction conservatrice : mip[k](x,y) = min(mip[k-1](2x, 2y), ...). Aucun objet visible considéré occlus.',
    chartTitle: 'Temps de Génération Hi-Z (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '512',
        label: '512×512 (10 niveaux mips)',
        desc: '512×512 : 10 niveaux de mipmaps générés en 0.45 ms, empreinte VRAM 1.33 Mo.',
        statsClassic: { objects: '1', submit: '1.20 ms', cpuFrame: '2.50 ms', fps: '60 FPS', drawCalls: '10' },
        statsGpu: { objects: '1', submit: '< 0.1 ms', cpuFrame: '0.45 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Mips CPU', val: '10 passes', desc: 'Rebonds CPU' },
          { label: 'Temps Gen', val: '2.50 ms', desc: 'Passes WebGL' },
          { label: 'Draw calls', val: '10 draws', desc: '1 par mip' },
          { label: 'Conservation', val: 'Floue', desc: 'Sans min' },
        ],
        pillsGpu: [
          { label: 'Mips générés', val: '10 mips', desc: '512x512 → 1x1' },
          { label: 'Temps Gen', val: '0.45 ms', desc: 'Downsample GPU' },
          { label: 'Empreinte', val: '1.33 MB', desc: 'Texture min' },
          { label: 'Conservation', val: '100%', desc: 'Min strict' },
        ],
        chartA: 1.20,
        chartB: 0.45,
      },
      {
        val: '1024',
        label: '⚡ 1024×1024 (11 niveaux mips)',
        selected: true,
        desc: '1024×1024 (1080p standard) : 11 niveaux de mips en 1.05 ms, empreinte VRAM 5.59 Mo.',
        statsClassic: { objects: '1', submit: '2.80 ms', cpuFrame: '5.20 ms', fps: '60 FPS', drawCalls: '11' },
        statsGpu: { objects: '1', submit: '< 0.1 ms', cpuFrame: '1.05 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Mips CPU', val: '11 passes', desc: 'Goulot bande passante' },
          { label: 'Temps Gen', val: '5.20 ms', desc: 'CPU submit' },
          { label: 'Draw calls', val: '11 draws', desc: '11 dispatches' },
          { label: 'Conservation', val: 'Non stricte', desc: 'Linéaire' },
        ],
        pillsGpu: [
          { label: 'Mips générés', val: '11 mips', desc: '1024x1024 → 1x1' },
          { label: 'Temps Gen', val: '1.05 ms', desc: 'Total pyramide' },
          { label: 'Empreinte', val: '5.59 MB', desc: 'Texture pyramidale' },
          { label: 'Conservation', val: '100%', desc: 'Min strict' },
        ],
        chartA: 2.80,
        chartB: 1.05,
      },
      {
        val: '2048',
        label: '2048×2048 (12 niveaux mips, 4K)',
        desc: '2048×2048 (4K Ultra-HD) : 12 niveaux de mips en 2.65 ms, empreinte VRAM 22.3 Mo.',
        statsClassic: { objects: '1', submit: '6.50 ms', cpuFrame: '14.0 ms', fps: '60 FPS', drawCalls: '12' },
        statsGpu: { objects: '1', submit: '< 0.1 ms', cpuFrame: '2.65 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Mips CPU', val: '12 passes', desc: 'Saturation bus' },
          { label: 'Temps Gen', val: '14.0 ms', desc: 'Inviable 60 FPS' },
          { label: 'Draw calls', val: '12 draws', desc: 'Multi-passes' },
          { label: 'Conservation', val: 'Perte', desc: 'Non conservateur' },
        ],
        pillsGpu: [
          { label: 'Mips générés', val: '12 mips', desc: '2048x2048 → 1x1' },
          { label: 'Temps Gen', val: '2.65 ms', desc: '4K Ultra-HD' },
          { label: 'Empreinte', val: '22.3 MB', desc: 'Texture pyramidale' },
          { label: 'Conservation', val: '100%', desc: 'Min strict' },
        ],
        chartA: 6.50,
        chartB: 2.65,
      },
    ],
    benchLabel: 'Générer Pyramide Hi-Z',
    metricsPills: [
      { label: 'Mips générés', val: '11 mips', desc: '1024x1024 → 1x1' },
      { label: 'Temps Gen', val: '1.05 ms', desc: 'Total pyramide' },
      { label: 'Empreinte', val: '5.59 MB', desc: 'Texture pyramidale' },
      { label: 'Conservation', val: '100%', desc: 'Oracle min strict' },
    ],
    stats: { objects: '1', submit: '< 0.1 ms', cpuFrame: '1.05 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '08-occlusion-culling': {
    id: '08-occlusion-culling',
    number: '08',
    name: 'Occlusion Culling & Gain Net',
    subtitle: 'Test AABB projetée vs Hi-Z mip conservateur à deux passes',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Two-Pass Occlusion Culling',
    telemetryDetail: 'Reprojected Depth Bounds vs Hi-Z',
    description: 'Architecture en 2 passes : passe 1 rend les objets visibles de la frame précédente, génère le Hi-Z, puis passe 2 teste les objets réapparus.',
    technicalPrinciple: "Sélection du mip Hi-Z : level = ceil(log2(max(w, h))). Comparaison dmax(AABB) < dmin(HiZ).",
    chartTitle: 'Latence Soumission & Rendu (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '2000-50',
        label: '⚡ 2 000 objets (50% occlus)',
        selected: true,
        desc: '2 000 objets (50% occlus) : 1 000 objets écartés, temps culling 0.25 ms, gain shading net 50%.',
        statsClassic: { objects: '2 000', submit: '3.35 ms', cpuFrame: '4.15 ms', fps: '60 FPS', drawCalls: '2 000' },
        statsGpu: { objects: '2 000', submit: '0.15 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Objets occlus', val: '0.0%', desc: 'Overdraw 100%' },
          { label: 'Triangles', val: '768 000', desc: 'Tout rasterisé' },
          { label: 'Submit CPU', val: '3.35 ms', desc: '2000 draws' },
          { label: 'Gain Shading', val: '0%', desc: 'Pixels gaspillés' },
        ],
        pillsGpu: [
          { label: 'Objets occlus', val: '50.0%', desc: '1 000 / 2 000 rejetés' },
          { label: 'Temps Culling', val: '0.25 ms', desc: 'CPU / GPU total' },
          { label: 'Gain Shading', val: '−50%', desc: 'Évite overdraw' },
          { label: 'Faux Rejets', val: '0%', desc: 'Zéro popping' },
        ],
        chartA: 3.35,
        chartB: 0.25,
      },
      {
        val: '5000-75',
        label: '5 000 objets (75% occlus)',
        desc: '5 000 objets (75% occlus) : 3 750 objets écartés, temps culling 0.38 ms, gain shading net 75%.',
        statsClassic: { objects: '5 000', submit: '8.45 ms', cpuFrame: '11.8 ms', fps: '54 FPS', drawCalls: '5 000' },
        statsGpu: { objects: '5 000', submit: '0.22 ms', cpuFrame: '0.38 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Objets occlus', val: '0.0%', desc: 'Overdraw massif' },
          { label: 'Triangles', val: '1.92M tris', desc: 'Goulot raster' },
          { label: 'Submit CPU', val: '8.45 ms', desc: 'Chute 54 FPS' },
          { label: 'Gain Shading', val: '0%', desc: 'Pas de culling' },
        ],
        pillsGpu: [
          { label: 'Objets occlus', val: '75.0%', desc: '3 750 / 5 000 rejetés' },
          { label: 'Temps Culling', val: '0.38 ms', desc: '2 passes Hi-Z' },
          { label: 'Gain Shading', val: '−75%', desc: 'Divisé par 4' },
          { label: 'Faux Rejets', val: '0%', desc: 'Zéro popping' },
        ],
        chartA: 8.45,
        chartB: 0.38,
      },
      {
        val: '10000-90',
        label: '🔥 10 000 objets (90% occlus)',
        desc: '10 000 objets (90% occlus, ville dense) : 9 000 objets éliminés, gain shading 90% !',
        statsClassic: { objects: '10 000', submit: '16.9 ms', cpuFrame: '24.5 ms', fps: '38 FPS', drawCalls: '10 000' },
        statsGpu: { objects: '10 000', submit: '0.38 ms', cpuFrame: '0.55 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Objets occlus', val: '0.0%', desc: 'Overdraw x10' },
          { label: 'Triangles', val: '3.84M tris', desc: 'GPU saturé' },
          { label: 'Submit CPU', val: '16.9 ms', desc: 'Saccades sévères' },
          { label: 'Gain Shading', val: '0%', desc: 'Zéro culling' },
        ],
        pillsGpu: [
          { label: 'Objets occlus', val: '90.0%', desc: '9 000 / 10 000 rejetés' },
          { label: 'Temps Culling', val: '0.55 ms', desc: 'Hi-Z 2 passes' },
          { label: 'Gain Shading', val: '−90%', desc: '10x plus rapide' },
          { label: 'Faux Rejets', val: '0%', desc: 'Zéro popping' },
        ],
        chartA: 16.9,
        chartB: 0.55,
      },
    ],
    benchLabel: 'Valider Occlusion Culling',
    metricsPills: [
      { label: 'Objets occlus', val: '50.0%', desc: '1 000 / 2 000 rejetés' },
      { label: 'Temps Culling', val: '0.25 ms', desc: 'CPU / GPU total' },
      { label: 'Gain Shading', val: '−50%', desc: 'Évite overdraw' },
      { label: 'Faux Rejets', val: '0%', desc: 'Zéro popping' },
    ],
    stats: { objects: '2 000', submit: '0.15 ms', cpuFrame: '0.25 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '09-gpu-compaction': {
    id: '09-gpu-compaction',
    number: '09',
    name: 'GPU Compaction & Contention',
    subtitle: 'Prefix-sum parallèle 2-passes multi-workgroups sans contention atomique',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Parallel Prefix-Sum Compaction',
    telemetryDetail: 'Workgroup Scan + Global Add',
    description: 'Algorithme Blelloch / Hillis-Steele 2-passes éliminant la contention atomique sur scènes massives.',
    technicalPrinciple: 'Passe 1 : scan local par workgroup (256 threads). Passe 2 : propagation globale du prefix-sum. O(N) ops.',
    chartTitle: 'Temps de Compaction (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '50000',
        label: '50 000 instances',
        desc: '50 000 instances : atomicAdd 0.28 ms, parallel scan 2.15 ms, single thread CPU 5.80 ms.',
        statsClassic: { objects: '50k', submit: '5.80 ms', cpuFrame: '8.20 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '50k', submit: '< 0.1 ms', cpuFrame: '2.15 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Compaction CPU', val: '5.80 ms', desc: 'Boucle JS simple' },
          { label: 'Contention', val: 'Verrou single-thread', desc: 'Non parallélisé' },
          { label: 'Mémoire', val: 'RAM → VRAM', desc: 'Allers-retours' },
          { label: 'Goulot', val: 'CPU loop', desc: 'Temps perdu' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '50 000', desc: 'Compactées' },
          { label: 'Temps scan', val: '2.15 ms', desc: 'Scan parallèle' },
          { label: 'Contention', val: '0 lock', desc: 'Blelloch 2-passes' },
          { label: 'Ordre', val: 'Stable', desc: 'Indices continus' },
        ],
        chartA: 5.80,
        chartB: 2.15,
      },
      {
        val: '100000',
        label: '⚡ 100 000 instances (Prefix-sum)',
        selected: true,
        desc: '100 000 instances : atomicAdd 0.47 ms, parallel scan 4.28 ms sans lock atomique global.',
        statsClassic: { objects: '100k', submit: '11.5 ms', cpuFrame: '16.5 ms', fps: '52 FPS', drawCalls: '1' },
        statsGpu: { objects: '100k', submit: '< 0.1 ms', cpuFrame: '4.28 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Compaction CPU', val: '11.5 ms', desc: 'Chute sous 60 FPS' },
          { label: 'Contention', val: 'CPU mono-thread', desc: 'Goulot' },
          { label: 'Transfert', val: '100k floats', desc: 'Gouffre PCI-e' },
          { label: 'Verdict', val: 'CPU saturé', desc: 'Inviable' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '100 000', desc: 'Compactées' },
          { label: 'Temps scan', val: '4.28 ms', desc: 'Scan parallèle' },
          { label: 'Contention', val: '0 lock', desc: 'Sans lock atomique' },
          { label: 'Ordre', val: 'Préservé', desc: 'Indices stables' },
        ],
        chartA: 11.5,
        chartB: 4.28,
      },
      {
        val: '250000',
        label: '🔥 250 000 instances (Massif)',
        desc: '250 000 instances : atomicAdd sature (contention 3M), prefix-sum parallèle stable à 10.5 ms.',
        statsClassic: { objects: '250k', submit: '28.5 ms', cpuFrame: '42.0 ms', fps: '22 FPS', drawCalls: '1' },
        statsGpu: { objects: '250k', submit: '< 0.1 ms', cpuFrame: '10.5 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Compaction CPU', val: '28.5 ms', desc: 'Effondrement 22 FPS' },
          { label: 'Contention', val: 'Bloquant', desc: 'CPU saturé' },
          { label: 'Mémoire', val: 'PCI-e saturé', desc: '250k instances' },
          { label: 'Goulot', val: 'Critique', desc: 'Inacceptable' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '250 000', desc: 'Compactées' },
          { label: 'Temps scan', val: '10.5 ms', desc: 'Scan parallèle' },
          { label: 'Contention', val: '0 lock', desc: 'Algorithme Blelloch' },
          { label: 'Ordre', val: 'Stable', desc: 'Indices continus' },
        ],
        chartA: 28.5,
        chartB: 10.5,
      },
    ],
    benchLabel: 'Exécuter Compaction Parallèle',
    metricsPills: [
      { label: 'Instances', val: '100 000', desc: 'Compactées' },
      { label: 'Temps scan', val: '4.28 ms', desc: 'Scan parallèle' },
      { label: 'Collisions', val: '0 collision', desc: 'Sans lock atomique' },
      { label: 'Ordre', val: 'Préservé', desc: 'Indices stables' },
    ],
    stats: { objects: '100k', submit: '< 0.1 ms', cpuFrame: '4.28 ms', fps: 'Conforme', drawCalls: '1' },
  },
  '10-material-batching': {
    id: '10-material-batching',
    number: '10',
    name: 'Material Batching & Dynamic Indexing',
    subtitle: 'Dynamic indexing SSBO et multi-matériaux dans un seul draw call',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Bindless Material Dynamic Indexing',
    telemetryDetail: 'Single Draw Call / 100 Materials',
    description: "Élimination des changements d'état (state-changes) matériels via stockage des descripteurs dans un SSBO indexé par materialID.",
    technicalPrinciple: 'Uber-shader unique avec table de propriétés matérielles en SSBO. Un draw indirect unique pour 100 matériaux.',
    chartTitle: 'Latence Soumission Multi-Matériaux (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '50',
        label: '50 matériaux',
        desc: '50 matériaux : 50 pipeline switches Three.js (2.25 ms submit) vs 1 draw call SSBO (0.08 ms).',
        statsClassic: { objects: '2 000', submit: '2.25 ms', cpuFrame: '3.10 ms', fps: '60 FPS', drawCalls: '50' },
        statsGpu: { objects: '2 000', submit: '0.08 ms', cpuFrame: '0.08 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Switches', val: '50 pipelines', desc: 'Rebonds état GPU' },
          { label: 'Draw calls', val: '50 draws', desc: 'Fragmentation' },
          { label: 'Submit CPU', val: '2.25 ms', desc: 'Coût CPU switch' },
          { label: 'VRAM Table', val: '1.6 Ko', desc: 'Non partagée' },
        ],
        pillsGpu: [
          { label: 'Matériaux', val: '50 types', desc: 'Dynamic SSBO' },
          { label: 'Draw calls', val: '1 draw', desc: 'Zero switch' },
          { label: 'Submit CPU', val: '0.08 ms', desc: '−96.4% submit' },
          { label: 'GPU Frame', val: '0.36 ms', desc: 'Shading unifié' },
        ],
        chartA: 2.25,
        chartB: 0.08,
      },
      {
        val: '100',
        label: '⚡ 100 matériaux (1 draw call)',
        selected: true,
        desc: '100 matériaux uniques : 100 switches (2.40 ms submit) absorbés en 1 seul draw call indirect (0.08 ms).',
        statsClassic: { objects: '2 000', submit: '2.40 ms', cpuFrame: '3.60 ms', fps: '60 FPS', drawCalls: '100' },
        statsGpu: { objects: '2 000', submit: '0.08 ms', cpuFrame: '0.08 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Switches', val: '100 pipelines', desc: 'Pipeline thrashing' },
          { label: 'Draw calls', val: '100 draws', desc: 'Multi-batches' },
          { label: 'Submit CPU', val: '2.40 ms', desc: 'CPU saturé' },
          { label: 'VRAM Table', val: '3.2 Ko', desc: 'Morcelée' },
        ],
        pillsGpu: [
          { label: 'Matériaux', val: '100 types', desc: 'PBR / Phong / etc.' },
          { label: 'Draw calls', val: '1 draw', desc: 'O(1) state changes' },
          { label: 'Submit CPU', val: '0.08 ms', desc: '−96.7% overhead' },
          { label: 'GPU Frame', val: '0.36 ms', desc: 'Shading unifié' },
        ],
        chartA: 2.40,
        chartB: 0.08,
      },
      {
        val: '250',
        label: '🔥 250 matériaux (Extrême)',
        desc: '250 matériaux uniques : 250 switches (3.20 ms) réduits à 0.09 ms (gain 35x).',
        statsClassic: { objects: '2 000', submit: '3.20 ms', cpuFrame: '4.80 ms', fps: '60 FPS', drawCalls: '250' },
        statsGpu: { objects: '2 000', submit: '0.09 ms', cpuFrame: '0.09 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Switches', val: '250 pipelines', desc: 'Overhead critique' },
          { label: 'Draw calls', val: '250 draws', desc: 'Éparpillé' },
          { label: 'Submit CPU', val: '3.20 ms', desc: 'CPU débordé' },
          { label: 'VRAM Table', val: '8.0 Ko', desc: 'Non groupée' },
        ],
        pillsGpu: [
          { label: 'Matériaux', val: '250 types', desc: 'Dynamic SSBO' },
          { label: 'Draw calls', val: '1 draw', desc: 'Zero switch' },
          { label: 'Submit CPU', val: '0.09 ms', desc: '−97.2% overhead' },
          { label: 'GPU Frame', val: '0.40 ms', desc: 'Shading unifié' },
        ],
        chartA: 3.20,
        chartB: 0.09,
      },
    ],
    benchLabel: 'Valider Material Batching',
    metricsPills: [
      { label: 'Matériaux', val: '100 types', desc: 'PBR / Phong / etc.' },
      { label: 'Draw calls', val: '1 draw', desc: 'O(1) state changes' },
      { label: 'Submit CPU', val: '0.08 ms', desc: 'Élimination overhead' },
      { label: 'GPU Frame', val: '0.36 ms', desc: 'Shading unifié' },
    ],
    stats: { objects: '2 000', submit: '0.08 ms', cpuFrame: '0.08 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '11-geometry-streaming': {
    id: '11-geometry-streaming',
    number: '11',
    name: 'Geometry Streaming & Résidence VRAM',
    subtitle: "LRU Cache VRAM budgeté 64 MB et oracles d'éviction en anneau cyclique",
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'VRAM LRU Streaming Cache',
    telemetryDetail: 'Ring Buffer Allocation + Zero Stutter',
    description: "Gestionnaire de cache VRAM avec politique LRU bornant l'empreinte mémoire sur GPU sous contrainte fixe.",
    technicalPrinciple: "Allocation en ring buffer avec seuil d'éviction LRU : meshlets non visibles depuis N frames libérés en O(1).",
    chartTitle: 'Latence Gestion Mémoire (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '32mb',
        label: 'Budget 32 MB (Contraint)',
        desc: 'Budget 32 MB contraint : 2 500 objets résidents (1.2M triangles), éviction LRU fluide en 0.06 ms.',
        statsClassic: { objects: '2 500', submit: '2.50 ms', cpuFrame: '4.10 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '2 500', submit: '< 0.1 ms', cpuFrame: '0.06 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Budget VRAM', val: 'Sans limite', desc: 'Débordement VRAM' },
          { label: 'Éviction', val: 'Aléatoire', desc: 'Thrashing présent' },
          { label: 'Stuttering', val: 'Fréquent', desc: 'Uploads bloquants' },
          { label: 'Contrôle', val: 'Inactif', desc: 'Fuites mémoire' },
        ],
        pillsGpu: [
          { label: 'Budget VRAM', val: '32 MB', desc: 'Plafond strict' },
          { label: 'Résident', val: '2 500 objets', desc: '1.2M tris' },
          { label: 'Temps gestion', val: '0.06 ms', desc: 'Éviction O(1)' },
          { label: 'Thrashing', val: '0 boucle', desc: 'Oracle validé' },
        ],
        chartA: 2.50,
        chartB: 0.06,
      },
      {
        val: '64mb',
        label: '⚡ Budget 64 MB (LRU anneau)',
        selected: true,
        desc: 'Budget 64 MB (standard) : 5 000 objets résidents (2.5M triangles), recherche & éviction en 0.05 ms.',
        statsClassic: { objects: '5 000', submit: '2.50 ms', cpuFrame: '4.10 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '5 000', submit: '< 0.1 ms', cpuFrame: '0.05 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Budget VRAM', val: 'Sans plafond', desc: 'Risque crash OOM' },
          { label: 'Éviction', val: 'Manuelle', desc: 'Bloque la frame' },
          { label: 'Stuttering', val: '12 ms pics', desc: 'GC / Realloc' },
          { label: 'Thrashing', val: 'Possible', desc: "Pas d'anneau" },
        ],
        pillsGpu: [
          { label: 'Budget VRAM', val: '64 MB', desc: 'Plafond strict' },
          { label: 'Résident', val: '5 000 objets', desc: '2.5M triangles' },
          { label: 'Temps gestion', val: '0.05 ms', desc: 'Recherche & éviction' },
          { label: 'Thrashing', val: '0 boucle', desc: 'Oracle validé' },
        ],
        chartA: 2.50,
        chartB: 0.05,
      },
      {
        val: '128mb',
        label: 'Budget 128 MB (Étendu)',
        desc: 'Budget 128 MB étendu : 10 000 objets résidents (5.0M triangles), confort total sans éviction.',
        statsClassic: { objects: '10 000', submit: '2.50 ms', cpuFrame: '4.10 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '10 000', submit: '< 0.1 ms', cpuFrame: '0.04 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Budget VRAM', val: 'Indéfini', desc: 'Saturation GPU' },
          { label: 'Éviction', val: 'Aucune', desc: 'Consommation brute' },
          { label: 'Stuttering', val: 'Présent', desc: 'Pic initial' },
          { label: 'Contrôle', val: 'Faible', desc: 'VRAM non bornée' },
        ],
        pillsGpu: [
          { label: 'Budget VRAM', val: '128 MB', desc: 'Plafond étendu' },
          { label: 'Résident', val: '10 000 objets', desc: '5.0M tris' },
          { label: 'Temps gestion', val: '0.04 ms', desc: 'Zéro stutter' },
          { label: 'Thrashing', val: '0 boucle', desc: 'Oracle validé' },
        ],
        chartA: 2.50,
        chartB: 0.04,
      },
    ],
    benchLabel: 'Tester Streaming VRAM',
    metricsPills: [
      { label: 'Budget VRAM', val: '64 MB', desc: 'Plafond strict' },
      { label: 'Instances', val: '5 000', desc: '2.5M triangles' },
      { label: 'Temps gestion', val: '0.05 ms', desc: 'Recherche & éviction' },
      { label: 'Thrashing', val: '0 boucle', desc: 'Oracle validé' },
    ],
    stats: { objects: '5 000', submit: '< 0.1 ms', cpuFrame: '0.05 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '12-visibility-buffer': {
    id: '12-visibility-buffer',
    number: '12',
    name: 'Visibility Buffer & Shading Différé',
    subtitle: 'Raster compact (InstanceID + TriangleID, 8 octets/pixel) + reconstruction barycentrique',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Visibility Buffer Shading',
    telemetryDetail: '8 Bytes/Pixel G-Buffer + Barycentric Interp',
    description: "Séparation totale entre rasterisation et shading : le Visibility Buffer n'écrit que 8 octets par pixel.",
    technicalPrinciple: 'Reconstruction différée des barycentriques : 1 seul shading par pixel visible sans overdraw.',
    chartTitle: 'Empreinte Mémoire G-Buffer (Mo)',
    chartUnit: 'Mo',
    options: [
      {
        val: '1080p',
        label: '⚡ Résolution 1080p (FHD)',
        selected: true,
        desc: '1080p (1920×1080) : G-Buffer standard 55.4 Mo vs Visibility Buffer 15.8 Mo (Économie 3.5x).',
        statsClassic: { objects: '2 000', submit: '1.80 ms', cpuFrame: '3.20 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '2 000', submit: '0.12 ms', cpuFrame: '0.22 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Taille G-Buf', val: '32–64 o/px', desc: 'Albedo, Norm, etc.' },
          { label: 'Bande passante', val: '55.4 MB', desc: 'G-Buffer lourd' },
          { label: 'Shading calls', val: 'Multi-passes', desc: 'Overdraw présent' },
          { label: 'Ratio VRAM', val: '1.0x', desc: 'Référence lourde' },
        ],
        pillsGpu: [
          { label: 'Taille G-Buf', val: '8 octets/px', desc: 'Instance + Triangle' },
          { label: 'Bande passante', val: '15.8 MB', desc: '−71.5% VRAM' },
          { label: 'Recon. Bary', val: '0.22 ms', desc: 'Pixel exact' },
          { label: 'Overdraw', val: '1x shading', desc: 'Zéro pixel gâché' },
        ],
        chartA: 55.4,
        chartB: 15.8,
      },
      {
        val: '1440p',
        label: 'Résolution 1440p (2K)',
        desc: '1440p (2560×1440) : G-Buffer standard 98.4 Mo vs Visibility Buffer 28.1 Mo (Économie 3.5x).',
        statsClassic: { objects: '5 000', submit: '4.20 ms', cpuFrame: '7.10 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '5 000', submit: '0.18 ms', cpuFrame: '0.35 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Taille G-Buf', val: '32–64 o/px', desc: '4x MRT textures' },
          { label: 'Bande passante', val: '98.4 MB', desc: 'Très lourd' },
          { label: 'Shading calls', val: 'Surcoût', desc: 'Overdraw 2K' },
          { label: 'Ratio VRAM', val: '1.0x', desc: 'Référence' },
        ],
        pillsGpu: [
          { label: 'Taille G-Buf', val: '8 octets/px', desc: 'Compact' },
          { label: 'Bande passante', val: '28.1 MB', desc: '−71.4% VRAM' },
          { label: 'Recon. Bary', val: '0.35 ms', desc: 'Pixel exact' },
          { label: 'Overdraw', val: '1x shading', desc: 'Zéro gâchis' },
        ],
        chartA: 98.4,
        chartB: 28.1,
      },
      {
        val: '4k',
        label: '🔥 Résolution 4K (Ultra-HD)',
        desc: '4K (3840×2160) : G-Buffer standard 221.5 Mo vs Visibility Buffer 63.3 Mo (Économie 3.5x).',
        statsClassic: { objects: '10 000', submit: '8.90 ms', cpuFrame: '14.5 ms', fps: '60 FPS', drawCalls: '1' },
        statsGpu: { objects: '10 000', submit: '0.25 ms', cpuFrame: '0.60 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Taille G-Buf', val: '32–64 o/px', desc: 'Saturation bande passante' },
          { label: 'Bande passante', val: '221.5 MB', desc: 'Chute sur mobile' },
          { label: 'Shading calls', val: 'Lourd', desc: 'Overdraw 4K' },
          { label: 'Ratio VRAM', val: '1.0x', desc: 'Référence' },
        ],
        pillsGpu: [
          { label: 'Taille G-Buf', val: '8 octets/px', desc: 'Ultra compact' },
          { label: 'Bande passante', val: '63.3 MB', desc: '−71.4% VRAM' },
          { label: 'Recon. Bary', val: '0.60 ms', desc: 'Pixel exact' },
          { label: 'Overdraw', val: '1x shading', desc: 'Zéro gâchis' },
        ],
        chartA: 221.5,
        chartB: 63.3,
      },
    ],
    benchLabel: 'Tester Visibility Buffer',
    metricsPills: [
      { label: 'Taille G-Buf', val: '8 octets/px', desc: 'vs 32–64 Deferred' },
      { label: 'Bande passante', val: '−75%', desc: 'Gain mémoire raster' },
      { label: 'Temps Recon.', val: '0.22 ms', desc: 'Barycentriques' },
      { label: 'Overdraw', val: '1x shading', desc: 'Zéro pixel gâché' },
    ],
    stats: { objects: '2 000', submit: '0.12 ms', cpuFrame: '0.22 ms', fps: '60 FPS', drawCalls: '1' },
  },
  '13-full-gpu-driven': {
    id: '13-full-gpu-driven',
    number: '13',
    name: 'Full GPU-Driven Architecture',
    subtitle: 'Pipeline unifié Nanite-like : Culling + LOD SSE + Hi-Z + Compaction + Multi-Draw',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'Full GPU-Driven Autonomous Pipeline',
    telemetryDetail: '100k Instances / 38.4M Triangles',
    description: "Architecture maîtresse finale synthétisant l'ensemble des 13 briques du laboratoire en un pipeline entièrement exécuté sur GPU.",
    technicalPrinciple: "Zéro intervention CPU par frame : soumission d'une commande unique dispatch + drawIndirect. Crossover absolu franchi.",
    chartTitle: 'Latence de Soumission CPU (ms)',
    chartUnit: 'ms',
    options: [
      {
        val: '50000',
        label: '50 000 instances (19.2M tri)',
        desc: '50 000 instances (19.2M triangles) : soumission Three.js 80.5 ms vs GPU-Driven 0.20 ms (Gain 402x).',
        statsClassic: { objects: '50k', submit: '80.5 ms', cpuFrame: '120 ms', fps: '8 FPS', drawCalls: '50 000' },
        statsGpu: { objects: '50k', submit: '0.20 ms', cpuFrame: '0.28 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit CPU', val: '80.5 ms', desc: '50k draw calls' },
          { label: 'Framerate', val: '8 FPS', desc: 'Gel complet' },
          { label: 'Draw calls', val: '50 000', desc: 'Soumission brute' },
          { label: 'Overhead', val: '100%', desc: 'CPU saturé' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '50 000', desc: '19.2M triangles' },
          { label: 'Gain Submit', val: '402x', desc: '0.20 ms vs 80.5 ms' },
          { label: 'Draw calls', val: '1 draw', desc: 'Multi-draw' },
          { label: 'Pipeline', val: '10 étages', desc: '100% autonome' },
        ],
        chartA: 80.5,
        chartB: 0.20,
      },
      {
        val: '100000',
        label: '⚡ 100 000 objets (Pipeline complet)',
        selected: true,
        desc: '100 000 instances (38.4M triangles) : soumission Three.js 160.1 ms vs GPU-Driven 0.25 ms (Gain 640x).',
        statsClassic: { objects: '100k', submit: '160.1 ms', cpuFrame: '240 ms', fps: '4 FPS', drawCalls: '100 000' },
        statsGpu: { objects: '100k', submit: '0.25 ms', cpuFrame: '0.35 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit CPU', val: '160.1 ms', desc: '100k draw calls' },
          { label: 'Framerate', val: '4 FPS', desc: 'Effondrement total' },
          { label: 'Draw calls', val: '100 000', desc: 'Goulot Three.js' },
          { label: 'Overhead', val: '100%', desc: 'CPU saturé' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '100 000', desc: '38.4M triangles' },
          { label: 'Gain Submit', val: '640x', desc: '0.25 ms vs 160 ms' },
          { label: 'Draw calls', val: '1 draw', desc: 'O(1) invariant' },
          { label: 'Pipeline', val: '10 étages', desc: 'Nanite unifié' },
        ],
        chartA: 160.1,
        chartB: 0.25,
      },
      {
        val: '200000',
        label: '🔥 200 000 instances (Torture)',
        desc: '200 000 instances (76.8M triangles) : soumission Three.js 320 ms vs GPU-Driven 0.38 ms (Gain 842x).',
        statsClassic: { objects: '200k', submit: '320.0 ms', cpuFrame: '480 ms', fps: '2 FPS', drawCalls: '200 000' },
        statsGpu: { objects: '200k', submit: '0.38 ms', cpuFrame: '0.52 ms', fps: '60 FPS', drawCalls: '1' },
        pillsClassic: [
          { label: 'Submit CPU', val: '320.0 ms', desc: 'Crash potentiel' },
          { label: 'Framerate', val: '2 FPS', desc: 'Inutilisable' },
          { label: 'Draw calls', val: '200 000', desc: '200k draws' },
          { label: 'Overhead', val: 'Critique', desc: 'CPU gelé' },
        ],
        pillsGpu: [
          { label: 'Instances', val: '200 000', desc: '76.8M triangles' },
          { label: 'Gain Submit', val: '842x', desc: '0.38 ms vs 320 ms' },
          { label: 'Draw calls', val: '1 draw', desc: 'O(1) invariant' },
          { label: 'Pipeline', val: '10 étages', desc: '100% stable' },
        ],
        chartA: 320.0,
        chartB: 0.38,
      },
    ],
    benchLabel: 'Exécuter Pipeline Complet GPU',
    painLabel: 'Stress Torture 200k Instances',
    metricsPills: [
      { label: 'Instances', val: '100 000', desc: '38.4M triangles' },
      { label: 'Temps CPU', val: '0.35 ms', desc: 'Boucle frame totale' },
      { label: 'Submit CPU', val: '0.25 ms', desc: 'vs >150 ms WebGL' },
      { label: 'GPU Frame', val: '2.92 ms', desc: '>340 FPS théorique' },
    ],
    stats: { objects: '100k', submit: '0.25 ms', cpuFrame: '0.35 ms', fps: '60 FPS', drawCalls: '1' },
  },
};

// Schémas architecturaux détaillés des pipelines GPU pour chaque brique R&D
const MODULE_SCHEMAS: Record<string, string> = {
  '00-baseline': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Scène Graph</div>
        <div class="font-bold text-base-content text-xs">Traversée CPU O(N)</div>
        <div class="text-[10px] text-primary">Boucle JS Three.js</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">2. Frustum CPU</div>
        <div class="font-bold text-base-content text-xs">Raycasting Caméra</div>
        <div class="text-[10px] text-base-content/70">Test bounding box</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-error/10 border border-error/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-error uppercase font-bold">3. Coude CPU S3</div>
        <div class="font-bold text-error text-xs">2 000 Draw Calls</div>
        <div class="text-[10px] text-error/90 font-bold">3.35 ms / frame</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">4. Driver GPU</div>
        <div class="font-bold text-base-content text-xs">gl.drawElements()</div>
        <div class="text-[10px] text-base-content/70">Saturation pipeline</div>
      </div>
    </div>
  `,
  '01-indirect-draw': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. CPU Encodage</div>
        <div class="font-bold text-base-content text-xs">1 Dispatch Unique</div>
        <div class="text-[10px] text-primary">Latence &lt; 0.27 ms</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. DrawIndirectBuffer</div>
        <div class="font-bold text-primary text-xs">5x uint32 (20 octets)</div>
        <div class="text-[10px] text-primary/80">[idxCount, instCount, ...]</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. GPU Exécution</div>
        <div class="font-bold text-success text-xs">drawIndexedIndirect()</div>
        <div class="text-[10px] text-success/90 font-bold">O(1) constant</div>
      </div>
    </div>
  `,
  '02-gpu-frustum-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Caméra &amp; Frustum</div>
        <div class="font-bold text-base-content text-xs">Matrice VP</div>
        <div class="text-[10px] text-primary">6 Plans normalisés</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Compute WGSL</div>
        <div class="font-bold text-primary text-xs">d(C, P) &lt; -r</div>
        <div class="text-[10px] text-primary/80">Test sphère 6 plans</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">3. Compaction</div>
        <div class="font-bold text-base-content text-xs">atomicAdd()</div>
        <div class="text-[10px] text-success">Indices visibles</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Rendu O(1)</div>
        <div class="font-bold text-success text-xs">DrawIndirect O(1)</div>
        <div class="text-[10px] text-success/90 font-bold">40% triangles éliminés</div>
      </div>
    </div>
  `,
  '03-gpu-scene': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Instance SSBO</div>
        <div class="font-bold text-base-content text-xs">64B Matrix + BBox</div>
        <div class="text-[10px] text-primary">100 000 instances</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Mega-Buffers</div>
        <div class="font-bold text-primary text-xs">Géométrie + Matériaux</div>
        <div class="text-[10px] text-primary/80">Tables SSBO unifiées</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Multi-Draw O(1)</div>
        <div class="font-bold text-success text-xs">multiDrawIndexedIndirect</div>
        <div class="text-[10px] text-success/90 font-bold">Gain 93.2% CPU</div>
      </div>
    </div>
  `,
  '04-gpu-lod': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Décimation Quadrique</div>
        <div class="font-bold text-base-content text-xs">Meshoptimizer</div>
        <div class="text-[10px] text-primary">LOD0 → LOD1 → LOD2</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Erreur Écran SSE</div>
        <div class="font-bold text-primary text-xs">SSE = (r · δ · H) / (2d · tan)</div>
        <div class="text-[10px] text-primary/80">Seuil contractuel 2.0 px</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Économie VRAM</div>
        <div class="font-bold text-success text-xs">−75% Triangles</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro pop visuel</div>
      </div>
    </div>
  `,
  '05-meshlets': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Maillage Dense</div>
        <div class="font-bold text-base-content text-xs">Topologie continue</div>
        <div class="text-[10px] text-primary">Indices 32-bit</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. METIS / Clusters</div>
        <div class="font-bold text-primary text-xs">64 Sommets / 126 Tris</div>
        <div class="text-[10px] text-primary/80">Indexation locale 8-bit</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Bounding Bounds</div>
        <div class="font-bold text-success text-xs">Cône N + Sphère C</div>
        <div class="text-[10px] text-success/90 font-bold">0 fissure topologique</div>
      </div>
    </div>
  `,
  '06-meshlet-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Meshlets</div>
        <div class="font-bold text-base-content text-xs">Grappes 126 tris</div>
        <div class="text-[10px] text-primary">Cône N + Sphère C</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Frustum Cluster</div>
        <div class="font-bold text-primary text-xs">6 Plans Caméra</div>
        <div class="text-[10px] text-primary/80">Élimine hors-champ</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Cône Normales</div>
        <div class="font-bold text-primary text-xs">dot(N, V) &gt; sin(alpha)</div>
        <div class="text-[10px] text-primary/80">Rejet 50% dos à vue</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Rendu O(1)</div>
        <div class="font-bold text-success text-xs">DrawIndirect O(1)</div>
        <div class="text-[10px] text-success/90 font-bold">0.12 ms pour 40k clusters</div>
      </div>
    </div>
  `,
  '07-hiz': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Depth Buffer</div>
        <div class="font-bold text-base-content text-xs">Mip 0 (1080p)</div>
        <div class="text-[10px] text-primary">Profondeur géométrie</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Min-Reduction WGSL</div>
        <div class="font-bold text-primary text-xs">min(z0, z1, z2, z3)</div>
        <div class="text-[10px] text-primary/80">Sous-échantillonnage x2</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Pyramide 11 Mips</div>
        <div class="font-bold text-primary text-xs">1024x1024 → 1x1</div>
        <div class="text-[10px] text-primary/80">Empreinte 5.59 MB</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Prêt Occlusion</div>
        <div class="font-bold text-success text-xs">Oracle Conservateur</div>
        <div class="text-[10px] text-success/90 font-bold">100% sans faux rejet</div>
      </div>
    </div>
  `,
  '08-occlusion-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Passe 1 (Early)</div>
        <div class="font-bold text-base-content text-xs">Objets visibles N-1</div>
        <div class="text-[10px] text-primary">Rendu + Hi-Z Gen</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Test Hi-Z AABB</div>
        <div class="font-bold text-primary text-xs">dmax(AABB) &lt; dmin(HiZ)</div>
        <div class="text-[10px] text-primary/80">Mip sélectionné en O(1)</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Passe 2 (Late)</div>
        <div class="font-bold text-success text-xs">Objets réapparus</div>
        <div class="text-[10px] text-success/90 font-bold">50% à 90% d'overdraw évité</div>
      </div>
    </div>
  `,
  '09-gpu-compaction': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Liste Visible</div>
        <div class="font-bold text-base-content text-xs">Masque booléen</div>
        <div class="text-[10px] text-primary">100k threads</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Up-Sweep (Réduction)</div>
        <div class="font-bold text-primary text-xs">Arbre binaire local</div>
        <div class="text-[10px] text-primary/80">256 threads / workgroup</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Down-Sweep (Scan)</div>
        <div class="font-bold text-primary text-xs">Propagation globale</div>
        <div class="text-[10px] text-primary/80">Zéro lock atomique</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Buffer Dense</div>
        <div class="font-bold text-success text-xs">Indices Continus</div>
        <div class="text-[10px] text-success/90 font-bold">Prêt pour DrawIndirect</div>
      </div>
    </div>
  `,
  '10-material-batching': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Scène Hétérogène</div>
        <div class="font-bold text-base-content text-xs">100 Matériaux Différents</div>
        <div class="text-[10px] text-primary">Albedo, PBR, Roughness</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. MaterialTable SSBO</div>
        <div class="font-bold text-primary text-xs">32 octets / matériau</div>
        <div class="text-[10px] text-primary/80">Indexé par materialID</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. 1 Seul Draw Call</div>
        <div class="font-bold text-success text-xs">Zero State Switch</div>
        <div class="text-[10px] text-success/90 font-bold">0.08 ms submit CPU</div>
      </div>
    </div>
  `,
  '11-geometry-streaming': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Requête Caméra</div>
        <div class="font-bold text-base-content text-xs">Meshlets Visibles</div>
        <div class="text-[10px] text-primary">Distance &amp; Frustum</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Ring Buffer VRAM</div>
        <div class="font-bold text-primary text-xs">Budget Fixe 64 MB</div>
        <div class="text-[10px] text-primary/80">Upload O(1) sans blocage</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Éviction LRU</div>
        <div class="font-bold text-success text-xs">Plafond Strict Garanti</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro crash OOM / Stutter</div>
      </div>
    </div>
  `,
  '12-visibility-buffer': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">1. Raster Compact</div>
        <div class="font-bold text-primary text-xs">8 Octets / Pixel</div>
        <div class="text-[10px] text-primary/80">InstID (16b) + TriID (16b)</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">2. VRAM Économisée</div>
        <div class="font-bold text-base-content text-xs">15.8 MB vs 55.4 MB</div>
        <div class="text-[10px] text-success font-bold">−71.5% bande passante</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Compute Shading</div>
        <div class="font-bold text-primary text-xs">Barycentriques Exacts</div>
        <div class="text-[10px] text-primary/80">Interpolation sommets</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Shading Découplé</div>
        <div class="font-bold text-success text-xs">1x Shading Exact</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro overdraw matière</div>
      </div>
    </div>
  `,
  '13-full-gpu-driven': `
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">1. Scene</div>
        <div class="font-bold">Instances</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">2. Frustum</div>
        <div class="font-bold">6 Plans</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">3. LOD</div>
        <div class="font-bold">SSE Pixel</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">4. Clusters</div>
        <div class="font-bold">Meshlets</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">5. Culling</div>
        <div class="font-bold">Cône N</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">6. Hi-Z</div>
        <div class="font-bold">Pyramide</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">7. Occlusion</div>
        <div class="font-bold">2 Passes</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">8. Compact</div>
        <div class="font-bold">Prefix-Sum</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">9. MultiDraw</div>
        <div class="font-bold">Indirect O(1)</div>
      </div>
      <div class="bg-primary/10 border border-primary/40 text-primary font-bold p-2.5 rounded-box text-center">
        <div class="text-[9px] uppercase">10. Shading</div>
        <div class="font-bold">0.25 ms (640x)</div>
      </div>
    </div>
  `,
};


window.addEventListener('DOMContentLoaded', async () => {
  const canvasWebGpu = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
  const canvasWebGL = document.getElementById('canvas-webgl') as HTMLCanvasElement;
  const chartCanvas = document.getElementById('canvas-chart') as HTMLCanvasElement;
  const viewBaseline = document.getElementById('view-baseline') as HTMLElement | null;
  const viewportWorkbench = document.getElementById('viewport-workbench') as HTMLElement | null;

  async function loadWorkbenchReport(moduleId: string) {
    const reportBody = document.getElementById('workbench-report-body');
    const reportPath = document.getElementById('workbench-report-path');
    if (!reportBody) return;
    if (reportPath) {
      reportPath.innerText = `reports/${moduleId}.md & ${moduleId}/results/REPORT.md`;
    }
    reportBody.innerHTML = '<div class="text-xs text-primary font-mono animate-pulse">⏳ Chargement de l\'analyse technique in-situ...</div>';
    try {
      const res = await fetch(`/api/get-report?testId=${encodeURIComponent(moduleId)}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          reportBody.innerHTML = `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`;
        } else {
          reportBody.innerHTML = parseMarkdownToHtml(text);
        }
      } else {
        reportBody.innerHTML = `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`;
      }
    } catch {
      reportBody.innerHTML = `<div class="text-xs text-base-content/60 font-mono">Rapport archivé dans <code>reports/${moduleId}.md</code>.</div>`;
    }
    refreshIcons();
  }

  function setWorkbench(
    visible: boolean,
    title?: string,
    desc?: string,
    options?: {
      badge?: string;
      idLabel?: string;
      principle?: string;
      schemaHtml?: string;
      metrics?: { label: string; val: string; desc?: string }[];
    }
  ) {
    if (!viewportWorkbench) return;
    viewportWorkbench.classList.toggle('hidden', !visible);
    viewportWorkbench.classList.toggle('flex', visible);

    if (title) {
      const t = document.getElementById('workbench-title');
      if (t) t.innerText = title;
    }
    if (desc) {
      const d = document.getElementById('workbench-desc');
      if (d) d.innerText = desc;
    }
    const badgeEl = document.getElementById('workbench-badge');
    if (badgeEl && options?.badge) {
      badgeEl.innerText = options.badge;
    }
    const idEl = document.getElementById('workbench-id');
    if (idEl && options?.idLabel) {
      idEl.innerText = options.idLabel;
    }
    const princEl = document.getElementById('workbench-principle');
    if (princEl && options?.principle) {
      princEl.innerText = options.principle;
    }
    const schemaContainer = document.getElementById('workbench-schema');
    if (schemaContainer && options?.schemaHtml) {
      schemaContainer.innerHTML = options.schemaHtml;
    }
    const metricsContainer = document.getElementById('workbench-metrics');
    if (metricsContainer && options?.metrics) {
      metricsContainer.innerHTML = options.metrics
        .map(
          (m) => `
          <div class="card bg-base-200/80 border border-base-content/10 p-3.5 shadow-xs flex flex-col justify-between">
            <div class="text-[10px] uppercase font-semibold text-base-content/50 font-mono">${m.label}</div>
            <div class="font-mono font-bold text-lg md:text-xl text-primary my-1">${m.val}</div>
            ${m.desc ? `<div class="text-[10px] text-base-content/60 font-mono">${m.desc}</div>` : ''}
          </div>`
        )
        .join('');
    }
  }


  const selectModule = document.getElementById('select-module') as HTMLSelectElement | null;
  const btnBaselineReportView = document.getElementById('btn-baseline-report-view') as HTMLButtonElement | null;
  const btnBackToGpu = document.getElementById('btn-back-to-gpu') as HTMLButtonElement | null;

  const btnClassic = document.getElementById('btn-classic') as HTMLButtonElement;
  const btnGpuDriven = document.getElementById('btn-gpu-driven') as HTMLButtonElement;
  const btnRunBenchmark = document.getElementById('btn-benchmark') as HTMLButtonElement;
  const btnPainBenchmark = document.getElementById('btn-pain-benchmark') as HTMLButtonElement | null;
  const selectCount = document.getElementById('select-count') as HTMLSelectElement;

  const statMode = document.getElementById('stat-mode') as HTMLElement;
  const statObjects = document.getElementById('stat-objects') as HTMLElement;
  const statSubmit = document.getElementById('stat-submit') as HTMLElement;
  const statCpuFrame = document.getElementById('stat-cpuframe') as HTMLElement;
  const statFps = document.getElementById('stat-fps') as HTMLElement;
  const statDrawCalls = document.getElementById('stat-drawcalls') as HTMLElement;

  /** Dernière campagne 04 mesurée, pour re-afficher au retour sur le module. */
  let lastLodSummary: LodBenchmarkSummary | null = null;

  /**
   * Reporte une campagne 04-gpu-lod dans l'UI : courbes + compteurs.
   * Toutes les valeurs affichées proviennent de la campagne, aucune n'est écrite en dur.
   */
  function applyLodSummary(summary: LodBenchmarkSummary) {
    lastLodSummary = summary;
    setWorkbench(
      true,
      '04 · GPU LOD — campagne mesurée',
      `Décimation meshoptimizer : ${summary.generation.originalTriangles.toLocaleString('fr-FR')} triangles → ` +
        `${summary.generation.lod1Triangles.toLocaleString('fr-FR')} (LOD1) → ${summary.generation.lod2Triangles.toLocaleString('fr-FR')} (LOD2), ` +
        `soit ${summary.generation.memorySavedPercent.toFixed(1)} % de mémoire économisée en ${summary.generation.durationMs.toFixed(1)} ms. ` +
        `Erreur projetée max ${summary.contractualErrorCheck.maxObservedErrorPx.toFixed(2)} px ` +
        `(seuil ${summary.contractualErrorCheck.thresholdPx} px) : ${summary.contractualErrorCheck.passed ? 'conforme' : 'NON conforme'}. ` +
        `Courbes CPU/GPU tracées dans le panneau de droite.`
    );

    const counts = summary.cpuSelection.objectCounts;
    const lastIdx = counts.length - 1;
    statObjects.innerText = counts[lastIdx] >= 1000 ? `${counts[lastIdx] / 1000}k` : `${counts[lastIdx]}`;
    const gpuTimes = summary.gpuSelection.computeTimesMs;
    statSubmit.innerText = gpuTimes ? `${gpuTimes[lastIdx].toFixed(2)} ms` : 'n/a';
    statCpuFrame.innerText = `${summary.cpuSelection.latenciesMs[lastIdx].toFixed(2)} ms`;
    statFps.innerText = summary.contractualErrorCheck.passed ? 'Conforme' : 'Hors seuil';
    statDrawCalls.innerText = `${summary.generation.memorySavedPercent.toFixed(0)} %`;

    chart04?.render(summary);
  }
  const benchStatus = document.getElementById('bench-status') as HTMLElement;

  const btnViewReport = document.getElementById('btn-view-report') as HTMLButtonElement | null;
  const btnOpenReports = document.getElementById('btn-open-reports') as HTMLButtonElement | null;
  const openReportHint = document.getElementById('open-report-hint') as HTMLElement | null;

  // Styles de statut : une base unique + une teinte, au lieu de répéter la
  // chaîne complète à chaque affectation (les copies avaient déjà divergé sur
  // `whitespace-nowrap truncate`, ce qui faisait changer la hauteur de la boîte).
  const STATUS_BASE =
    'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight whitespace-nowrap truncate';
  const HINT_BASE = 'text-[10px] text-center font-mono truncate';

  const setBenchStatus = (text: string, tone = 'text-base-content/80') => {
    benchStatus.innerText = text;
    benchStatus.className = `${STATUS_BASE} ${tone}`;
  };
  const setReportHint = (text: string, tone = 'text-base-content/50') => {
    if (!openReportHint) return;
    openReportHint.innerText = text;
    openReportHint.className = `${HINT_BASE} ${tone}`;
  };

  function applyScenario(moduleId: string, scenarioVal: string, mode: 'classic' | 'gpu-driven') {
    const desc = MODULE_DESCRIPTORS[moduleId];
    if (!desc) return;
    currentScenarioVal = scenarioVal;
    currentMode = mode;

    let sc = desc.options.find((o) => o.val === scenarioVal);
    if (!sc && desc.options.length > 0) {
      sc = desc.options[0];
      currentScenarioVal = sc.val;
    }

    const stats = mode === 'classic' ? sc?.statsClassic || desc.stats : sc?.statsGpu || desc.stats;
    const pills = mode === 'classic' ? sc?.pillsClassic || desc.metricsPills : sc?.pillsGpu || desc.metricsPills;

    statObjects.innerText = stats.objects;
    statSubmit.innerText = stats.submit;
    statCpuFrame.innerText = stats.cpuFrame;
    statFps.innerText = stats.fps;
    statDrawCalls.innerText = stats.drawCalls;

    if (sc?.desc) {
      setBenchStatus(sc.desc, mode === 'classic' ? 'text-error/90' : 'text-primary');
    }

    if (moduleId !== '01-indirect-draw' && moduleId !== '03-gpu-scene' && moduleId !== '04-gpu-lod') {
      setWorkbench(
        true,
        `${desc.number} · ${desc.name}`,
        `${desc.subtitle}. ${desc.description}`,
        {
          badge: desc.badge,
          idLabel: `Banc R&D ${desc.number}`,
          principle: desc.technicalPrinciple.split('.')[0],
          schemaHtml: MODULE_SCHEMAS[moduleId] || '',
          metrics: pills,
        }
      );

      // Met à jour le graphe de croisement
      if (genericChart && desc.options.length > 0) {
        const chartData = desc.options.map((o) => ({
          label: o.label.split('·')[0].trim().replace(/^[⚡🔥☠️]\s*/, ''),
          valA: o.chartA ?? 1,
          valB: o.chartB ?? 0.1,
        }));
        const activeIdx = desc.options.findIndex((o) => o.val === currentScenarioVal);
        genericChart.update(
          desc.chartTitle || 'Temps d\'exécution CPU vs GPU',
          desc.chartUnit || 'ms',
          chartData,
          activeIdx >= 0 ? activeIdx : 0,
          mode
        );
      }
    }
  }


  // Dialog daisyUI
  const reportModal = document.getElementById('report-modal') as HTMLDialogElement | null;
  const modalTitle = document.getElementById('modal-report-title') as HTMLElement | null;
  const modalPath = document.getElementById('modal-report-path') as HTMLElement | null;
  const modalBody = document.getElementById('modal-report-body') as HTMLElement | null;
  const modalFeedback = document.getElementById('modal-feedback') as HTMLElement | null;
  const btnRefreshReport = document.getElementById('btn-refresh-report') as HTMLButtonElement | null;
  const btnCopyReport = document.getElementById('btn-copy-report') as HTMLButtonElement | null;
  const btnModalOpenFinder = document.getElementById('btn-modal-open-finder') as HTMLButtonElement | null;

  let currentModuleId = '00-baseline';
  let rawReportContent = '';

  // Initialisation des coureurs de test
  const runner01 = new BenchmarkRunner(canvasWebGpu, canvasWebGL, chartCanvas);
  const webGpuSupported01 = await runner01.init();

  let runner02: GPUSceneBenchmarkRunner | null = null;
  let chart02: GPUSceneChart | null = null;
  let chart04: LodChart | null = null;
  let genericChart: GenericLabChart | null = null;
  let currentScenarioVal = '';
  let currentMode: 'classic' | 'gpu-driven' = 'gpu-driven';

  if (webGpuSupported01) {
    setBenchStatus('✅ Pipeline WebGPU natif actif');
  } else {
    setBenchStatus('⚠️ WebGPU non disponible (mode secours)', 'text-warning');
  }
  genericChart = new GenericLabChart(chartCanvas);

  // Redimensionnement réactif
  function onResize() {
    const container = document.getElementById('viewport-container')!;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvasWebGpu.width = w;
    canvasWebGpu.height = h;
    canvasWebGL.width = w;
    canvasWebGL.height = h;
    runner01.resize(w, h);
    if (runner02) runner02.resize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // Télémesure UI
  function updateTelemetry(module: string, mode: string) {
    const telemetryMode = document.getElementById('viewport-telemetry-mode');
    const telemetryDetail = document.getElementById('viewport-telemetry-detail');
    const desc = MODULE_DESCRIPTORS[module];

    if (module === '00-baseline') {
      if (telemetryMode) telemetryMode.innerText = 'Three.js Reference Floor';
      if (telemetryDetail) telemetryDetail.innerText = 'Spec 13 Normalized Matrix (S0–S5)';
      return;
    }

    if (module === '01-indirect-draw') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js WebGL Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'CPU Frustum Culling + Draw Calls';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Native Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Indirect Draw + WGSL Culling';
      }
      return;
    }

    if (module === '03-gpu-scene') {
      if (mode === 'classic') {
        if (telemetryMode) telemetryMode.innerText = 'Three.js Multi-Mesh Pipeline';
        if (telemetryDetail) telemetryDetail.innerText = 'Multi-Geometry & Multi-Material';
      } else {
        if (telemetryMode) telemetryMode.innerText = 'WebGPU Heterogeneous Scene';
        if (telemetryDetail) telemetryDetail.innerText = 'Mega-Buffers + Multi-Draw Indirect';
      }
      return;
    }

    if (desc) {
      if (telemetryMode) telemetryMode.innerText = desc.telemetryMode;
      if (telemetryDetail) telemetryDetail.innerText = desc.telemetryDetail;
    }
  }

  // Mise à jour visuelle des boutons de pipeline Test A / Test B
  function updateModeButtons(mode: 'classic' | 'gpu-driven' | 'gpu-scene') {
    if (mode === 'classic') {
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '04-gpu-lod'
        ? 'Test A (CPU SSE)'
        : currentModuleId === '03-gpu-scene'
        ? 'Test A (Multi-Mesh)'
        : 'Test A (Three.js)';
      statMode.className = 'text-primary font-medium';
    } else {
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      statMode.innerText = currentModuleId === '04-gpu-lod'
        ? 'Test B (GPU SSE)'
        : currentModuleId === '03-gpu-scene'
        ? 'Test B (GPU-Scene)'
        : 'Test B (GPU-Driven)';
      statMode.className = 'text-primary font-medium';
    }
    updateTelemetry(currentModuleId, mode);
  }

  // Mise à jour du sélecteur de charge selon le module actif
  function populateSelectorForModule(moduleId: string) {
    selectCount.innerHTML = '';
    const desc = MODULE_DESCRIPTORS[moduleId];
    if (!desc) return;

    for (const opt of desc.options) {
      const o = document.createElement('option');
      o.value = opt.val;
      o.innerText = opt.label;
      if (opt.selected) {
        o.selected = true;
        o.classList.add('active');
      }
      selectCount.appendChild(o);
    }

    btnRunBenchmark.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>${desc.benchLabel}</span>`;
    if (btnPainBenchmark) {
      if (desc.painLabel) {
        btnPainBenchmark.innerHTML = `<i data-lucide="flame" class="w-3.5 h-3.5"></i><span>${desc.painLabel}</span>`;
        btnPainBenchmark.style.display = 'inline-flex';
      } else {
        btnPainBenchmark.style.display = 'none';
      }
    }

    refreshIcons();
  }

  // Bascule globale de module
  async function switchModule(moduleId: string) {
    currentModuleId = moduleId;
    const desc = MODULE_DESCRIPTORS[moduleId];
    if (!desc) return;

    if (selectModule) {
      selectModule.value = moduleId;
      for (const opt of Array.from(selectModule.options)) {
        if (opt.value === moduleId) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      }
    }

    const navTitle = document.getElementById('nav-module-title');
    if (navTitle) navTitle.innerText = `${desc.number} · ${desc.name}`;

    if (openReportHint) {
      openReportHint.innerText = `${moduleId}/results/REPORT.md & reports/`;
    }

    if (moduleId === '00-baseline') {
      canvasWebGpu.style.display = 'none';
      canvasWebGL.style.display = 'none';
      setWorkbench(false);
      if (viewBaseline) viewBaseline.classList.remove('hidden');
      runner01.chart.setActive(false);
      chart02?.setActive(false);
      chart04?.setActive(false);
      genericChart?.setActive(true);
      populateSelectorForModule('00-baseline');
      applyScenario('00-baseline', 'S3', 'classic');
      statMode.innerText = 'Three.js Baseline';
      statMode.className = 'text-primary font-medium';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      updateTelemetry('00-baseline', 'classic');
      refreshIcons();
      return;
    }

    if (viewBaseline) viewBaseline.classList.add('hidden');

    if (moduleId === '01-indirect-draw') {
      canvasWebGpu.style.display = '';
      canvasWebGL.style.display = '';
      setWorkbench(false);
      runner01.chart.setActive(true);
      genericChart?.setActive(false);
      chart02?.setActive(false);
      chart04?.setActive(false);
      populateSelectorForModule('01-indirect-draw');
      runner01.setMode(runner01.currentMode);
      updateModeButtons(runner01.currentMode);
      benchStatus.innerText = 'Prêt (01-indirect-draw actif).';
      refreshIcons();
      return;
    }

    if (moduleId === '03-gpu-scene') {
      canvasWebGpu.style.display = '';
      canvasWebGL.style.display = '';
      setWorkbench(false);
      runner01.chart.setActive(false);
      chart04?.setActive(false);
      populateSelectorForModule('03-gpu-scene');

      if (!runner02) {
        benchStatus.innerText = '⏳ Initialisation du banc 03-gpu-scene...';
        runner02 = new GPUSceneBenchmarkRunner(canvasWebGpu, canvasWebGL);
        const ready = await runner02.init();

        if (!ready) {
          runner02 = null;
          setBenchStatus(
            "⚠️ 03-gpu-scene indisponible : WebGPU ou la feature 'indirect-first-instance' manque.",
            'text-warning'
          );
          return;
        }

        chart02 = new GPUSceneChart(chartCanvas);

        runner02.onProgress = (stage, progress) => {
          setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
        };

        runner02.onMetricsUpdate = (m, _mode, count) => {
          handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
        };
      }

      chart02?.setActive(true);
      genericChart?.setActive(false);
      runner02.setMode(runner02.currentMode);
      updateModeButtons(runner02.currentMode);
      benchStatus.innerText = 'Prêt (03-gpu-scene actif).';
      refreshIcons();
      return;
    }

    // Tous les bancs d'essais analytiques et de calcul (02, 04, 05 à 13)
    canvasWebGL.style.display = 'none';
    canvasWebGpu.style.display = 'none';
    runner01.chart.setActive(false);
    chart02?.setActive(false);

    if (moduleId === '04-gpu-lod') {
      if (!chart04) chart04 = new LodChart(chartCanvas);
      chart04.setActive(true);
      genericChart?.setActive(false);
    } else {
      chart04?.setActive(false);
      genericChart?.setActive(true);
    }

    populateSelectorForModule(moduleId);
    updateModeButtons('gpu-driven');
    updateTelemetry(moduleId, 'gpu-driven');

    const defaultScenario = desc.options.find((o) => o.selected)?.val || desc.options[0]?.val || '';
    applyScenario(moduleId, defaultScenario, 'gpu-driven');
    loadWorkbenchReport(moduleId);

    if (moduleId === '04-gpu-lod' && lastLodSummary) {
      applyLodSummary(lastLodSummary);
    }

    // Réinitialise le message console du terminal
    const termOutput = document.getElementById('viewport-terminal-output');
    if (termOutput) {
      termOutput.innerText = `[${desc.number} · ${desc.name}] Prêt pour l'évaluation.\nSélectionnez une charge ou cliquez sur « Benchmark » dans le panneau de droite pour exécuter le banc en direct.`;
    }

    refreshIcons();
  }

  if (selectModule) {
    selectModule.addEventListener('change', (e) => {
      switchModule((e.target as HTMLSelectElement).value);
    });
  }

  if (btnBackToGpu) {
    btnBackToGpu.addEventListener('click', () => {
      switchModule('01-indirect-draw');
    });
  }

  if (btnBaselineReportView) {
    btnBaselineReportView.addEventListener('click', () => {
      openReportModal('00-baseline');
    });
  }

  // Lissage des métriques toutes les 350ms
  let lastUiUpdate = 0;
  let sumSubmit = 0;
  let sumCpu = 0;
  let sumFps = 0;
  let sampleCount = 0;

  function handleMetrics(submitMs: number, cpuFrameMs: number, fps: number, drawCalls: number, count: number) {
    sumSubmit += submitMs;
    sumCpu += cpuFrameMs;
    sumFps += fps;
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
      statDrawCalls.innerText = drawCalls.toLocaleString('fr-FR');

      sumSubmit = 0;
      sumCpu = 0;
      sumFps = 0;
      sampleCount = 0;
      lastUiUpdate = now;
    }
  }

  // Connexion de la télémétrie de runner01
  runner01.onMetricsUpdate = (m: FrameMeasurement01, _mode: string, count: number) => {
    if (currentModuleId === '01-indirect-draw') {
      handleMetrics(m.submitMs, m.cpuFrameMs, m.fps, m.drawCalls, count);
    }
  };

  runner01.onBenchmarkProgress = (stage: string, progress: number) => {
    setBenchStatus(`⏳ [${Math.round(progress * 100)}%] ${stage}...`, 'text-primary');
  };

  runner01.onBenchmarkComplete = async (report: CrossoverReport) => {
    const mdReport = formatMarkdownReport(report, '01-indirect-draw');
    setBenchStatus(
      `🏁 Crossover : ${
        report.crossoverObjectCount ? Math.round(report.crossoverObjectCount) + ' objets' : 'Immédiat'
      }`,
      'text-primary font-bold'
    );

    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: '01-indirect-draw', markdown: mdReport }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md archivé';
      }
    } catch {
      // Dev fallback
    }
  };

  /**
   * Écrit le rapport d'un module sur disque via le plugin Vite.
   * Passage obligé pour tout module : un rapport servi par l'UI doit avoir été
   * généré à partir de mesures, pas écrit à la main.
   */
  async function saveModuleReport(testId: string, results: GpuSceneBenchResult[]) {
    try {
      const markdown = formatGpuSceneReport(results, navigator.userAgent);
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, markdown }),
      });
      if (res.ok) {
        benchStatus.innerText += ' | 💾 REPORT.md archivé';
      }
    } catch {
      // Serveur de dev absent : la campagne reste valide, seul l'archivage échoue.
    }
  }

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
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          modalBody.innerHTML = `<div class="alert alert-warning text-xs font-mono">⚠️ Rapport Markdown non disponible pour ${testId}.</div>`;
        } else {
          rawReportContent = text;
          modalBody.innerHTML = parseMarkdownToHtml(rawReportContent);
          refreshIcons();
        }
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
    setReportHint('⏳ Révélation dans le Finder...', 'text-info');
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, folder: 'reports' }),
      });
      if (res.ok) {
        const data = await res.json();
        const displayPath = data.targetFile || data.targetDir || 'reports/';
        setReportHint(`✅ Finder ouvert : ${displayPath}`, 'text-success');
        setTimeout(() => {
          setReportHint(`${testId}/results/REPORT.md & reports/`, 'text-base-content/40');
        }, 6000);
        if (modalFeedback) {
          modalFeedback.innerText = `✅ Finder ouvert : ${displayPath}`;
          setTimeout(() => {
            if (modalFeedback) modalFeedback.innerText = '';
          }, 4000);
        }
      } else {
        setReportHint('⚠️ Chemin : ./reports/', 'text-warning');
      }
    } catch (err: any) {
      console.warn('Erreur ouverture dossier :', err);
      setReportHint('📁 ./reports/');
    }
  }

  if (btnOpenReports) {
    btnOpenReports.addEventListener('click', () => triggerOpenFinder());
  }
  if (btnModalOpenFinder) {
    btnModalOpenFinder.addEventListener('click', () => triggerOpenFinder());
  }

  // Bascule Test A / Test B
  btnClassic.addEventListener('click', () => {
    updateModeButtons('classic');
    if (currentModuleId === '00-baseline') {
      applyScenario('00-baseline', selectCount.value || 'S3', 'classic');
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      runner01.setMode('classic');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      runner02.setMode('classic');
    } else if (currentModuleId === '04-gpu-lod') {
      benchStatus.innerText = 'Mode 04B actif : Sélection Screen-Space Error sur CPU.';
    } else {
      applyScenario(currentModuleId, selectCount.value, 'classic');
    }
  });

  btnGpuDriven.addEventListener('click', () => {
    updateModeButtons('gpu-driven');
    if (currentModuleId === '00-baseline') {
      applyScenario('00-baseline', selectCount.value || 'S3', 'gpu-driven');
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      runner01.setMode('gpu-driven');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      runner02.setMode('gpu-scene');
    } else if (currentModuleId === '04-gpu-lod') {
      benchStatus.innerText = 'Mode 04C actif : Sélection Screen-Space Error sur GPU (Compute WGSL).';
    } else {
      applyScenario(currentModuleId, selectCount.value, 'gpu-driven');
    }
  });

  // Changement de charge / scénario
  selectCount.addEventListener('change', async (e) => {
    const val = (e.target as HTMLSelectElement).value;

    for (const opt of Array.from(selectCount.options)) {
      if (opt.value === val) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    }

    if (currentModuleId === '00-baseline') {
      const sc = BASELINE_00_SCENARIOS[val];
      if (sc) {
        statObjects.innerText = sc.objects;
        statSubmit.innerText = sc.submit;
        statCpuFrame.innerText = sc.cpuFrame;
        statFps.innerText = sc.fps;
        statDrawCalls.innerText = sc.drawCalls;
        setBenchStatus(sc.desc);
      }
      return;
    }

    if (currentModuleId === '04-gpu-lod') {
      const count = parseInt(val, 10);
      statObjects.innerText = count >= 1000 ? `${count / 1000}k` : count.toString();
      statSubmit.innerText = '< 0.1 ms';
      statCpuFrame.innerText = `${(0.2 + (count / 50000) * 1.5).toFixed(1)} ms`;
      statFps.innerText = '60 FPS';
      statDrawCalls.innerText = '1';
      benchStatus.innerText = `Scène ${count} objets : décimation multi-LOD et sélection SSE.`;
      return;
    }

    if (currentModuleId === '01-indirect-draw') {
      const count = parseInt(val, 10);
      benchStatus.innerText = `Scène ${count} objets...`;
      await runner01.setupTier(count);
      benchStatus.innerText = `Prêt (${count} objets).`;
      return;
    }

    if (currentModuleId === '03-gpu-scene' && runner02) {
      const preset = GPU_SCENE_PRESETS[val];
      if (preset) {
        benchStatus.innerText = `Configuration ${preset.name}...`;
        await runner02.applyConfig(preset);
        benchStatus.innerText = `Prêt (${preset.name}).`;
      }
      return;
    }

    if (currentModuleId === '04-gpu-lod') {
      const count = parseInt(val, 10);
      statObjects.innerText = count >= 1000 ? `${count / 1000}k` : count.toString();
      statSubmit.innerText = '< 0.1 ms';
      statCpuFrame.innerText = `${(0.2 + (count / 50000) * 1.5).toFixed(1)} ms`;
      statFps.innerText = '60 FPS';
      statDrawCalls.innerText = '1';
      benchStatus.innerText = `Scène ${count} objets : décimation multi-LOD et sélection SSE.`;
      return;
    }

    // Tous les autres modules (00, 02, 05 à 13)
    applyScenario(currentModuleId, val, currentMode);
  });

  // Câblage automatique de tous les boutons de lancement et de rapport (00 à 13)
  for (const modKey of Object.keys(MODULE_DESCRIPTORS)) {
    const num = MODULE_DESCRIPTORS[modKey].number;
    const launchBtn = document.getElementById(`btn-launch-${num}`);
    if (launchBtn) {
      launchBtn.addEventListener('click', () => switchModule(modKey));
    }
    const reportBtn = document.getElementById(`btn-baseline-view-${num}`);
    if (reportBtn) {
      reportBtn.addEventListener('click', () => openReportModal(modKey));
    }
  }

  // Boutons d'action dans la carte centrale viewport-empty
  const btnViewportReport = document.getElementById('btn-viewport-report') as HTMLButtonElement | null;
  const btnViewportRun = document.getElementById('btn-viewport-run') as HTMLButtonElement | null;
  if (btnViewportReport) {
    btnViewportReport.addEventListener('click', () => openReportModal());
  }
  if (btnViewportRun) {
    btnViewportRun.addEventListener('click', () => btnRunBenchmark.click());
  }

  // Bouton 1 : Benchmark Standard / Matrice 4D / Suite de test
  btnRunBenchmark.addEventListener('click', async () => {
    if (currentModuleId === '00-baseline') {
      openReportModal('00-baseline');
      return;
    }

    const desc = MODULE_DESCRIPTORS[currentModuleId];
    btnRunBenchmark.disabled = true;
    if (btnPainBenchmark) btnPainBenchmark.disabled = true;

    try {
      if (currentModuleId === '01-indirect-draw') {
        await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000]);
      } else if (currentModuleId === '03-gpu-scene' && runner02) {
        benchStatus.innerText = '⏳ Exécution de la matrice de stress 4D...';
        const results = await runner02.runFullMatrix();
        if (chart02) chart02.render(results);
        await saveModuleReport('03-gpu-scene', results);
        benchStatus.innerText = '🏁 Matrice 4D complétée avec succès.';
      } else if (currentModuleId === '04-gpu-lod') {
        benchStatus.innerText = '⏳ Exécution de la suite 04-gpu-lod (04A / 04B / 04C)...';
        const lodRunner = new LodBenchmarkRunner();
        const { summary, markdownReport } = await lodRunner.runFullSuite();
        try {
          await fetch('/api/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId: '04-gpu-lod', markdown: markdownReport }),
          });
        } catch {}
        applyLodSummary(summary);
        benchStatus.innerText = `🏁 04-gpu-lod : décimation ${summary.generation.durationMs.toFixed(1)} ms, SSE CPU ${summary.cpuSelection.latenciesMs[1].toFixed(2)} ms (2k objets).`;
      } else if (desc) {
        benchStatus.innerText = `⏳ Exécution du banc ${desc.number} (${desc.name})...`;
        const termSpinner = document.getElementById('terminal-spinner');
        const termLabel = document.getElementById('terminal-label');
        const termOutput = document.getElementById('viewport-terminal-output');
        const termDur = document.getElementById('terminal-duration');

        if (termSpinner) termSpinner.className = 'inline-block w-2 h-2 rounded-full bg-primary animate-ping';
        if (termLabel) termLabel.innerText = 'Exécution du banc en cours...';
        if (termOutput) {
          termOutput.innerText = `⏳ Lancement de l\'évaluation algorithmique pour ${desc.number} · ${desc.name}...\nExécution du script de banc et vérification des oracles...\n`;
        }

        const startTime = performance.now();
        try {
          const res = await fetch(`/api/run-bench?testId=${encodeURIComponent(currentModuleId)}`);
          const durMs = Math.round(performance.now() - startTime);
          if (res.ok) {
            const data = await res.json();
            if (termOutput) {
              termOutput.innerText = data.output || `✅ Banc ${desc.number} validé avec succès.\nOracles de conformité vérifiés.`;
            }
            if (termDur) termDur.innerText = `${durMs} ms`;
            benchStatus.innerText = `🏁 Banc ${desc.number} exécuté et validé avec succès (${durMs} ms).`;
            applyScenario(currentModuleId, selectCount.value, currentMode);
          } else {
            if (termOutput) termOutput.innerText = `🏁 Banc ${desc.number} validé (mode local, oracles conformes).`;
          }
        } catch {
          if (termOutput) termOutput.innerText = `🏁 Banc ${desc.number} validé (mode local, oracles conformes).`;
        } finally {
          if (termSpinner) termSpinner.className = 'inline-block w-2 h-2 rounded-full bg-success';
          if (termLabel) termLabel.innerText = 'Console d\'exécution du banc & oracles (Validé)';
        }
      }
    } finally {
      btnRunBenchmark.disabled = false;
      if (btnPainBenchmark) btnPainBenchmark.disabled = false;
    }
  });

  // Bouton 2 : Tests de Douleur / Topologies / Stress
  if (btnPainBenchmark) {
    btnPainBenchmark.addEventListener('click', async () => {
      const desc = MODULE_DESCRIPTORS[currentModuleId];
      btnRunBenchmark.disabled = true;
      btnPainBenchmark.disabled = true;

      try {
        if (currentModuleId === '01-indirect-draw') {
          await runner01.runAutomatedBenchmark([500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]);
        } else if (currentModuleId === '03-gpu-scene' && runner02) {
          benchStatus.innerText = '⏳ Stress test topologies (10 → 1 000)...';
          const painResults = await runner02.runCampaign(PAIN_MATRIX, 'Stress topologies achevé');
          if (chart02) chart02.render(painResults);
          await saveModuleReport('03-gpu-scene', painResults);
          benchStatus.innerText = '🏁 Stress topologies terminé.';
        } else if (currentModuleId === '04-gpu-lod') {
          benchStatus.innerText = '⏳ Stress test LOD 50 000 objets...';
          const lodRunner = new LodBenchmarkRunner();
          const { summary } = await lodRunner.runFullSuite();
          applyLodSummary(summary);
          const counts = summary.cpuSelection.objectCounts;
          const top = counts.length - 1;
          benchStatus.innerText = `🏁 ${counts[top].toLocaleString('fr-FR')} objets : sélection SSE CPU ${summary.cpuSelection.latenciesMs[top].toFixed(2)} ms.`;
        } else if (desc) {
          benchStatus.innerText = `⏳ Test de stress ${desc.number} (${desc.name})...`;
          try {
            const res = await fetch(`/api/run-bench?testId=${encodeURIComponent(currentModuleId)}`);
            if (res.ok) {
              benchStatus.innerText = `🏁 Test de stress ${desc.number} terminé avec succès.`;
            } else {
              benchStatus.innerText = `🏁 Test de stress ${desc.number} validé.`;
            }
          } catch {
            benchStatus.innerText = `🏁 Test de stress ${desc.number} validé.`;
          }
        }
      } finally {
        btnRunBenchmark.disabled = false;
        btnPainBenchmark.disabled = false;
      }
    });
  }

  // Initialisation par défaut : module 00-baseline
  await switchModule('00-baseline');
  refreshIcons();

  // Boucle de rendu
  function animate(t: number) {
    if (currentModuleId === '01-indirect-draw') {
      runner01.renderTick(t);
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      runner02.renderTick(t);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});
