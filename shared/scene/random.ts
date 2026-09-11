/**
 * shared/scene/random.ts
 *
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Règle de gouvernance : toute distribution spatiale de bancs (baseline CPU,
 * culling GPU, LOD, meshlets, Hi-Z, occlusion, compaction) DOIT pouvoir être
 * reproduite bit-à-bit à partir d'une graine explicite. Ce générateur est pure,
 * sans dépendance DOM/GPU, et testable en Node.
 */

/**
 * Crée un générateur pseudo-aléatoire déterministe à partir d'une graine entière.
 *
 * @param seed Graine entière (32 bits). La même graine produit la même séquence.
 * @returns Fonction `() => number` renvoyant un flottant dans [0, 1[.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Renvoie un flottant déterministe dans [min, max[ à partir d'une graine et d'un index.
 * Permet de générer la iᵉme valeur d'une séquence sans re-jouer la séquence entière.
 */
export function seededValue(min: number, max: number, seed: number, index: number): number {
  const rng = createSeededRandom(seed + index * 0x9e3779b9);
  return min + (max - min) * rng();
}
