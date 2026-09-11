/**
 * shared/benchmark/types.ts
 *
 * Contrat de résultat canonique du laboratoire (Master Test Plan §5).
 *
 * Règle absolue : une métrique non mesurée vaut `null` (JAMAIS `0`).
 * Un banc qui n'a pas été effectivement exécuté porte `status: "not-run"`.
 * Aucun chiffre n'est pré-repli : les champs restent `null` tant qu'aucun
 * échantillon réel n'a été recueilli.
 */

export type BenchStatus = 'not-run' | 'measured';

export type Verdict = 'INTEGRATE' | 'REJECT' | 'WATCHLIST' | 'not-yet-decided';

export interface BenchEnvironment {
  gpu?: string | null;
  browser?: string | null;
  threeVersion?: string | null;
  webgpuFeatures?: string[] | null;
}

export interface BenchScene {
  objects?: number | null;
  triangles?: number | null;
  materials?: number | null;
  lights?: number | null;
}

export interface BenchCpu {
  frameMs?: number | null;
  submitMs?: number | null;
  p95Ms?: number | null;
  p99Ms?: number | null;
  fps?: number | null;
}

export interface BenchGpu {
  frameMs?: number | null;
}

export interface BenchMemory {
  gpuBytes?: number | null;
}

export interface BenchDraw {
  submitted?: number | null;
  visible?: number | null;
}

/**
 * Résultat d'un banc, conforme au schéma `latest.json` du Master Test Plan.
 * Les métriques optionnelles sont `null` quand non mesurées (règle : ne jamais `0`).
 */
export interface BenchResultRecord {
  timestamp: string;
  test: string;
  commit: string | null;
  status: BenchStatus;
  verdict?: Verdict;
  environment: BenchEnvironment;
  scene: BenchScene;
  cpu: BenchCpu;
  gpu: BenchGpu;
  memory: BenchMemory;
  draw: BenchDraw;
  /** Métriques spécifiques au banc (taux de rejet, niveaux LOD, coûts Hi-Z…). */
  customMetrics?: Record<string, unknown>;
}

export interface BenchTier {
  /** Étiquette lisible du palier de charge (ex : « 1k », « 90% occlusion »). */
  label: string;
  /** Charge effective du palier (ex : nombre d'objets, % d'occlusion). */
  value: number;
}
