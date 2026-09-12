import { MODULE_DESCRIPTORS } from './modules.ts';

export const MODULE_NAV = [
  { id: '00-baseline', label: 'Dashboard' },
  { id: '01-indirect-draw', label: '01 · GPU-Driven Indirect Draw' },
  { id: '02-gpu-frustum-culling', label: '02 · GPU Frustum Culling' },
  { id: '03-gpu-scene', label: '03 · GPU Scene & Scène Hétérogène' },
  { id: '04-gpu-lod', label: '04 · GPU LOD & Screen-Space Error' },
  { id: '05-meshlets', label: '05 · Meshlets & Cluster Partitioning' },
  { id: '06-meshlet-culling', label: '06 · Meshlet Culling & Taux de Rejet' },
  { id: '07-hiz', label: '07 · Hi-Z Occlusion Pyramid' },
  { id: '08-occlusion-culling', label: '08 · Occlusion Culling & Gain Net' },
  { id: '09-gpu-compaction', label: '09 · GPU Compaction & Contention' },
  { id: '10-material-batching', label: '10 · Material Batching & Dynamic Indexing' },
  { id: '11-geometry-streaming', label: '11 · Geometry Streaming & Résidence VRAM' },
  { id: '12-visibility-buffer', label: '12 · Visibility Buffer & Shading Différé' },
  { id: '13-full-gpu-driven', label: '13 · Full GPU-Driven Architecture' },
  { id: '14-open-world', label: '14 · Monde ouvert sous pression' },
  { id: '15-virtualized-integration', label: '15 · Pipeline de géométrie virtualisée' },
] as const;

export const HINT_BASE = 'text-[10px] text-center font-mono truncate';

export const LIVE_MODULES = new Set(['01-indirect-draw', '03-gpu-scene']);

export function moduleTitle(id: string): string {
  if (id === '00-baseline') return 'Dashboard';
  const desc = MODULE_DESCRIPTORS[id];
  if (desc) return `${desc.number} · ${desc.name}`;
  return id;
}
