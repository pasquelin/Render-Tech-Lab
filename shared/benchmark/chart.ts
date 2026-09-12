/**
 * shared/benchmark/chart.ts
 *
 * Traceur minimal : représente graphiquement une courbe de charge
 * (paliers en abscisse, métrique en ordonnée) à partir de résultats mesurés.
 *
 * Règle absolue : seuls les points avec `status === "measured"` sont tracés.
 * Les paliers `not-run` sont marqués mais ne donnent aucun point de courbe
 * (aucune valeur n'est inventée pour combler un trou).
 */

import type { BenchResultRecord } from './types.ts';

export interface ChartPoint {
  label: string;
  value: number | null;
}

/**
 * Extrait les points mesurés d'une métrique donnée (fn de sélection sur le record).
 * @param records Résultats du banc.
 * @param labelOf Retourne l'étiquette du palier (typiquement `scene.objects`).
 * @param valueOf Retourne la valeur mesurée ou `null` si non mesurée.
 */
export function extractSeries(
  records: BenchResultRecord[],
  labelOf: (r: BenchResultRecord) => string | number,
  valueOf: (r: BenchResultRecord) => number | null | undefined
): ChartPoint[] {
  return records.map((r) => ({
    label: String(labelOf(r)),
    value: r.status === 'measured' && typeof valueOf(r) === 'number' && Number.isFinite(valueOf(r) as number)
      ? (valueOf(r) as number)
      : null,
  }));
}


