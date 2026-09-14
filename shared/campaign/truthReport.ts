/**
 * Rapport de campagne du banc 15 — schéma unique partagé par l'interface et les scripts headless.
 *
 * Toutes les fonctions de ce module sont pures : elles ne lisent ni disque, ni réseau, ni horloge.
 * Ce qui n'est pas mesuré vaut `null`. Les distributions CPU et GPU restent séparées et ne sont
 * jamais additionnées.
 */

export const TRUTH_REPORT_SCHEMA = 'banc15-truth-campaign/v1';

/** Seuil d'image lente par défaut : une image de plus de 1/120 s n'a pas tenu la cible. */
export const DEFAULT_SLOW_FRAME_MS = 1000 / 120;

/** Les seuls plafonds d'affichage que le banc sait reconnaître. */
export const SUPPORTED_REFRESH_HZ: readonly number[] = [60, 120];

/** Tolérance relative d'accrochage à un plafond connu. */
const CEILING_TOLERANCE = 0.15;

/** Écart aller/retour au-delà duquel un bloc ABBA déclenche une alerte. */
export const ABBA_ALERT_PCT = 5;

export type MeasurementMode = 'summary' | 'trace';
export type EngineOrder = 'direct' | 'reverse';

export type FrameDistribution = {
  frames: number;
  /** 1000 / médiane. `null` quand la médiane est nulle : aucune fréquence n'en découle. */
  fps: number | null;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  slowFrameThresholdMs: number;
  slowFrames: number;
};

export type RefreshCeiling = {
  hz: number | null;
  fastestSustainedHz: number | null;
  supportedHz: readonly number[];
};

export type CanvasResolution = {
  devicePixelRatio: number | null;
  cssWidth: number | null;
  cssHeight: number | null;
  deviceWidth: number | null;
  deviceHeight: number | null;
};

export type SdkProvenance = {
  /** `git rev-parse HEAD` du checkout dont vient `dist/`. */
  commit: string | null;
  /** `git status --porcelain` non vide. */
  dirty: boolean | null;
  checkout: string | null;
  distPath: string | null;
  /** Hash de contenu déjà produit par `buildProvenance` du SDK. */
  contentHash: string | null;
  generatedAt: string | null;
};

export type MachineLoad = {
  at: string | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  /** Relevé thermique brut si le système l'expose, sinon `null`. */
  thermal: string | null;
  chromeProcesses: number | null;
  compilerProcesses: number | null;
  viteProcesses: number | null;
};

export type TruthShot = {
  scene: string;
  frame: number;
  pixelError: number;
  file: string;
  selectedTriangles: number | null;
  triangles: number | null;
  drawCalls: number | null;
  residentPages: number | null;
  /** Géométrie sélectionnée mais non dessinée : `triangles` doit égaler `selectedTriangles`. */
  holes: number | null;
};

export type TruthPass = {
  engine: string;
  order: EngineOrder;
  /** Rang du moteur dans la séquence réellement exécutée. */
  index: number;
  machineLoad: MachineLoad | null;
  raf: FrameDistribution | null;
  cpuFrameMs: FrameDistribution | null;
  cpuSubmitMs: FrameDistribution | null;
  /** Durée GPU par image : non instrumentée par le banc. */
  gpuMs: null;
  /** VRAM physique : non mesurée par le banc. */
  vramBytes: null;
  selectedTriangles: number | null;
  triangles: number | null;
  drawCalls: number | null;
  residentPages: number | null;
  /** Captures de fidélité de la passe, `null` quand la passe ne capture pas. */
  shots: TruthShot[] | null;
  error: string | null;
};

export type TruthAggregate = {
  engine: string;
  /** Médiane des deux sens. Pour deux passes, la médiane est leur moyenne. */
  fps: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  slowFrames: number | null;
  directFps: number | null;
  reverseFps: number | null;
  /** Écart relatif aller/retour, en pourcentage de la médiane. */
  deltaPct: number | null;
  alert: boolean;
};

export type TruthReport = {
  schema: typeof TRUTH_REPORT_SCHEMA;
  source: 'ui' | 'headless';
  /** Nom de campagne : dossier d'archive, choisi par l'opérateur. */
  campaign: string;
  id: string;
  timestamp: string;
  scene: string;
  engines: string[];
  engineOrder: EngineOrder | 'abba';
  replicaCount: number | null;
  pixelError: number | null;
  measurementMode: MeasurementMode;
  resolution: CanvasResolution;
  refreshCeiling: RefreshCeiling;
  sdk: SdkProvenance;
  slowFrameThresholdMs: number;
  passes: TruthPass[];
  aggregates: TruthAggregate[];
  environment: string | null;
};

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function sorted(values: readonly number[]) {
  return values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
}

function percentile(ascending: readonly number[], fraction: number) {
  return ascending[Math.min(ascending.length - 1, Math.ceil(ascending.length * fraction) - 1)];
}

/** Médiane exacte : pour un nombre pair de valeurs, la moyenne des deux valeurs centrales. */
export function median(values: readonly number[]): number | null {
  const ascending = sorted(values);
  if (!ascending.length) return null;
  const middle = ascending.length / 2;
  return ascending.length % 2 ? ascending[Math.floor(middle)] : (ascending[middle - 1] + ascending[middle]) / 2;
}

/**
 * Métriques dérivées d'une série de durées par image.
 * FPS = 1000 / intervalle rAF médian. `slowFrames` compte les images au-dessus du seuil.
 */
export function frameDistribution(values: readonly number[], slowFrameThresholdMs = DEFAULT_SLOW_FRAME_MS): FrameDistribution | null {
  const ascending = sorted(values);
  if (!ascending.length) return null;
  const p50 = percentile(ascending, .5);
  return {
    frames: ascending.length,
    fps: p50 > 0 ? 1000 / p50 : null,
    p50,
    p95: percentile(ascending, .95),
    p99: percentile(ascending, .99),
    min: ascending[0],
    max: ascending[ascending.length - 1],
    slowFrameThresholdMs,
    slowFrames: ascending.filter(value => value > slowFrameThresholdMs).length,
  };
}

/**
 * Plafond réellement atteignable, déduit de l'intervalle soutenu le plus court (5e centile).
 * Sans accrochage à un plafond connu, `hz` vaut `null` : la fréquence mesurée reste publiée.
 */
export function refreshCeiling(values: readonly number[]): RefreshCeiling {
  const ascending = sorted(values).filter(value => value > 0);
  if (!ascending.length) return { hz: null, fastestSustainedHz: null, supportedHz: SUPPORTED_REFRESH_HZ };
  const fastestSustainedHz = 1000 / percentile(ascending, .05);
  const snapped = SUPPORTED_REFRESH_HZ.find(hz => Math.abs(fastestSustainedHz - hz) / hz <= CEILING_TOLERANCE) ?? null;
  return { hz: snapped, fastestSustainedHz, supportedHz: SUPPORTED_REFRESH_HZ };
}

/** Résolution du canvas en pixels CSS et en pixels physiques. */
export function canvasResolution(input: { cssWidth?: number | null; cssHeight?: number | null; devicePixelRatio?: number | null; deviceWidth?: number | null; deviceHeight?: number | null }): CanvasResolution {
  const devicePixelRatio = finite(input.devicePixelRatio);
  const cssWidth = finite(input.cssWidth);
  const cssHeight = finite(input.cssHeight);
  return {
    devicePixelRatio,
    cssWidth,
    cssHeight,
    deviceWidth: finite(input.deviceWidth) ?? (cssWidth !== null && devicePixelRatio !== null ? Math.round(cssWidth * devicePixelRatio) : null),
    deviceHeight: finite(input.deviceHeight) ?? (cssHeight !== null && devicePixelRatio !== null ? Math.round(cssHeight * devicePixelRatio) : null),
  };
}

/**
 * Agrégat ABBA : deux passes conservées par moteur, médiane des deux sens, alerte au-delà de 5 %.
 * Un moteur qui n'a qu'un sens ne reçoit ni médiane à deux passes ni alerte : `deltaPct` reste `null`.
 */
export function abbaAggregates(passes: readonly TruthPass[], alertPct = ABBA_ALERT_PCT): TruthAggregate[] {
  const engines = [...new Set(passes.map(pass => pass.engine))];
  return engines.map(engine => {
    const own = passes.filter(pass => pass.engine === engine);
    const direct = own.find(pass => pass.order === 'direct')?.raf ?? null;
    const reverse = own.find(pass => pass.order === 'reverse')?.raf ?? null;
    const both = own.flatMap(pass => pass.raf ? [pass.raf] : []);
    const fps = median(both.flatMap(value => value.fps === null ? [] : [value.fps]));
    const deltaPct = direct?.fps != null && reverse?.fps != null && fps ? Math.abs(direct.fps - reverse.fps) / fps * 100 : null;
    return {
      engine,
      fps,
      p50: median(both.map(value => value.p50)),
      p95: median(both.map(value => value.p95)),
      p99: median(both.map(value => value.p99)),
      slowFrames: median(both.map(value => value.slowFrames)),
      directFps: direct?.fps ?? null,
      reverseFps: reverse?.fps ?? null,
      deltaPct,
      alert: deltaPct !== null && deltaPct > alertPct,
    };
  });
}

/** Séquence ABBA : ordre direct puis ordre inverse. */
export function abbaOrder<T>(engines: readonly T[]): Array<{ engine: T; order: EngineOrder }> {
  return [
    ...engines.map(engine => ({ engine, order: 'direct' as const })),
    ...[...engines].reverse().map(engine => ({ engine, order: 'reverse' as const })),
  ];
}

export type TruthReportInput = {
  source: TruthReport['source'];
  campaign: string;
  id: string;
  timestamp: string;
  scene: string;
  engines: readonly string[];
  engineOrder: TruthReport['engineOrder'];
  replicaCount?: number | null;
  pixelError?: number | null;
  measurementMode: MeasurementMode;
  resolution: CanvasResolution;
  sdk: SdkProvenance;
  slowFrameThresholdMs?: number;
  passes: readonly TruthPass[];
  environment?: string | null;
  /** Intervalles servant à calibrer le plafond ; à défaut, ceux des passes. */
  ceilingIntervalsMs?: readonly number[];
};

/** Construit le rapport de campagne. Aucun champ n'est omis : ce qui manque vaut `null`. */
export function buildTruthReport(input: TruthReportInput): TruthReport {
  const slowFrameThresholdMs = input.slowFrameThresholdMs ?? DEFAULT_SLOW_FRAME_MS;
  const fromPasses = input.passes.flatMap(pass => pass.raf ? [pass.raf.min] : []);
  return {
    schema: TRUTH_REPORT_SCHEMA,
    source: input.source,
    campaign: input.campaign,
    id: input.id,
    timestamp: input.timestamp,
    scene: input.scene,
    engines: [...input.engines],
    engineOrder: input.engineOrder,
    replicaCount: finite(input.replicaCount),
    pixelError: finite(input.pixelError),
    measurementMode: input.measurementMode,
    resolution: input.resolution,
    refreshCeiling: refreshCeiling(input.ceilingIntervalsMs ?? fromPasses),
    sdk: input.sdk,
    slowFrameThresholdMs,
    passes: [...input.passes],
    aggregates: abbaAggregates(input.passes),
    environment: input.environment ?? null,
  };
}

/**
 * Nom de dossier d'archive. Le préfixe `campaign-` est refusé : la rétention à deux campagnes
 * balaie ce préfixe, une archive de campagne de vérité doit y échapper.
 */
export function campaignFolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom de campagne vide.');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trimmed)) throw new Error(`Nom de campagne invalide : ${name}. Lettres, chiffres et tirets seulement.`);
  if (trimmed.startsWith('campaign-')) throw new Error(`Nom de campagne interdit : ${name}. Le préfixe « campaign- » est soumis à la rétention à deux campagnes.`);
  return trimmed;
}

/** Identifiant de dossier unique pour une archive nommée : nom de campagne plus début d'UUID. */
export function campaignPackageId(name: string, runId: string): string {
  const suffix = runId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  if (!suffix) throw new Error('Identifiant de passe vide.');
  return `${campaignFolderName(name)}-${suffix}`;
}

export type CampaignOptions = {
  campaign: string;
  scenes: string[];
  engines: string[];
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  replicaCount: number;
  pixelError: number;
  frames: number;
  measurementMode: MeasurementMode;
  preload: 'visible' | 'all';
  slowFrameThresholdMs: number;
  maxResidentPages: number;
  labUrl: string;
  tag: string;
};

/** Étendues d'instances exposées par le protocole : une instance ou une grille 3 × 3. */
const REPLICA_CHOICES = [1, 9];

function positive(raw: string | undefined, fallback: number, label: string) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} invalide : ${raw}.`);
  return value;
}

function list(raw: string | undefined, fallback: readonly string[]) {
  const parts = (raw ?? '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length ? parts : [...fallback];
}

/**
 * Options de campagne lues dans l'environnement. Toutes ont un défaut documenté dans le README
 * des scripts ; une valeur illisible lève au lieu de dégrader silencieusement la mesure.
 */
export function parseCampaignOptions(env: Record<string, string | undefined>, defaults: { scenes: readonly string[]; engines: readonly string[] }): CampaignOptions {
  const replicaCount = positive(env.REPLICAS, 1, 'REPLICAS');
  if (!REPLICA_CHOICES.includes(replicaCount)) throw new Error(`REPLICAS invalide : ${env.REPLICAS}. Étendues du protocole : ${REPLICA_CHOICES.join(' ou ')}.`);
  const devicePixelRatio = positive(env.DPR, 1, 'DPR');
  const measurementMode = (env.DETAIL ?? 'summary') as MeasurementMode;
  if (measurementMode !== 'summary' && measurementMode !== 'trace') throw new Error(`DETAIL invalide : ${env.DETAIL}. Valeurs : summary ou trace.`);
  const preload = (env.PRELOAD ?? 'visible') as CampaignOptions['preload'];
  if (preload !== 'visible' && preload !== 'all') throw new Error(`PRELOAD invalide : ${env.PRELOAD}. Valeurs : visible ou all.`);
  const pixelError = env.PIXEL_ERROR === undefined || env.PIXEL_ERROR === '' ? 0 : Number(env.PIXEL_ERROR);
  if (!Number.isFinite(pixelError) || pixelError < 0) throw new Error(`PIXEL_ERROR invalide : ${env.PIXEL_ERROR}.`);
  return {
    campaign: campaignFolderName(env.CAMPAIGN ?? 'verite'),
    scenes: list(env.SCENES ?? env.SCENE, defaults.scenes),
    engines: list(env.ENGINES, defaults.engines),
    cssWidth: positive(env.WIDTH, 1280, 'WIDTH'),
    cssHeight: positive(env.HEIGHT, 720, 'HEIGHT'),
    devicePixelRatio,
    replicaCount,
    pixelError,
    frames: positive(env.FRAMES, 600, 'FRAMES'),
    measurementMode,
    preload,
    slowFrameThresholdMs: positive(env.SLOW_FRAME_MS, DEFAULT_SLOW_FRAME_MS, 'SLOW_FRAME_MS'),
    maxResidentPages: positive(env.MAX_PAGES, 100000, 'MAX_PAGES'),
    labUrl: env.LAB_URL ?? 'http://127.0.0.1:5174',
    tag: env.TAG ?? '',
  };
}
