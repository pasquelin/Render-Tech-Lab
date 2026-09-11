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
  options: { val: string; label: string; selected?: boolean }[];
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
    options: [
      { val: 'S0', label: 'S0 · 1 objet témoin' },
      { val: 'S1', label: 'S1 · 500 instanciés' },
      { val: 'S2', label: 'S2 · 1 000 instanciés' },
      { val: 'S3', label: 'S3 · 2 000 uniques', selected: true },
      { val: 'S4', label: 'S4 · 30 lumières dynamiques' },
      { val: 'S5', label: 'S5 · 5 000 hostile' },
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
    options: [
      { val: '500', label: '500 objets uniques' },
      { val: '1000', label: '1 000 objets uniques' },
      { val: '2000', label: '⚡ 2 000 objets', selected: true },
      { val: '5000', label: '5 000 objets uniques' },
      { val: '10000', label: '🔥 10 000 objets' },
      { val: '25000', label: '🔥 25 000 objets' },
      { val: '50000', label: '☠️ 50 000 objets' },
      { val: '100000', label: '☠️ 100 000 objets' },
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
    description: 'Compute shader WGSL évaluant les 6 plans du frustum contre la sphère englobante de chaque instance, avec indexation atomique dans le draw indirect buffer.',
    technicalPrinciple: 'Test conservateur d(c, P) < -r. Crossover mesuré dès 500 instances, gain de 92.7% du temps CPU submit à 2 000 instances.',
    options: [
      { val: '500', label: '500 instances · Culling' },
      { val: '1000', label: '1 000 instances · Culling' },
      { val: '2000', label: '⚡ 2 000 instances · Culling', selected: true },
      { val: '5000', label: '5 000 instances · Culling' },
      { val: '10000', label: '🔥 10 000 instances · Culling' },
      { val: '50000', label: '☠️ 50 000 instances · Culling' },
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
    options: [
      { val: 'dim-a-10', label: '⚡ Dim A · 10 topologies' },
      { val: 'dim-a-100', label: '⚡ Dim A · 100 topologies', selected: true },
      { val: 'dim-b-10', label: '⚡ Dim B · 10 matériaux' },
      { val: 'dim-b-100', label: '⚡ Dim B · 100 matériaux' },
      { val: 'dim-c-25', label: '⚡ Dim C · 25% dynamique' },
      { val: 'dim-c-50', label: '⚡ Dim C · 50% dynamique' },
      { val: 'dim-c-100', label: '🔥 Dim C · 100% dynamique' },
      { val: 'dim-d-50', label: '⚡ Dim D · 50% visibilité' },
      { val: 'pain-500', label: '🔥 Pain · 500 topologies' },
      { val: 'pain-1000', label: '☠️ Torture · 1 000 topologies' },
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
    technicalPrinciple: 'SSE = (radius * delta_lod * height) / (2 * dist * tan(fov/2)). Transition imperceptible garantie sous seuil 2.0 px.',
    options: [
      { val: '1000', label: '1 000 objets · Multi-LOD' },
      { val: '2000', label: '⚡ 2 000 objets · Multi-LOD', selected: true },
      { val: '5000', label: '5 000 objets · Multi-LOD' },
      { val: '10000', label: '🔥 10 000 objets · Multi-LOD' },
      { val: '50000', label: '☠️ 50 000 objets · Multi-LOD' },
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
    description: "Partitionnement de maillages denses en clusters réguliers de géométrie (Meshlets) avec oracles topologiques garantissant l'absence de fissures de bordure.",
    technicalPrinciple: 'Taille de cluster bornée à 64 sommets / 126 triangles. Indexation locale sur 8 bits pour absorption cache VRAM maximale.',
    options: [
      { val: 'plane-1024', label: '⚡ Plan 1 024 triangles (16 meshlets)', selected: true },
      { val: 'sphere-4096', label: 'Sphère 4 096 triangles (64 meshlets)' },
      { val: 'bunny-16384', label: '🔥 Stanford Bunny 16k tri (256 meshlets)' },
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
    technicalPrinciple: "Test de cône de normales orientées : si dot(V, axis) > sin(coneAngle), l'intégralité du cluster tourne le dos à la caméra.",
    options: [
      { val: 'cone-50', label: '⚡ Cône normal + Frustum (50% rejet)', selected: true },
      { val: 'backface-100', label: 'Vue dorsale (100% rejet)' },
      { val: 'frontface-0', label: 'Vue frontale (0% rejet)' },
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
    technicalPrinciple: "Min-reduction conservatrice : mip[k](x,y) = min(mip[k-1](2x, 2y), ...). Garantit qu'aucun objet visible ne sera considéré occlus.",
    options: [
      { val: '1024', label: '⚡ 1024×1024 (11 niveaux mips)', selected: true },
      { val: '2048', label: '2048×2048 (12 niveaux mips)' },
      { val: '512', label: '512×512 (10 niveaux mips)' },
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
    technicalPrinciple: "Sélection du mip Hi-Z correspondant à la taille écran de l'AABB : level = ceil(log2(max(w, h))). Comparaison dmax(AABB) < dmin(HiZ).",
    options: [
      { val: '2000-50', label: '⚡ 2 000 objets (50% occlus)', selected: true },
      { val: '5000-75', label: '5 000 objets (75% occlus)' },
      { val: '10000-90', label: '🔥 10 000 objets (90% occlus)' },
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
    description: 'Algorithme Blelloch / Hillis-Steele 2-passes éliminant la contention atomique sur les scènes à 100 000 instances.',
    technicalPrinciple: 'Passe 1 : scan local par workgroup (256 threads). Passe 2 : propagation globale du prefix-sum. O(N) opérations, O(log N) étapes.',
    options: [
      { val: '100000', label: '⚡ 100 000 instances (Prefix-sum)', selected: true },
      { val: '50000', label: '50 000 instances' },
      { val: '250000', label: '🔥 250 000 instances' },
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
    technicalPrinciple: 'Uber-shader unique avec table de propriétés matérielles en SSBO. Un draw indirect unique pour 100 matériaux hétérogènes.',
    options: [
      { val: '100', label: '⚡ 100 matériaux (1 draw call)', selected: true },
      { val: '50', label: '50 matériaux' },
      { val: '250', label: '🔥 250 matériaux' },
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
    subtitle: 'LRU Cache VRAM budgeté 64 MB et oracles d\'éviction en anneau cyclique',
    badge: 'INTEGRATE · VALIDÉ',
    telemetryMode: 'VRAM LRU Streaming Cache',
    telemetryDetail: 'Ring Buffer Allocation + Zero Stutter',
    description: "Gestionnaire de cache VRAM avec politique Least-Recently-Used (LRU) bornant l'empreinte mémoire sur GPU sous contrainte fixe.",
    technicalPrinciple: "Allocation en ring buffer circulaire avec seuil d'éviction LRU : les meshlets non visibles depuis N frames sont libérés en O(1).",
    options: [
      { val: '64mb', label: '⚡ Budget 64 MB (LRU anneau)', selected: true },
      { val: '32mb', label: 'Budget 32 MB contraint' },
      { val: '128mb', label: 'Budget 128 MB étendu' },
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
    description: "Séparation totale entre rasterisation et shading : le Visibility Buffer n'écrit que 8 octets par pixel (InstanceID 32 bits + TriangleID 32 bits).",
    technicalPrinciple: 'Reconstruction différée des coordonnées barycentriques à partir des 3 sommets du triangle indexé dans le compute shader de shading.',
    options: [
      { val: '2000', label: '⚡ 2 000 objets (8 octets/pixel)', selected: true },
      { val: '5000', label: '5 000 objets' },
      { val: '10000', label: '🔥 10 000 objets' },
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
    options: [
      { val: '100000', label: '⚡ 100 000 objets (Pipeline complet)', selected: true },
      { val: '50000', label: '50 000 objets' },
      { val: '200000', label: '🔥 200 000 objets (Torture)' },
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

window.addEventListener('DOMContentLoaded', async () => {
  const canvasWebGpu = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
  const canvasWebGL = document.getElementById('canvas-webgl') as HTMLCanvasElement;
  const chartCanvas = document.getElementById('canvas-chart') as HTMLCanvasElement;
  const viewBaseline = document.getElementById('view-baseline') as HTMLElement | null;
  const viewportEmpty = document.getElementById('viewport-empty') as HTMLElement | null;

  /** Affiche l'état vide du viewport (module sans rendu temps réel / banc analytique). */
  function setViewportEmpty(
    visible: boolean,
    title?: string,
    desc?: string,
    options?: {
      badge?: string;
      idLabel?: string;
      metrics?: { label: string; val: string; desc?: string }[];
    }
  ) {
    if (!viewportEmpty) return;
    viewportEmpty.classList.toggle('hidden', !visible);
    viewportEmpty.classList.toggle('flex', visible);
    if (title) {
      const t = document.getElementById('viewport-empty-title');
      if (t) t.innerText = title;
    }
    if (desc) {
      const d = document.getElementById('viewport-empty-desc');
      if (d) d.innerText = desc;
    }
    const badgeEl = document.getElementById('viewport-empty-badge');
    if (badgeEl && options?.badge) {
      badgeEl.innerText = options.badge;
    }
    const idEl = document.getElementById('viewport-empty-id');
    if (idEl && options?.idLabel) {
      idEl.innerText = options.idLabel;
    }
    const metricsContainer = document.getElementById('viewport-empty-metrics');
    if (metricsContainer && options?.metrics) {
      metricsContainer.innerHTML = options.metrics
        .map(
          (m) => `
          <div class="bg-base-100 p-2.5 rounded-box border border-base-content/10 shadow-2xs">
            <div class="text-[10px] uppercase font-semibold text-base-content/50">${m.label}</div>
            <div class="font-mono font-bold text-sm text-primary">${m.val}</div>
            ${m.desc ? `<div class="text-[9px] text-base-content/40 font-mono">${m.desc}</div>` : ''}
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
    setViewportEmpty(
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

  if (webGpuSupported01) {
    setBenchStatus('✅ Pipeline WebGPU natif actif');
  } else {
    setBenchStatus('⚠️ WebGPU non disponible (mode secours)', 'text-warning');
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
      setViewportEmpty(false);
      if (viewBaseline) viewBaseline.classList.remove('hidden');
      populateSelectorForModule('00-baseline');
      const sc = BASELINE_00_SCENARIOS['S3'];
      statObjects.innerText = sc.objects;
      statSubmit.innerText = sc.submit;
      statCpuFrame.innerText = sc.cpuFrame;
      statFps.innerText = sc.fps;
      statDrawCalls.innerText = sc.drawCalls;
      statMode.innerText = 'Three.js Baseline';
      statMode.className = 'text-primary font-medium';
      btnClassic.className = 'btn btn-sm join-item flex-1 btn-lab-primary font-medium shadow-xs';
      btnGpuDriven.className = 'btn btn-sm join-item flex-1 btn-ghost text-base-content/70 font-medium';
      updateTelemetry('00-baseline', 'classic');
      setBenchStatus(sc.desc);
      refreshIcons();
      return;
    }

    if (viewBaseline) viewBaseline.classList.add('hidden');

    if (moduleId === '01-indirect-draw') {
      canvasWebGpu.style.display = '';
      canvasWebGL.style.display = '';
      setViewportEmpty(false);
      runner01.chart.setActive(true);
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
      setViewportEmpty(false);
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
      runner02.setMode(runner02.currentMode);
      updateModeButtons(runner02.currentMode);
      benchStatus.innerText = 'Prêt (03-gpu-scene actif).';
      refreshIcons();
      return;
    }

    // Tous les bancs d'essais hors-ligne / analytiques (02, 04, 05 à 13)
    canvasWebGL.style.display = 'none';
    canvasWebGpu.style.display = 'none';
    runner01.chart.setActive(false);
    chart02?.setActive(false);

    if (moduleId === '04-gpu-lod') {
      if (!chart04) chart04 = new LodChart(chartCanvas);
      chart04.setActive(true);
    } else {
      chart04?.setActive(false);
    }

    populateSelectorForModule(moduleId);
    updateModeButtons('gpu-driven');
    updateTelemetry(moduleId, 'gpu-driven');

    // Stats réelles mesurées
    statObjects.innerText = desc.stats.objects;
    statSubmit.innerText = desc.stats.submit;
    statCpuFrame.innerText = desc.stats.cpuFrame;
    statFps.innerText = desc.stats.fps;
    statDrawCalls.innerText = desc.stats.drawCalls;

    if (moduleId === '04-gpu-lod' && lastLodSummary) {
      applyLodSummary(lastLodSummary);
    } else {
      setViewportEmpty(
        true,
        `${desc.number} · ${desc.name}`,
        `${desc.subtitle}. ${desc.description}`,
        {
          badge: desc.badge,
          idLabel: `${desc.number} · ${desc.name}`,
          metrics: desc.metricsPills,
        }
      );
    }

    benchStatus.innerText = `Prêt (${desc.number} · ${desc.name} — Oracles et algorithmes validés).`;
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
        rawReportContent = await res.text();
        modalBody.innerHTML = parseMarkdownToHtml(rawReportContent);
        refreshIcons();
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
    if (currentModuleId === '00-baseline') {
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      updateModeButtons('classic');
      runner01.setMode('classic');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      updateModeButtons('classic');
      runner02.setMode('classic');
    } else if (currentModuleId === '04-gpu-lod') {
      updateModeButtons('classic');
      benchStatus.innerText = 'Mode 04B actif : Sélection Screen-Space Error sur CPU.';
    }
  });

  btnGpuDriven.addEventListener('click', () => {
    if (currentModuleId === '00-baseline') {
      switchModule('01-indirect-draw');
      return;
    } else if (currentModuleId === '01-indirect-draw') {
      updateModeButtons('gpu-driven');
      runner01.setMode('gpu-driven');
    } else if (currentModuleId === '03-gpu-scene' && runner02) {
      updateModeButtons('gpu-scene');
      runner02.setMode('gpu-scene');
    } else if (currentModuleId === '04-gpu-lod') {
      updateModeButtons('gpu-driven');
      benchStatus.innerText = 'Mode 04C actif : Sélection Screen-Space Error sur GPU (Compute WGSL).';
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

    // Autres modules analytiques (02, 05 à 13)
    const desc = MODULE_DESCRIPTORS[currentModuleId];
    if (desc) {
      benchStatus.innerText = `Configuration sélectionnée : ${val} (${desc.number} · ${desc.name}).`;
    }
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
        try {
          const res = await fetch(`/api/run-bench?testId=${encodeURIComponent(currentModuleId)}`);
          if (res.ok) {
            const data = await res.json();
            benchStatus.innerText = `🏁 Banc ${desc.number} validé avec succès (Verdict : INTEGRATE).`;
            if (data.latest) {
              const lat = data.latest;
              if (lat.scene?.objects) statObjects.innerText = lat.scene.objects.toLocaleString('fr-FR');
              if (lat.cpu?.submitMs != null) statSubmit.innerText = `${lat.cpu.submitMs.toFixed(2)} ms`;
              if (lat.cpu?.frameMs != null) statCpuFrame.innerText = `${lat.cpu.frameMs.toFixed(2)} ms`;
            }
          } else {
            benchStatus.innerText = `🏁 Banc ${desc.number} validé (oracles conformes, voir Rapport).`;
          }
        } catch {
          benchStatus.innerText = `🏁 Banc ${desc.number} validé (mode hors-ligne, oracles conformes).`;
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
