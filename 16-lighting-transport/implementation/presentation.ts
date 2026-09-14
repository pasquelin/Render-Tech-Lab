import type { ModuleDescriptor } from '../../shared/contracts/presentation.ts';

export const LIGHTING_MODULE: ModuleDescriptor = {
  id: '16-lighting-transport', number: '16', name: 'Lumière',
  subtitle: 'Éclairer trois sources mobiles sans changer leur rendu',
  badge: 'Expérimental',
  telemetryMode: 'WebGL2 · éclairage expérimental du SDK',
  telemetryDetail: 'Transport diffus CPU · ombres et reflets GPU',
  description: 'Deux pièces, trois sources colorées, une porte et des reflets. Le banc compare deux parcours des obstacles avec la même scène et vérifie les images avant de mesurer.',
  technicalPrinciple: 'Parcours exhaustif ou hiérarchie spatiale des obstacles ; mêmes intersections, lumière et échantillonnage.',
  options: [{ val: 'two-rooms', label: 'Deux pièces · trois sources', selected: true }],
  benchLabel: 'Ouvrir la scène',
  metricsPills: [],
  stats: { objects: 'Trois sources', submit: 'Non mesuré', cpuFrame: 'Non mesuré', fps: 'Non mesuré', drawCalls: 'Non mesuré' },
};

export const LIGHTING_UI = {
  category: 'Lumière', status: 'Expérimental', canStop: true, showChart: false,
  countLabel: 'Scène :',
  protocol: 'Images A/A puis A/B exactes avant comparaison, à résolution et échantillonnage identiques.',
  backend: 'WebGL2 · backend expérimental du SDK',
  modeHint: 'Les variantes changent le parcours des obstacles.',
  modeOptions: [],
  idleNote: 'La scène se charge au lancement. Les mesures de ce prototype ne qualifient pas le rendu de production du moteur.',
};
