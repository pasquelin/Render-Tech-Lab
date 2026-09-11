/**
 * shared/math/compaction.ts
 *
 * Algorithmes de scan exclusif (prefix sum) et compaction de liste.
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

/**
 * Préfixe exclusif (exclusive scan) :
 * result[i] = somme(values[0..i-1]), avec total = somme(values).
 */
export function exclusiveScan(values: number[]): [number[], number] {
  const result: number[] = [];
  let total = 0;
  for (const value of values) {
    result.push(total);
    total += value;
  }
  return [result, total];
}

/**
 * Compacte un tableau de valeurs en ne conservant que les éléments
 * dont le flag associé vaut 1 ou true.
 * L'ordre relatif est préservé sans trous.
 */
export function compact<T>(values: T[], flags: (number | boolean)[]): T[] {
  if (values.length !== flags.length) {
    throw new Error('Prédicats invalides : longueurs divergentes');
  }
  const numericFlags = flags.map((f) => (f === true || f === 1 ? 1 : f === false || f === 0 ? 0 : -1));
  if (numericFlags.some((f) => f !== 0 && f !== 1)) {
    throw new Error('Prédicats invalides : les flags doivent valoir 0 ou 1');
  }

  const [offsets, total] = exclusiveScan(numericFlags);
  const result: T[] = new Array(total);

  for (let index = 0; index < flags.length; index++) {
    if (numericFlags[index] === 1) {
      result[offsets[index]] = values[index];
    }
  }

  return result;
}
