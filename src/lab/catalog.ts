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

export const BASELINE_CARDS = [
  { id: '00-baseline', title: '00 · Baseline', badge: 'Témoin', badgeClass: 'badge-neutral', blurb: 'Référence Three.js : six configurations de charge internes. Les scènes sont déterministes ; les timings GPU se lisent dans le rapport de campagne, pas ici.', metric: 'Timings : reports/00-baseline.md', action: 'validated' as const },
  { id: '01-indirect-draw', title: '01 · Indirect Draw', badge: 'À remesurer', badgeClass: 'badge-warning', blurb: 'Rendu indirect WebGPU avec culling actif. Comparaison WebGL / WebGPU dans le banc, sans verdict automatique.', metric: 'Mesures dans reports/01-indirect-draw.md', action: 'launch' as const },
  { id: '02-gpu-frustum-culling', title: '02 · Frustum Culling', badge: 'À remesurer', badgeClass: 'badge-warning', blurb: 'Compute WGSL plan/sphère + compaction. Prototype présent ; campagne GPU à relire.', metric: 'Pas de chiffre affiché hors rapport', action: 'launch' as const },
  { id: '03-gpu-scene', title: '03 · GPU Scene', badge: 'À remesurer', badgeClass: 'badge-warning', blurb: 'Scène hétérogène, mega-buffers, charge 4D. Banc branché dans le laboratoire.', metric: 'Mesures dans reports/03-gpu-scene.md', action: 'launch' as const },
  { id: '04-gpu-lod', title: '04 · GPU LOD', badge: 'Campagnes', badgeClass: 'badge-warning', blurb: 'Décimation meshoptimizer et sélection SSE. Comparaison native CPU/GPU dans le laboratoire.', metric: 'Mesures dans reports/04-gpu-lod-comparison.md', action: 'launch' as const },
  { id: '05-meshlets', title: '05 · Meshlets', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Partitionnement en clusters. Suite CPU uniquement ; aucun timing GPU revendiqué.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '06-meshlet-culling', title: '06 · Meshlet Culling', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Frustum / backface / sous-pixel par cluster. Suite CPU ; pas de campagne GPU.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '07-hiz', title: '07 · Hi-Z Pyramid', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Réduction de profondeur. Suite CPU ; génération GPU non mesurée ici.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '08-occlusion-culling', title: '08 · Occlusion', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Test AABB vs Hi-Z. Oracle CPU ; pas de gain net affiché.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '09-gpu-compaction', title: '09 · Compaction', badge: 'À remesurer', badgeClass: 'badge-warning', blurb: 'Prefix-sum / atomics. Banc physique via /bench/ ; pas de chiffre inventé dans cette carte.', metric: 'Mesures : banc navigateur 09', action: 'launch' as const },
  { id: '10-material-batching', title: '10 · Material Batching', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Indexation de matériaux. Oracles CPU ; soumission GPU non chronométrée ici.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '11-geometry-streaming', title: '11 · Streaming VRAM', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'Résidence LRU. Suites CPU ; pas de budget VRAM mesuré GPU.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '12-visibility-buffer', title: '12 · Visibility Buffer', badge: 'Oracle CPU', badgeClass: 'badge-neutral', blurb: 'IDs de visibilité et reconstruction. Oracle CPU uniquement.', metric: 'status: not-run GPU', action: 'launch' as const },
  { id: '13-full-gpu-driven', title: '13 · Full GPU-Driven', badge: 'Bloqué', badgeClass: 'badge-neutral', blurb: 'Assemblage des étages. Reste blocked tant que les dépendances ne sont pas mesurées.', metric: 'status: blocked', action: 'launch' as const },
  { id: '15-virtualized-integration', title: '15 · Géométrie virtualisée', badge: 'Intégration', badgeClass: 'badge-neutral', blurb: 'Fixture procédurale validée : clusters hiérarchiques, sélection WebGPU, dessin indirect et cache de pages. Emerald Square est prêt pour l’étape suivante.', metric: 'Intégration du moteur en cours', action: 'launch' as const },
] as const;

export const STATUS_BASE =
  'alert alert-neutral bg-base-100 border border-base-content/15 py-2 px-3 text-[11px] font-mono leading-tight whitespace-nowrap truncate';
export const HINT_BASE = 'text-[10px] text-center font-mono truncate';

export const LIVE_MODULES = new Set(['01-indirect-draw', '03-gpu-scene']);

export function moduleTitle(id: string): string {
  if (id === '00-baseline') return 'Dashboard';
  const desc = MODULE_DESCRIPTORS[id];
  if (desc) return `${desc.number} · ${desc.name}`;
  if (id === '14-open-world') return '14 · Monde ouvert';
  return id;
}
