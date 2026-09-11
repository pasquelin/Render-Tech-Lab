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
  const result: T[] = [];
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (flag === 1 || flag === true) result.push(values[index]);
    else if (flag !== 0 && flag !== false) throw new Error('Prédicats invalides : les flags doivent valoir 0 ou 1');
  }

  return result;
}

export function exclusiveScanInto(flags: Uint32Array, offsets: Uint32Array): number {
  if (offsets.length < flags.length) throw new Error('Capacité scan insuffisante');
  if (offsets.buffer === flags.buffer && offsets.byteOffset !== flags.byteOffset
    && offsets.byteOffset < flags.byteOffset + flags.byteLength
    && flags.byteOffset < offsets.byteOffset + offsets.byteLength) throw new Error('Alias de scan invalide');
  let total = 0;
  for (let i = 0; i < flags.length; i++) {
    const value = flags[i];
    if (value > 1) throw new Error('Flag non binaire');
    offsets[i] = total;
    total += value;
  }
  return total;
}

export function compactIdsInto(ids: Uint32Array, flags: Uint32Array, out: Uint32Array): number {
  if (ids.length !== flags.length || out.length < ids.length) throw new Error('Capacité compaction invalide');
  // In-place ids -> out is safe only at the same start or into a disjoint range.
  if (out.buffer === flags.buffer || (out.buffer === ids.buffer && out.byteOffset !== ids.byteOffset
    && out.byteOffset < ids.byteOffset + ids.byteLength && ids.byteOffset < out.byteOffset + out.byteLength)) {
    throw new Error('Alias de compaction invalide');
  }
  let count = 0;
  for (let i = 0; i < ids.length; i++) {
    if (flags[i] > 1) throw new Error('Flag non binaire');
    if (flags[i] === 1) out[count++] = ids[i];
  }
  return count;
}
