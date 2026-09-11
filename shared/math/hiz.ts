/**
 * shared/math/hiz.ts
 *
 * Réduction conservatrice de tampon de profondeur Hi-Z (Depth Pyramid).
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

/**
 * Réduit une grille de profondeur d'un facteur 2x2.
 * Pour la profondeur standard (0=proche, 1=lointain), utilise Math.max (conservateur).
 * Pour le Z-inversé (1=proche, 0=lointain), utilise Math.min (conservateur).
 * Gère correctement les résolutions impaires en conservant la dernière colonne/ligne.
 */
export function hizReduceCeil(depth: number[][], reversedZ: boolean = false): number[][] {
  const height = depth.length;
  const width = height > 0 ? depth[0].length : 0;

  if (width === 0 || depth.some((row) => row.length !== width)) {
    throw new Error('Image vide ou non rectangulaire');
  }

  const result: number[][] = [];

  for (let startRow = 0; startRow < height; startRow += 2) {
    const row: number[] = [];
    for (let startCol = 0; startCol < width; startCol += 2) {
      let value = reversedZ ? Infinity : -Infinity;
      for (let r = startRow; r < Math.min(startRow + 2, height); r++) {
        for (let c = startCol; c < Math.min(startCol + 2, width); c++) {
          value = reversedZ ? Math.min(value, depth[r][c]) : Math.max(value, depth[r][c]);
        }
      }
      row.push(value);
    }
    result.push(row);
  }

  return result;
}

/** Ceil-sized levels, matching hizReduceCeil (not native NPOT texture mip sizes). */
export function hizReduceInto(src: Float32Array, width: number, height: number,
  dst: Float32Array, reversedZ = false): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || src.length < width * height || dst.length < Math.ceil(width / 2) * Math.ceil(height / 2)) {
    throw new Error('Dimensions ou capacité Hi-Z invalides');
  }
  if (src.buffer === dst.buffer && src.byteOffset < dst.byteOffset + dst.byteLength
    && dst.byteOffset < src.byteOffset + src.byteLength) throw new Error('Buffers Hi-Z superposés');
  const dw = Math.ceil(width / 2), dh = Math.ceil(height / 2);
  for (let y = 0; y < dh; y++) {
    const a = 2 * y * width, b = Math.min(2 * y + 1, height - 1) * width;
    for (let x = 0; x < dw; x++) {
      const c = x * 2, d = Math.min(c + 1, width - 1);
      dst[y * dw + x] = reversedZ
        ? Math.min(src[a + c], src[a + d], src[b + c], src[b + d])
        : Math.max(src[a + c], src[a + d], src[b + c], src[b + d]);
    }
  }
}
