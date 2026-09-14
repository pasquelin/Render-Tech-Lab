/** La maison est générée par assets/house.mjs et compilée par assets/prepareHouse.ts (cache local,
 * assets/cache/). La nuit à Emerald réutilise le cache déjà compilé du Lab principal, en lecture
 * seule (public/benchmark-assets/emerald-square-derived) ; le banc ne le régénère jamais. */
export const fixtureSources = [
  '16-lighting-transport:assets/house.mjs',
  '16-lighting-transport:assets/prepareHouse.ts',
  'render-tech-lab:public/benchmark-assets/emerald-square-derived (lecture seule)',
] as const;
