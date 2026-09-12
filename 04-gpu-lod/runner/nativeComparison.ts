import { NativeLodRenderer } from '../implementation/nativeLodRenderer.ts';
import { TimestampBatch } from '../../shared/gpu/timing.ts';
import type { MetricSummary } from './comparisonTypes.ts';

export interface NativeComparisonOptions {
  count: number;
  width: number;
  height: number;
  samples: number;
  warmup: number;
  seed: number;
  order: 'ABBA' | 'BAAB';
}
type NativeVariant = 'cpu' | 'gpu';
type NativeControl = Awaited<ReturnType<NativeLodRenderer['control']>>;

export interface NativeComparisonFrame {
  index: number;
  poseIndex: number;
  rafTimestamp: number;
  /** Interval from this frame's callback to the following callback. */
  rafDeltaMs: number | null;
  cpuPoseMs: number;
  cpuSelectMs: number | null;
  cpuRenderSubmitMs: number;
  cpuRendererWorkMs: number;
  cpuFrameWorkMs: number;
  gpuSelectMs: number | null;
  gpuCountMs: number | null;
  gpuScatterMs: number | null;
  gpuCompactMs: number | null;
  gpuRenderMs: number | null;
  gpuMs: number | null;
  gpuPassQuality: number[] | null;
  gpuStatus: string;
  mainPassTriangles: number | null;
  shadowPassTriangles: number;
  drawCalls: number;
  lodCounts: number[] | null;
}

export interface NativeComparisonMetrics {
  variant: NativeVariant;
  phase: 'warmup' | 'measure';
  fps: number | null;
  rafDeltaMs: number | null;
  cpuSelectMs: number | null;
  gpuSelectMs: number | null;
  cpuRenderSubmitMs: number;
  cpuFrameWorkMs: number;
  gpuMs: number | null;
  triangles: number | null;
  sourceTriangles: number | null;
  drawCalls: number;
  lodCounts: number[] | null;
}

export interface NativeComparisonBlock {
  variant: NativeVariant;
  startedAt: string;
  measuredUntil: string | null;
  completedAt: string | null;
  warmupFrames: number;
  completed: boolean;
  samples: NativeComparisonFrame[];
  summary: Record<string, MetricSummary>;
  cadence: { fps: number | null; over16_67ms: number | null; over33_33ms: number | null; over50ms: number | null };
  gpuFailure?: string;
}

export interface NativeComparisonReport {
  test: '04-gpu-lod-comparison';
  timestamp: string;
  completedAt: string | null;
  status: 'completed' | 'rejected' | 'aborted';
  config: NativeComparisonOptions & { backend: 'webgpu-native' };
  environment: Record<string, unknown>;
  scene: Record<string, unknown>;
  preparation: Record<string, number>;
  controls: Array<{ phase: 'initial' | 'final'; result: NativeControl }>;
  quality: { passed: boolean; failure?: string; timingsAccepted: boolean };
  blocks: NativeComparisonBlock[];
  errors: string[];
  failure?: string;
  limitations: string[];
}

const timestamp = () => new Date().toISOString();
const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
const finite = (value: number): number | null => Number.isFinite(value) && value >= 0 ? value : null;

function summarize(values: Array<number | null>): MetricSummary {
  const ordered = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  const quantile = (probability: number) => ordered.length ? ordered[Math.floor((ordered.length - 1) * probability)] : null;
  return {
    mean: ordered.length ? ordered.reduce((sum, value) => sum + value, 0) / ordered.length : null,
    p50: quantile(.5), p95: quantile(.95), p99: quantile(.99),
    min: ordered[0] ?? null, max: ordered.at(-1) ?? null, validSamples: ordered.length,
  };
}

function finishSummary(block: NativeComparisonBlock): void {
  const keys = ['cpuPoseMs', 'cpuSelectMs', 'cpuRenderSubmitMs', 'cpuRendererWorkMs', 'cpuFrameWorkMs',
    'gpuSelectMs', 'gpuCountMs', 'gpuScatterMs', 'gpuCompactMs', 'gpuRenderMs', 'gpuMs', 'rafDeltaMs'] as const;
  block.summary = Object.fromEntries(keys.map(key => [key, summarize(block.samples.map(sample => sample[key]))]));
  const intervals = block.samples.map(sample => sample.rafDeltaMs).filter((value): value is number => value !== null && Number.isFinite(value));
  const average = block.summary.rafDeltaMs.mean;
  const frequency = (limit: number) => intervals.length ? intervals.filter(value => value > limit).length / intervals.length : null;
  block.cadence = { fps: average !== null && average > 0 ? 1000 / average : null,
    over16_67ms: frequency(1000 / 60), over33_33ms: frequency(1000 / 30), over50ms: frequency(50) };
}

function validateOptions(options: NativeComparisonOptions): void {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50000) throw new Error('Charge native : 1 à 50 000 objets.');
  if (!Number.isInteger(options.samples) || options.samples < 120 || options.samples > 480) throw new Error('Images mesurées : 120 à 480.');
  if (!Number.isInteger(options.warmup) || options.warmup < 1 || options.warmup > 480) throw new Error('Échauffement : 1 à 480 images.');
  if (!((options.width === 1920 && options.height === 1080) || (options.width === 3840 && options.height === 2160))) {
    throw new Error('Résolution physique native : 1920 × 1080 ou 3840 × 2160.');
  }
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error('Graine entière non signée sur 32 bits requise.');
  if (options.order !== 'ABBA' && options.order !== 'BAAB') throw new Error('Ordre comparatif ABBA ou BAAB requis.');
}

/** One render per real rAF; the terminal callback closes the last frame interval. */
function renderFrames(count: number, signal: AbortSignal, frame: (index: number, now: number, terminal: boolean) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let index = 0, request = 0, done = false;
    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(request);
      signal.removeEventListener('abort', aborted);
      if (error !== undefined) reject(error); else resolve();
    };
    const aborted = () => finish(signal.reason ?? new DOMException('Campagne arrêtée.', 'AbortError'));
    const tick = (now: number) => {
      try {
        if (signal.aborted) { aborted(); return; }
        frame(index, now, index === count);
        if (index++ === count) finish(); else request = requestAnimationFrame(tick);
      } catch (error) { finish(error); }
    };
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else request = requestAnimationFrame(tick);
  });
}

export async function runNativeComparison(
  canvas: HTMLCanvasElement,
  options: NativeComparisonOptions,
  onProgress: (message: string) => void = () => {},
  signal?: AbortSignal,
  onMetrics: (metrics: NativeComparisonMetrics) => void = () => {},
  onFinalImage: (image: ImageData) => void = () => {},
): Promise<NativeComparisonReport> {
  const report: NativeComparisonReport = {
    test: '04-gpu-lod-comparison', timestamp: timestamp(), completedAt: null, status: 'rejected',
    config: { ...options, backend: 'webgpu-native' },
    environment: { browser: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio, visibilityAtStart: document.visibilityState, performanceTimeOrigin: performance.timeOrigin },
    scene: {}, preparation: {}, controls: [], quality: { passed: false, timingsAccepted: false }, blocks: [], errors: [],
    limitations: [
      'A appelle le sélecteur CPU selectLodsOnCpu existant ; B calcule la sélection et la compaction en WGSL. Les deux résultats pilotent les mêmes trois dessins indexés indirects et le même raster WebGPU natif.',
      'La règle D × H / (2 × distance × tan(FOV / 2)), avec seuils 250 et 60 pixels, mesure une taille projetée. Ce test ne met pas en œuvre une borne d’erreur géométrique par pixel.',
      'Le raster utilise les API WebGPU natives. Les éventuels utilitaires Three.js de mathématiques ou de génération des géométries ne sont pas un WebGLRenderer ou WebGPURenderer.',
      'Scène procédurale résidente : absence de Bistro, de streaming, d’animations, de textures PBR et d’ombres. Ce résultat ne valide pas une migration fonctionnellement équivalente du banc 14.',
      'Les identités LOD, commandes indirectes et images A/A/B sont contrôlées sur trois poses avant mesure et une pose après mesure. La trajectoire complète et les autres entrées ne sont pas certifiées.',
      'Les sélections GPU sont en précision flottante 32 bits. Une égalité constatée sur les poses de contrôle ne démontre pas une équivalence mathématique universelle avec le CPU JavaScript.',
      'Les intervalles rAF vont du callback de chaque rendu au callback suivant, dernière image comprise. Ils mesurent la cadence des callbacks, pas le scanout ni la latence d’affichage physique.',
      'Les timestamps GPU mesurent sélection, rangs locaux, compaction stable et raster pour B, raster seul pour A. A ne lance aucune passe de calcul vide. Une mesure absente ou invalide reste null ; un zéro peut être limité par la résolution du compteur.',
      'Les lectures GPU et captures sont hors chronométrage. Aucun readback de sélection n’a lieu pendant les blocs mesurés ; les triangles et distributions LOD de B y restent non mesurés.',
      'Les callbacks des instruments sont exécutés après les mesures CPU et limités à 500 ms ; leur coût demeure inclus dans les intervalles rAF. Timestamps et instrumentation ont un coût commun non isolé.',
      'Les quantiles utilisent floor((N − 1) × p). Les images successives sont corrélées ; une campagne ne démontre ni une supériorité générale ni la significativité d’un petit écart.',
      'Mémoire : seuls les octets de ressources explicitement allouées ou les estimations étiquetées sont rapportés. Aucun compteur de VRAM résidente, température GPU ou consommation électrique n’est inventé.',
      'Une seule campagne graphique doit fonctionner à la fois ; la visibilité de cet onglet est contrôlée, les autres applications GPU ne sont pas détectées automatiquement.',
    ],
  };
  const abort = new AbortController();
  const externalAbort = () => abort.abort(signal?.reason ?? new DOMException('Arrêt demandé.', 'AbortError'));
  const visibilityChanged = () => {
    if (document.visibilityState !== 'visible') abort.abort(new DOMException('Onglet masqué : campagne interrompue.', 'AbortError'));
  };
  let renderer: NativeLodRenderer | undefined;
  let timer: TimestampBatch | undefined;
  let validationScope = false;
  const gpuError = (event: GPUUncapturedErrorEvent) => { report.errors.push(event.error.message); };
  const check = () => {
    if (abort.signal.aborted) throw abort.signal.reason;
    if (document.visibilityState !== 'visible') throw new DOMException('Onglet masqué.', 'AbortError');
    if (report.errors.length) throw new Error(report.errors.join(' ; '));
    if (renderer && (canvas.width !== options.width || canvas.height !== options.height)) throw new Error('La résolution physique a changé pendant la campagne.');
  };
  const popValidation = async () => {
    if (!renderer || !validationScope) return;
    validationScope = false;
    const error = await renderer.device.popErrorScope();
    if (error) { report.errors.push(error.message); throw new Error(`Validation WebGPU : ${error.message}`); }
  };
  signal?.addEventListener('abort', externalAbort, { once: true });
  document.addEventListener('visibilitychange', visibilityChanged);
  if (signal?.aborted) externalAbort();
  try {
    validateOptions(options); check();
    if (!canvas.isConnected || canvas.getBoundingClientRect().width <= 0 || canvas.getBoundingClientRect().height <= 0) {
      throw new Error('Le canvas du banc doit être visible dans la page.');
    }
    const preparationStart = performance.now();
    onProgress('Préparation du raster WebGPU natif et des trois niveaux de détail.');
    renderer = await NativeLodRenderer.create(canvas, options);
    renderer.device.addEventListener('uncapturederror', gpuError);
    void renderer.device.lost.then(info => {
      if (info.reason !== 'destroyed') abort.abort(new DOMException(`Périphérique GPU perdu : ${info.message}`, 'AbortError'));
    });
    report.environment = { ...report.environment, ...renderer.environment, physicalWidth: canvas.width, physicalHeight: canvas.height,
      cssWidth: canvas.getBoundingClientRect().width, cssHeight: canvas.getBoundingClientRect().height,
      timestampQueryAvailable: renderer.device.features.has('timestamp-query') };
    report.scene = renderer.sceneInfo;
    report.preparation.sceneMs = performance.now() - preparationStart;
    check();
    const device = renderer.device;
    const sourceTriangles = typeof report.scene.sourceTrianglesAtFinestLod === 'number' ? report.scene.sourceTrianglesAtFinestLod : null;
    const runControl = async (index: number, phase: 'initial' | 'final') => {
      check(); onProgress(`Contrôle ${phase === 'initial' ? 'initial' : 'final'} A/A/B : pose ${index}.`);
      device.pushErrorScope('validation'); validationScope = true;
      const result = await renderer!.control(index);
      report.controls.push({ phase, result });
      await device.queue.onSubmittedWorkDone();
      await popValidation(); check();
      if (!result.passed) throw new Error(`Contrôle ${phase} de la pose ${index} rejeté ; voir les identités, commandes et pixels archivés.`);
    };
    const controlStart = performance.now();
    for (const index of [0, Math.floor((options.samples - 1) / 2), options.samples - 1]) await runControl(index, 'initial');
    report.preparation.initialControlsMs = performance.now() - controlStart;

    const sequence: NativeVariant[] = options.order.split('').map(letter => letter === 'A' ? 'cpu' : 'gpu');
    for (let blockIndex = 0; blockIndex < sequence.length; blockIndex++) {
      check();
      const variant = sequence[blockIndex];
      const block: NativeComparisonBlock = { variant, startedAt: timestamp(), measuredUntil: null, completedAt: null,
        warmupFrames: 0, completed: false, samples: [], summary: {},
        cadence: { fps: null, over16_67ms: null, over33_33ms: null, over50ms: null } };
      report.blocks.push(block);
      const executeFrames = async (count: number, phase: 'warmup' | 'measure') => {
        let previousTimestamp: number | null = null, previousRow: NativeComparisonFrame | null = null;
        let telemetryStart = performance.now(), windowFrames = 0, intervalCount = 0, intervalSum = 0;
        let selectionSum = 0, selectionCount = 0, submissionSum = 0, frameSum = 0;
        await renderFrames(count, abort.signal, (index, now, terminal) => {
          check();
          if (previousTimestamp !== null) {
            const delta = now - previousTimestamp;
            if (previousRow) previousRow.rafDeltaMs = delta;
            intervalSum += delta; intervalCount++;
          }
          if (terminal) return;
          const start = performance.now();
          renderer!.setPose(index);
          const posed = performance.now();
          const measurement = renderer!.render(variant, phase === 'measure' ? timer : undefined, index);
          const end = performance.now();
          const row: NativeComparisonFrame = { index, poseIndex: index, rafTimestamp: now, rafDeltaMs: null,
            cpuPoseMs: posed - start, cpuSelectMs: measurement.cpuSelectMs, cpuRenderSubmitMs: measurement.cpuSubmitMs,
            cpuRendererWorkMs: measurement.cpuFrameMs, cpuFrameWorkMs: end - start,
            gpuSelectMs: null, gpuCountMs: null, gpuScatterMs: null, gpuCompactMs: null, gpuRenderMs: null, gpuMs: null, gpuPassQuality: null,
            gpuStatus: timer && phase === 'measure' ? 'pending' : 'not-measured',
            mainPassTriangles: measurement.triangles, shadowPassTriangles: 0, drawCalls: 3, lodCounts: measurement.lodCounts };
          if (phase === 'measure') block.samples.push(row); else block.warmupFrames++;
          previousTimestamp = now; previousRow = row;
          windowFrames++;
          if (row.cpuSelectMs !== null) { selectionSum += row.cpuSelectMs; selectionCount++; }
          submissionSum += row.cpuRenderSubmitMs; frameSum += row.cpuFrameWorkMs;
          if (end - telemetryStart >= 500) {
            const interval = intervalCount ? intervalSum / intervalCount : null;
            onMetrics({ variant, phase, fps: interval !== null && interval > 0 ? 1000 / interval : null, rafDeltaMs: interval,
              cpuSelectMs: selectionCount ? selectionSum / selectionCount : null, cpuRenderSubmitMs: submissionSum / windowFrames,
              cpuFrameWorkMs: frameSum / windowFrames, gpuSelectMs: null, gpuMs: null, triangles: row.mainPassTriangles,
              sourceTriangles, drawCalls: row.drawCalls, lodCounts: row.lodCounts });
            telemetryStart = performance.now(); windowFrames = selectionCount = intervalCount = 0; intervalSum = selectionSum = submissionSum = frameSum = 0;
          }
        });
      };
      onProgress(`Bloc ${blockIndex + 1}/4 · ${variant === 'cpu' ? 'A · Référence CPU' : 'B · Calcul WGSL'} · ${options.warmup} images d’échauffement.`);
      device.pushErrorScope('validation'); validationScope = true;
      await executeFrames(options.warmup, 'warmup');
      await device.queue.onSubmittedWorkDone(); await popValidation(); check();
      onProgress(`Bloc ${blockIndex + 1}/4 · ${variant === 'cpu' ? 'A · Référence CPU' : 'B · Calcul WGSL'} · ${options.samples} images mesurées.`);
      device.pushErrorScope('validation'); validationScope = true;
      if (device.features.has('timestamp-query')) { timer = new TimestampBatch(device, options.samples, variant === 'gpu' ? 4 : 1); timer.begin(options.samples); }
      await executeFrames(options.samples, 'measure');
      block.measuredUntil = timestamp();
      if (timer) {
        const encoder = device.createCommandEncoder({ label: 'LOD native benchmark timestamps resolve, outside frame timing' });
        timer.resolve(encoder); device.queue.submit([encoder.finish()]); timer.submitted();
        await timer.collect();
        for (let index = 0; index < block.samples.length; index++) {
          const row = block.samples[index], passCount = variant === 'gpu' ? 4 : 1, offset = index * passCount;
          if (variant === 'gpu') {
            row.gpuSelectMs = finite(timer.passMs[offset]); row.gpuCountMs = finite(timer.passMs[offset + 1]);
            row.gpuScatterMs = finite(timer.passMs[offset + 2]);
            row.gpuCompactMs = row.gpuCountMs !== null && row.gpuScatterMs !== null ? row.gpuCountMs + row.gpuScatterMs : null;
          }
          row.gpuRenderMs = finite(timer.passMs[offset + passCount - 1]); row.gpuMs = finite(timer.frameSpanMs[index]);
          row.gpuPassQuality = Array.from(timer.quality.subarray(offset, offset + passCount));
          if (row.gpuMs !== null && row.gpuMs > performance.now() - block.samples[0].rafTimestamp) {
            row.gpuMs = null; row.gpuPassQuality.fill(2);
          }
          row.gpuStatus = row.gpuMs === null || row.gpuPassQuality.includes(2) ? 'invalid'
            : row.gpuPassQuality.includes(1) ? 'resolution-limited-pass' : 'measured';
        }
        timer.destroy(); timer = undefined;
      }
      await device.queue.onSubmittedWorkDone(); await popValidation(); check();
      block.completed = true; block.completedAt = timestamp(); finishSummary(block);
    }
    const finalStart = performance.now();
    await runControl(options.samples - 1, 'final');
    // No additional render: allow the checked swapchain image to reach a presentation opportunity.
    await renderFrames(0, abort.signal, () => check());
    report.preparation.finalControlMs = performance.now() - finalStart;
    const finalImage = renderer.takeCheckedImage();
    if (finalImage) onFinalImage(finalImage);
    report.status = 'completed'; report.quality = { passed: true, timingsAccepted: true };
    onProgress('Campagne native terminée ; contrôles acceptés, données prêtes à archiver.');
  } catch (error) {
    report.failure = errorText(error);
    report.status = abort.signal.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'aborted' : 'rejected';
    report.quality = { passed: false, timingsAccepted: false, failure: report.failure };
    const block = report.blocks.at(-1);
    if (timer && block) block.gpuFailure = report.failure;
    onProgress(`${report.status === 'aborted' ? 'Campagne arrêtée' : 'Campagne rejetée'} : ${report.failure}. Données partielles conservées.`);
  } finally {
    if (renderer) {
      if (validationScope) {
        try { await popValidation(); } catch (error) { report.errors.push(errorText(error)); }
      }
      try { await renderer.device.queue.onSubmittedWorkDone(); } catch (error) { report.errors.push(errorText(error)); }
      timer?.destroy();
      renderer.device.removeEventListener('uncapturederror', gpuError);
      renderer.dispose();
    }
    if (report.errors.length && report.status === 'completed') {
      report.status = 'rejected'; report.failure = report.errors.join(' ; ');
      report.quality = { passed: false, timingsAccepted: false, failure: report.failure };
    }
    for (const block of report.blocks) finishSummary(block);
    report.completedAt = timestamp();
    document.removeEventListener('visibilitychange', visibilityChanged);
    signal?.removeEventListener('abort', externalAbort);
  }
  return report;
}

export function formatNativeReport(report: NativeComparisonReport): string {
  const n = (value: number | null | undefined, digits = 3) => value === null || value === undefined || !Number.isFinite(value) ? 'non mesuré' : value.toFixed(digits);
  const pct = (value: number | null) => value === null ? 'non mesuré' : `${(value * 100).toFixed(2)} %`;
  const rows = report.blocks.map((block, index) => `| ${index + 1} · ${block.variant === 'cpu' ? 'A CPU' : 'B WGSL'} | ${block.samples.length} | ${n(block.summary.cpuSelectMs?.mean)} | ${n(block.summary.cpuRenderSubmitMs?.mean)} | ${n(block.summary.cpuFrameWorkMs?.mean)} | ${n(block.summary.gpuMs?.mean)} | ${n(block.cadence.fps, 2)} | ${n(block.summary.rafDeltaMs?.p50)} / ${n(block.summary.rafDeltaMs?.p95)} / ${n(block.summary.rafDeltaMs?.p99)} | ${pct(block.cadence.over16_67ms)} / ${pct(block.cadence.over33_33ms)} / ${pct(block.cadence.over50ms)} |`).join('\n');
  return `# 04 · Référence CPU et sélection WGSL avec rendu WebGPU natif

Date : ${report.timestamp}

Statut : **${report.status}**. ${report.quality.timingsAccepted ? 'Contrôles acceptés dans le périmètre ci-dessous ; aucune supériorité générale démontrée.' : 'Mesures non acceptées pour conclure à une amélioration ; les données partielles sont conservées.'}
${report.failure ? `\nCause : ${report.failure}\n` : ''}

## Référence et proposition réellement exécutées

A conserve le calcul CPU du projet, \`selectLodsOnCpu\`. B calcule sur GPU les mêmes paliers puis compacte les indices utilisés par les trois commandes de dessin indirectes. A et B utilisent le même raster WebGPU natif et les mêmes géométries. La sélection pilote effectivement le rendu.

La règle \`pixels = D × H / (2 × distance × tan(FOV / 2))\` choisit les paliers avec les seuils 250 et 60 pixels. Il s’agit de taille projetée, pas d’une borne d’erreur de décimation par pixel. Les différences de précision CPU/GPU sont testées sur les poses enregistrées, sans preuve universelle d’équivalence.

## Configuration et environnement

\`\`\`json
${JSON.stringify({ config: report.config, environment: report.environment, scene: report.scene, preparation: report.preparation }, null, 2)}
\`\`\`

## Blocs dans leur ordre réel

Durées en millisecondes. FPS = 1 000 / intervalle rAF moyen. Les p50/p95/p99 concernent la cadence des callbacks. Les ralentissements sont des fréquences au-delà de 16,667 / 33,333 / 50 ms. Les moyennes et tous les quantiles CPU/GPU sont également conservés dans le JSON brut.

| Bloc | Images | Sélection CPU moyenne | Soumission CPU moyenne | Travail CPU moyen | Enveloppe GPU moyenne | FPS rAF | rAF p50 / p95 / p99 | Ralentissements >16,667 / >33,333 / >50 ms |
|---|---:|---:|---:|---:|---:|---:|---|---|
${rows || '| Aucun bloc mesuré | 0 | non mesuré | non mesuré | non mesuré | non mesuré | non mesuré | non mesuré | non mesuré |'}

Les temps GPU distinguent quatre passes pour B : sélection, rangs locaux, compaction stable et raster. A ne lance que le raster. L’enveloppe conserve les intervalles entre passes. Une valeur nulle dans le JSON est indisponible ; un zéro numérique peut être limité par la résolution du compteur. Aucun temps GPU n’est déduit du temps CPU ou de la cadence.

## Contrôles des commandes, sélections et images affichées

Les contrôles A/A/B comparent exactement les pixels de la texture destinée au canvas et les sélections. Ils vérifient également les commandes indirectes et le caractère non vide de l’image. Trois poses précèdent les mesures ; un contrôle supplémentaire suit la dernière mesure. Ces contrôles n’établissent pas l’équivalence sur toutes les entrées ni sur toutes les images intermédiaires.

\`\`\`json
${JSON.stringify({ quality: report.quality, controls: report.controls, errors: report.errors }, null, 2)}
\`\`\`

## Portée et limites

Ce banc ne passe par aucun Three.js renderer. Les utilitaires de construction de géométrie ou de matrices peuvent employer Three.js hors raster. Ce test procédural ne contient ni Bistro, ni ombres, ni PBR, ni streaming : il ne démontre pas une absence de perte fonctionnelle face au banc 14. Il isole la comparaison CPU/WGSL avec un vrai rendu natif dans le laboratoire.

${report.limitations.map(limit => `- ${limit}`).join('\n')}
`;
}
