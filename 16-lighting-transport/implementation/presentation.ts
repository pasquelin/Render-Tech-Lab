import type { ModuleDescriptor } from '../../shared/contracts/presentation.ts';

export const LIGHTING_MODULE: ModuleDescriptor = {
  id: '16-lighting-transport', number: '16', name: 'Lumière',
  subtitle: 'Banc de test du moteur : deux scènes, lampes et animations en boucle',
  badge: 'Expérimental',
  telemetryMode: 'WebGL2 · API publiques prepare() / createExplorer()',
  telemetryDetail: 'Lampes, ombres et transformations de nœuds détectées à l’exécution',
  description: 'Deux scènes animées en boucle — une maison de test et une scène urbaine nocturne — pour éprouver les lampes réglables, les ombres et les transformations de nœuds du moteur. Les commandes non encore exposées par le moteur restent visibles mais inactives.',
  technicalPrinciple: 'Le banc appelle prepare() et createExplorer() sans implémenter de rendu ni d’éclairage ; il détecte addLight/setLight/removeLight/setEnvironment/setTransform avant de les utiliser.',
  options: [{ val: 'house', label: 'Maison de test', selected: true }, { val: 'emerald-night', label: 'Scène urbaine de nuit', selected: false }],
  benchLabel: 'Ouvrir la scène',
  metricsPills: [],
  stats: { objects: 'Deux scènes', submit: 'Non mesuré', cpuFrame: 'Non mesuré', fps: 'Non mesuré', drawCalls: 'Non mesuré' },
};

export const LIGHTING_UI = {
  category: 'Lumière', status: 'Expérimental', canStop: true, showChart: false,
  countLabel: 'Scène :',
  protocol: 'Caméra à la première personne, lampes réglables et curseur de lampes automatiques ; les animations tournent en boucle avec pause et vitesse.',
  backend: 'WebGL2 · Explorer public du SDK',
  modeHint: 'Choisissez la scène intérieure ou la scène urbaine de nuit.',
  modeOptions: [],
  idleNote: 'La scène se charge au lancement. Une commande grisée signale une API que le moteur n’expose pas encore sur cette version du SDK.',
};
