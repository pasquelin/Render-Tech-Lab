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

  const reducer = reversedZ
    ? (vals: number[]) => Math.min(...vals)
    : (vals: number[]) => Math.max(...vals);

  const result: number[][] = [];

  for (let startRow = 0; startRow < height; startRow += 2) {
    const row: number[] = [];
    for (let startCol = 0; startCol < width; startCol += 2) {
      const footprint: number[] = [];
      for (let r = startRow; r < Math.min(startRow + 2, height); r++) {
        for (let c = startCol; c < Math.min(startCol + 2, width); c++) {
          footprint.push(depth[r][c]);
        }
      }
      row.push(reducer(footprint));
    }
    result.push(row);
  }

  return result;
}
