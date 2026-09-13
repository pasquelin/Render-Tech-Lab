import { MODULE_DESCRIPTORS } from './modules.ts';

export type ModuleUi = {
  category: string;
  status: string;
  hasModeChoice: boolean;
  algorithmic: boolean;
  animatedScene: boolean;
  holdSurfaces: boolean;
  canStop: boolean;
  showChart: boolean;
  sceneChoice: boolean;
  countLabel: string;
  protocol: string;
  backend: string;
  modeHint: string;
  idleNote?: string;
  previewHint?: string;
  comparisonHref?: string;
  comparisonLabel?: string;
  diagnostics?: { value: string; label: string; disabled?: boolean }[];
  modeOptions: { id: string; value: string; label: string }[];
};

const MODE_AB = [
  { id: 'btn-classic', value: 'classic', label: 'Test A (Three.js)' },
  { id: 'btn-gpu-driven', value: 'gpu-driven', label: 'Test B (GPU-Driven)' },
];

const DEFAULT_UI: ModuleUi = {
  category: 'Banc',
  status: 'Préparation',
  hasModeChoice: false,
  algorithmic: false,
  animatedScene: false,
  holdSurfaces: false,
  canStop: false,
  showChart: true,
  sceneChoice: false,
  countLabel: 'Charge de géométrie :',
  protocol: 'Variantes et protocole : consulter le rapport du banc.',
  backend: 'Scène du banc · voir description',
  modeHint: 'Ce banc exécute son protocole unique avec la charge sélectionnée.',
  modeOptions: MODE_AB,
};

const MODULE_UI: Record<string, Partial<ModuleUi>> = {
  '00-baseline': { category: 'Référence', status: 'Consultation', showChart: false, protocol: 'Consultation : aucune campagne lancée depuis cette page.' },
  '01-indirect-draw': {
    category: 'Rendu indirect', status: 'Mesurable', hasModeChoice: true,
    protocol: 'A : Three.js WebGL · B : rendu indirect WebGPU natif',
    backend: 'WebGPU natif · rendu indirect',
    modeHint: 'Choisissez la variante mesurée par ce banc.',
  },
  '02-gpu-frustum-culling': { category: 'Visibilité GPU', status: 'Mesurable', algorithmic: true, animatedScene: true, backend: 'WebGPU · culling frustum' },
  '03-gpu-scene': {
    category: 'Scène GPU', status: 'Mesurable', hasModeChoice: true,
    protocol: 'A : multi-maillages Three.js · B : scène hétérogène WebGPU',
    backend: 'WebGPU · scène hétérogène',
    modeHint: 'Choisissez la variante mesurée par ce banc.',
  },
  '04-gpu-lod': {
    category: 'Niveaux de détail', status: 'Mesurable', hasModeChoice: true, holdSurfaces: true, canStop: true,
    protocol: 'A : sélection CPU de référence · B : sélection WGSL · même raster WebGPU',
    backend: 'WebGPU natif · calcul CPU / WGSL',
    modeHint: 'Choisissez la variante mesurée par ce banc.',
    previewHint: 'Aperçu uniquement — la comparaison complète se lance avec le bouton ci-dessous.',
    comparisonHref: '/04-gpu-lod/comparison.html',
    comparisonLabel: 'Comparer les calculs sur une scène détaillée',
  },
  '05-meshlets': { category: 'Géométrie', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '06-meshlet-culling': { category: 'Visibilité', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '07-hiz': { category: 'Profondeur', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '08-occlusion-culling': { category: 'Occlusion', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '09-gpu-compaction': {
    category: 'Compaction', status: 'Préparation GPU', algorithmic: true, backend: 'WebGPU · compaction',
    idleNote: 'Ce banc exécute trois stratégies de calcul WebGPU sans scène 3D. Le centre affichera leur progression, la charge réellement traitée et les résultats partiels mesurés.',
  },
  '10-material-batching': { category: 'Matériaux', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '11-geometry-streaming': { category: 'Streaming', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '12-visibility-buffer': { category: 'Visibilité', status: 'Contrôle CPU', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '13-full-gpu-driven': { category: 'Architecture', status: 'Préparation', algorithmic: true, backend: 'Contrôle algorithmique CPU' },
  '14-open-world': {
    category: 'Monde ouvert', status: 'Mesurable', hasModeChoice: true, holdSurfaces: true, canStop: true, showChart: false,
    countLabel: 'Étendue du décor :',
    protocol: 'A : référence Three.js · B : variante sélectionnée dans les réglages, même backend WebGL2',
    backend: 'Three.js WebGL2 résident',
    modeHint: 'Choisissez la variante mesurée par ce banc.',
  },
  '15-virtualized-integration': {
    category: 'Géométrie virtualisée', status: 'Intégration', algorithmic: true, sceneChoice: true,
    countLabel: 'Scène :',
    protocol: 'Fixture procédurale : trois contrôles A/B. Les modèles préparés sont une exploration séparée.',
    backend: 'WebGPU · clusters et pages',
    idleNote: 'La fixture vérifie le rendu et les mécanismes de sélection sur trois scènes contrôlées. Ses résultats ne constituent pas une mesure de performance de la ville réelle.',
    diagnostics: [
      { value: 'beauty', label: 'Rendu final' },
      { value: 'wireframe', label: 'Triangles soumis', disabled: true },
      { value: 'clusters', label: 'Clusters', disabled: true },
      { value: 'lod', label: 'Niveau de détail', disabled: true },
      { value: 'error', label: 'Erreur écran', disabled: true },
      { value: 'culling', label: 'Visibilité / culling', disabled: true },
      { value: 'pages', label: 'Pages / streaming', disabled: true },
      { value: 'mips', label: 'Textures / mips', disabled: true },
    ],
  },
};

export function moduleUi(id: string): ModuleUi {
  const desc = MODULE_DESCRIPTORS[id];
  const extra = MODULE_UI[id] ?? {};
  return {
    ...DEFAULT_UI,
    countLabel: desc && id === '15-virtualized-integration' ? 'Scène :' : DEFAULT_UI.countLabel,
    ...extra,
  };
}

export function moduleAccess(id: string): { category: string; status: string } {
  const ui = moduleUi(id);
  return { category: ui.category, status: ui.status };
}
