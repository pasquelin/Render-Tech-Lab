export type LightingVariant = 'brute' | 'bvh';
export type LightingVector = [number, number, number];

export interface LightingLight {
  id: string;
  /** Linear RGB; the UI converts display colors before passing them here. */
  color: LightingVector;
  intensity: number;
  position: LightingVector;
}

export interface LightingLightControl {
  readonly label: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly maxIntensity: number;
}

/** Fixture placement limits; keep each complete area panel inside its room. */
export const LIGHTING_LIGHT_CONTROLS: Readonly<Record<string, LightingLightControl>> = Object.freeze({
  warm: Object.freeze({ label: 'Chaude · pièce de gauche', minX: -2.75, maxX: -1.25, minZ: -2, maxZ: 2, maxIntensity: 2 }),
  cyan: Object.freeze({ label: 'Bleue · pièce de droite', minX: .6, maxX: 3.4, minZ: -2, maxZ: 2, maxIntensity: 2 }),
  magenta: Object.freeze({ label: 'Rose · près du passage', minX: -3.4, maxX: -.6, minZ: -2, maxZ: 2, maxIntensity: 2 }),
});

/** Interactive state. Resolution and sample counts belong to the fixed protocol. */
export interface LightingConfig {
  variant: LightingVariant;
  lights: LightingLight[];
  doorAngle: number;
  roughness: number;
  cameraT: number;
  lightIntensity: number;
}

export const LIGHTING_PROTOCOL = Object.freeze({
  formatVersion: 1,
  width: 1280,
  height: 720,
  pixelRatio: 1,
  patchSize: 1.2,
  raysPerPatch: 256,
  reflectionSamples: 8,
  directLightSamples: 16,
  warmupFrames: 4,
  sampleFrames: 12,
  maxIterations: 240,
  tolerance: 1e-8,
  sourceTriangles: 4158,
  patches: 282,
} as const);

/** Independent measurements. CPU submission never includes a GPU duration. */
export interface LightingFrame {
  variant: LightingVariant;
  cpuTransportMs: number | null;
  cpuSubmitMs: number | null;
  cpuFrameMs: number | null;
  gpuMs: number | null;
  /** No interval exists for an isolated render call. */
  rafDeltaMs: number | null;
  /** 1000 / measured rafDeltaMs, with the display ceiling recorded separately. */
  fps: number | null;
  drawCalls: number | null;
  triangles: number | null;
  raysReused: number | null;
  totalRays: number | null;
  bvhRefitMs: number | null;
  bvhNodeCount: number | null;
  bvhNodeBytes: number | null;
}

export interface LightingCapture {
  width: number;
  height: number;
  dataUrl: string;
}

export interface LightingCaptureCheck {
  scenario: string;
  foregroundPixels: number;
  repeatDifferentPixels: number;
  candidateDifferentPixels: number;
  maxRepeatChannelError: number;
  maxCandidateChannelError: number;
  passed: boolean;
}

export interface LightingBlock {
  variant: LightingVariant;
  kind: 'cadence' | 'gpu-isolated';
  frames: LightingFrame[];
}

export interface LightingReport {
  formatVersion: 1;
  id: string;
  timestamp: string;
  status: 'measured' | 'rejected' | 'stopped' | 'error';
  protocol: typeof LIGHTING_PROTOCOL;
  config: LightingConfig;
  environment: Record<string, unknown>;
  provenance: Record<string, unknown>;
  quality: { passed: boolean | null; captures: LightingCaptureCheck[] };
  blocks: LightingBlock[];
  artifacts: { scenario: string; variant: LightingVariant; dataUrl: string }[];
  observedRafCeilingHz?: number | null;
  limitations: string[];
  error?: string;
}

export interface LightingArchiveEntry {
  package: string;
  id: string;
  timestamp: string;
  status: LightingReport['status'];
  qualityPassed: boolean | null;
}
export interface LightingArchiveHistory {
  formatVersion: 1;
  latestAttempt: string | null;
  latestValid: string | null;
  attempts: LightingArchiveEntry[];
}

export interface LightingBenchOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface LightingController {
  update(patch: Partial<LightingConfig>): Promise<LightingFrame>;
  render(): LightingFrame;
  capture(): LightingCapture;
  getConfig(): LightingConfig;
  dispose(): void;
}

/** "Retard de réponse lumineuse" : la géométrie change instantanément, l'indirect suit avec un retard D. */
export type LightingDelayEventId = 'door-closes' | 'door-opens' | 'lamp-off';

export const LIGHTING_DELAY_EVENTS: ReadonlyArray<{ readonly id: LightingDelayEventId; readonly label: string }> = [
  { id: 'door-closes', label: 'Porte ouverte → fermée' },
  { id: 'door-opens', label: 'Porte fermée → ouverte' },
  { id: 'lamp-off', label: 'Extinction de la lampe chaude' },
];

/** 95 % du chemin vers B est parcouru à t0 + D ; D = 0 est un saut net (fonction de marche). */
export const LIGHTING_DELAY_MS = [0, 50, 100, 200, 400, 800] as const;
export type LightingDelayMs = (typeof LIGHTING_DELAY_MS)[number];

export const LIGHTING_DELAY_PROTOCOL = Object.freeze({
  formatVersion: 1,
  fps: 60,
  frameDurationMs: 1000 / 60,
  preRollFrames: 30,
  postRollFrames: 90,
  targetConvergence: 0.95,
  errorThreshold: 0.05,
  cameraLabel: 'doorway',
  cameraPosition: [2.7, 1.6, 1.1] as LightingVector,
  cameraTarget: [-2, 1.3, 0] as LightingVector,
  fov: 66,
  near: 0.025,
  far: 50,
  delaysMs: LIGHTING_DELAY_MS,
  events: LIGHTING_DELAY_EVENTS.map(event => event.id),
} as const);

export interface LightingDelaySequence {
  event: LightingDelayEventId;
  delayMs: number;
  frameCount: number;
  /** First simulated instant (ms after t0) where the blended array's max error vs B falls under the threshold. */
  tau95RadianceMs: number | null;
  tau95IndirectMs: number | null;
  videoUrl: string | null;
  videoBytes: number | null;
}

export interface LightingDelayReport {
  formatVersion: 1;
  id: string;
  timestamp: string;
  status: 'measured' | 'stopped' | 'error';
  protocol: typeof LIGHTING_PROTOCOL;
  delayProtocol: typeof LIGHTING_DELAY_PROTOCOL;
  environment: Record<string, unknown>;
  provenance: Record<string, unknown>;
  sequences: LightingDelaySequence[];
  contactSheets: { event: LightingDelayEventId; url: string }[];
  scope: { shows: string[]; doesNotShow: string[] };
  limitations: string[];
  error?: string;
}

export interface LightingDelayArchiveEntry {
  package: string;
  id: string;
  timestamp: string;
  status: LightingDelayReport['status'];
}
export interface LightingDelayArchiveHistory {
  formatVersion: 1;
  latestAttempt: string | null;
  attempts: LightingDelayArchiveEntry[];
}
