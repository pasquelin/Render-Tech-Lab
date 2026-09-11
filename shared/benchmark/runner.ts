/**
 * shared/benchmark/runner.ts
 *
 * Orchestrateur de paliers canonique du laboratoire.
 *
 * Rôle : exécuter une liste de paliers de charge, pour chaque palier appeler la
 * fonction de mesure fournie par le banc, assembler un `BenchResultRecord`, et
 * ne JAMAIS inventer de valeur.
 *
 * Règle absolue : si la fonction de mesure renvoie `null` (WebGPU absent,
 * non-initialisé, erreur interne), le palier est enregistré avec
 * `status: "not-run"` et des métriques `null`. Aucun chiffre de repli.
 */

import type {
  BenchEnvironment,
  BenchResultRecord,
  BenchTier,
} from './types.ts';

export interface SampledMetrics {
  cpuFrameMs?: number;
  submitMs?: number;
  p95Ms?: number;
  p99Ms?: number;
  fps?: number;
  gpuFrameMs?: number;
  gpuBytes?: number;
  drawSubmitted?: number;
  drawVisible?: number;
  sceneObjects?: number;
  sceneTriangles?: number;
  sceneMaterials?: number;
  sceneLights?: number;
  customMetrics?: Record<string, unknown>;
}

/**
 * Fonction de mesure d'un palier. Doit renvoyer `null` si la mesure n'est pas
 * possible (pas de device, non initialisé, échec), et ne JAMAIS de valeur fictive.
 */
export type MeasureFn = (tier: BenchTier, context: RunnerContext) => SampledMetrics | null | Promise<SampledMetrics | null>;

export interface RunnerContext {
  tier: BenchTier;
  /** Nombre d'échantillons demandés (chaque banc décide de son protocole). */
  requestedSamples: number;
}

export interface BenchRunnerConfig {
  /** Identifiant stable du banc (ex : « 05-meshlets »). */
  test: string;
  /** Commit courant (ou `null` si inconnu). */
  commit?: string | null;
  /** Environnement d'exécution (browser, gpu, threeVersion…). */
  environment?: BenchEnvironment;
  /** Échantillons par défaut demandés à chaque palier. */
  defaultSamples?: number;
}

export interface BenchRunner {
  runTiers: (tiers: BenchTier[], measure: MeasureFn) => Promise<BenchResultRecord[]>;
  toRecords: () => BenchResultRecord[];
  getTestId: () => string;
}

function baseTimestamp(): string {
  return new Date().toISOString();
}

/** Renvoie `null` si la valeur n'est ni un fini ni un nombre (règle pas de 0 inventé). */
function fin(x: number | null | undefined): number | null {
  if (x === null || x === undefined) return null;
  if (!Number.isFinite(x)) return null;
  return x;
}

export function createBenchRunner(config: BenchRunnerConfig): BenchRunner {
  const defaultSamples = config.defaultSamples ?? 40;
  const records: BenchResultRecord[] = [];

  async function runTiers(tiers: BenchTier[], measure: MeasureFn): Promise<BenchResultRecord[]> {
    const out: BenchResultRecord[] = [];

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const context: RunnerContext = { tier, requestedSamples: defaultSamples };

      let sample: SampledMetrics | null = null;
      let error: unknown = null;
      try {
        sample = await measure(tier, context);
      } catch (err) {
        error = err;
        sample = null;
      }

      if (!sample) {
        // Règle absolue : aucune valeur inventée, champ null, statut not-run.
        const record: BenchResultRecord = {
          timestamp: baseTimestamp(),
          test: config.test,
          commit: config.commit ?? null,
          status: 'not-run',
          verdict: 'not-yet-decided',
          environment: config.environment ?? {},
          scene: {
            objects: tier.value,
            triangles: null,
            materials: null,
            lights: null,
          },
          cpu: { frameMs: null, submitMs: null, p95Ms: null, p99Ms: null, fps: null },
          gpu: { frameMs: null },
          memory: { gpuBytes: null },
          draw: { submitted: null, visible: null },
          customMetrics: error ? { error: String(error) } : { reason: 'not-measured' },
        };
        out.push(record);
        continue;
      }

      const record: BenchResultRecord = {
        timestamp: baseTimestamp(),
        test: config.test,
        commit: config.commit ?? null,
        status: 'measured',
        verdict: 'not-yet-decided',
        environment: config.environment ?? {},
        scene: {
          objects: fin(sample.sceneObjects) ?? tier.value,
          triangles: fin(sample.sceneTriangles),
          materials: fin(sample.sceneMaterials),
          lights: fin(sample.sceneLights),
        },
        cpu: {
          frameMs: fin(sample.cpuFrameMs),
          submitMs: fin(sample.submitMs),
          p95Ms: fin(sample.p95Ms),
          p99Ms: fin(sample.p99Ms),
          fps: fin(sample.fps),
        },
        gpu: { frameMs: fin(sample.gpuFrameMs) },
        memory: { gpuBytes: fin(sample.gpuBytes) },
        draw: {
          submitted: fin(sample.drawSubmitted),
          visible: fin(sample.drawVisible),
        },
        customMetrics: sample.customMetrics ?? {},
      };
      out.push(record);
    }

    records.length = 0;
    records.push(...out);
    return out;
  }

  return {
    runTiers,
    toRecords: () => records.slice(),
    getTestId: () => config.test,
  };
}

/** Paliers de charge canoniques (N) référencés par le Master Test Plan. */
export const LOAD_TIERS: BenchTier[] = [
  { label: '1', value: 1 },
  { label: '10', value: 10 },
  { label: '100', value: 100 },
  { label: '1k', value: 1_000 },
  { label: '10k', value: 10_000 },
  { label: '100k', value: 100_000 },
  { label: '1M', value: 1_000_000 },
];
