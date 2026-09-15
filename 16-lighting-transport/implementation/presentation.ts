import type { ModuleDescriptor } from '../../shared/contracts/presentation.ts';

export const LIGHTING_MODULE: ModuleDescriptor = {
  id: '16-lighting-transport', number: '16', name: 'Lumière',
  subtitle: 'Banc de test du moteur : deux scènes, lampes et animations en boucle',
  badge: 'Expérimental',
  telemetryMode: 'Moteur choisi au lancement · API publiques prepare() / createExplorer()',
  telemetryDetail: 'Soleil, lampes, ombres et transformations de nœuds détectés à l’exécution',
  description: 'Deux scènes animées en boucle — une maison de test et une scène urbaine nocturne — pour éprouver les lampes réglables, les ombres et les transformations de nœuds du moteur. Les commandes non encore exposées par le moteur restent visibles mais inactives.',
  technicalPrinciple: 'Le banc appelle prepare() et createExplorer() sans implémenter de rendu ni d’éclairage ; il détecte addLight/setLight/removeLight/setLightingView/setTransform avant de les utiliser. Le moteur et le déplacement se choisissent comme au banc 15.',
  options: [{ val: 'house', label: 'Maison de test', selected: true }, { val: 'emerald-night', label: 'Scène urbaine de nuit', selected: false }],
  benchLabel: 'Ouvrir la scène',
  metricsPills: [],
  stats: { objects: 'Deux scènes', submit: 'Non mesuré', cpuFrame: 'Non mesuré', fps: 'Non mesuré', drawCalls: 'Non mesuré' },
};

export const LIGHTING_UI = {
  category: 'Lumière', status: 'Expérimental', canStop: true, showChart: false,
  countLabel: 'Scène :',
  protocol: 'Déplacement, moteur, lampes réglables et curseur de lampes automatiques se choisissent dans la colonne droite ; les animations tournent en boucle avec pause et vitesse.',
  backend: 'Explorer public du SDK · moteur choisi au lancement',
  modeHint: 'Choisissez la scène intérieure ou la scène urbaine de nuit.',
  modeOptions: [],
  idleNote: 'La scène se charge au lancement avec le moteur et le déplacement choisis. Une commande grisée signale une API que le moteur n’expose pas encore sur cette version du SDK.',
};
