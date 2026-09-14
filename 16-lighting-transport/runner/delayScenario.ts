import {
  createLightingScene,
  createDefaultLightingSceneLights,
  createTransport,
  type LightingSceneLight,
} from '@web-geometry/sdk';
import { createExplorer, createLightingExperimentBackend, type LightingExperimentRenderState } from '@web-geometry/sdk/browser';
import {
  LIGHTING_PROTOCOL,
  LIGHTING_DELAY_PROTOCOL,
  LIGHTING_DELAY_EVENTS,
  LIGHTING_DELAY_MS,
  type LightingDelayEventId,
  type LightingDelayReport,
  type LightingDelaySequence,
  type LightingBenchOptions,
} from '../contracts.ts';
import { delayAlpha, blendArrays, maxAbsDifference, createTau95Tracker } from './delayBlend.ts';
import { encodeCaptureToPng, assembleWebm, assembleContactSheet, type ContactSheetRow } from './delayVideo.ts';

interface SceneParams { doorAngle: number; lightIntensity: number; roughness: number; lights: LightingSceneLight[] }

/** Yields to the browser between frames: keeps Arrêter responsive and lets the abort signal land
 *  during a slow, simulated-time render loop that would otherwise block the main thread solid.
 *  A timer, not requestAnimationFrame: rAF is throttled hard the moment the tab is backgrounded,
 *  which would stall a multi-minute campaign the user only glances back at occasionally. */
const nextFrame = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const cancelled = () => { clearTimeout(id); reject(signal.reason); };
  const id = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, 0);
  signal.addEventListener('abort', cancelled, { once: true });
});

const ROUGHNESS = 0.25;
const camera = {
  position: [...LIGHTING_DELAY_PROTOCOL.cameraPosition] as [number, number, number],
  target: [...LIGHTING_DELAY_PROTOCOL.cameraTarget] as [number, number, number],
  fov: LIGHTING_DELAY_PROTOCOL.fov,
  near: LIGHTING_DELAY_PROTOCOL.near,
  far: LIGHTING_DELAY_PROTOCOL.far,
};

function eventScenes(id: LightingDelayEventId): { before: SceneParams; after: SceneParams } {
  const lights = createDefaultLightingSceneLights();
  const warmOff = lights.map(light => (light.id === 'warm' ? { ...light, intensity: 0 } : light));
  const open = { doorAngle: Math.PI / 2, lightIntensity: 1, roughness: ROUGHNESS, lights };
  const closed = { doorAngle: 0, lightIntensity: 1, roughness: ROUGHNESS, lights };
  if (id === 'door-closes') return { before: open, after: closed };
  if (id === 'door-opens') return { before: closed, after: open };
  return { before: open, after: { ...open, lights: warmOff } };
}

function checkGeometry(metrics: { triangles: number | null; selectedTriangles: number | null }): void {
  if (metrics.triangles !== metrics.selectedTriangles) throw new Error('Couverture géométrique incomplète');
  if (metrics.triangles !== LIGHTING_PROTOCOL.sourceTriangles) throw new Error('La fixture a changé');
}

async function uploadCapture(packageId: string, file: string, blob: Blob, signal: AbortSignal): Promise<number> {
  const response = await fetch(`/api/lighting-delay-media?package=${encodeURIComponent(packageId)}&file=${encodeURIComponent(file)}`, {
    method: 'POST',
    body: blob,
    signal,
  });
  if (!response.ok) throw new Error(`Téléversement de ${file} impossible : ${await response.text()}`);
  return blob.size;
}

function artifactUrl(packageId: string, file: string): string {
  return `/api/report-artifact?package=${encodeURIComponent(`16-lighting-transport/${packageId}`)}&file=${encodeURIComponent(`captures/${file}`)}`;
}

type Explorer = Awaited<ReturnType<typeof createExplorer>>;

interface EventOutcome {
  contactSheet: { event: LightingDelayEventId; url: string };
}

/** Each finished delay's sequence is reported immediately: its video is already durably written to
 *  disk, so a later abort inside the same event must not drop it from the final report. */
async function renderEvent(
  eventId: LightingDelayEventId,
  eventLabel: string,
  explorer: Explorer,
  state: LightingExperimentRenderState,
  packageId: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  onSequence: (sequence: LightingDelaySequence) => void,
): Promise<EventOutcome> {
  const { before, after } = eventScenes(eventId);
  const patchSize = LIGHTING_PROTOCOL.patchSize;
  const sceneA = createLightingScene({ ...before, patchSize });
  const sceneB = createLightingScene({ ...after, patchSize });
  const transportOptions = {
    raysPerPatch: LIGHTING_PROTOCOL.raysPerPatch,
    maxIterations: LIGHTING_PROTOCOL.maxIterations,
    tolerance: LIGHTING_PROTOCOL.tolerance,
    warmStart: false,
    cancelled: () => signal.aborted,
  };
  const resultA = createTransport(sceneA, transportOptions).update(sceneA, 'rebuild');
  const resultB = createTransport(sceneB, transportOptions).update(sceneB, 'rebuild');
  if (!resultA.converged || !resultB.converged) throw new Error(`Le transport diffus ne converge pas pour « ${eventLabel} »`);
  const radianceA = resultA.radiance.slice(), radianceB = resultB.radiance.slice();
  const indirectA = resultA.indirectIrradiance.slice(), indirectB = resultB.indirectIrradiance.slice();
  const amplitudeRadiance = maxAbsDifference(radianceA, radianceB);
  const amplitudeIndirect = maxAbsDifference(indirectA, indirectB);

  const width = LIGHTING_PROTOCOL.width, height = LIGHTING_PROTOCOL.height;
  const capturePng = () => {
    const pixels = explorer.capture().slice();
    return encodeCaptureToPng(pixels, width, height);
  };

  state.scene = sceneA;
  state.radiance = radianceA;
  state.indirectIrradiance = indirectA;
  const preFrames: string[] = [];
  for (let i = 0; i < LIGHTING_DELAY_PROTOCOL.preRollFrames; i++) {
    await nextFrame(signal);
    checkGeometry(explorer.render(camera));
    preFrames.push(capturePng());
    onProgress(`${eventLabel} · avant t0 · image ${i + 1}/${LIGHTING_DELAY_PROTOCOL.preRollFrames}`);
  }

  const contactRows: ContactSheetRow[] = [];
  for (const delayMs of LIGHTING_DELAY_MS) {
    signal.throwIfAborted();
    const tauRadiance = createTau95Tracker(amplitudeRadiance, LIGHTING_DELAY_PROTOCOL.errorThreshold);
    const tauIndirect = createTau95Tracker(amplitudeIndirect, LIGHTING_DELAY_PROTOCOL.errorThreshold);
    const blendedRadiance = new Float64Array(radianceA.length);
    const blendedIndirect = new Float64Array(indirectA.length);
    state.scene = sceneB;
    const postFrames: string[] = [];
    for (let i = 0; i < LIGHTING_DELAY_PROTOCOL.postRollFrames; i++) {
      await nextFrame(signal);
      const simTimeMs = i * LIGHTING_DELAY_PROTOCOL.frameDurationMs;
      const alpha = delayAlpha(simTimeMs, delayMs, LIGHTING_DELAY_PROTOCOL.targetConvergence);
      blendArrays(radianceA, radianceB, alpha, blendedRadiance);
      blendArrays(indirectA, indirectB, alpha, blendedIndirect);
      state.radiance = blendedRadiance;
      state.indirectIrradiance = blendedIndirect;
      checkGeometry(explorer.render(camera));
      postFrames.push(capturePng());
      tauRadiance.observe(blendedRadiance, radianceB, simTimeMs);
      tauIndirect.observe(blendedIndirect, indirectB, simTimeMs);
      onProgress(`${eventLabel} · retard ${delayMs} ms · image ${i + 1}/${LIGHTING_DELAY_PROTOCOL.postRollFrames}`);
    }
    const frames = [...preFrames, ...postFrames];
    const videoName = `${eventId}-${delayMs}ms.webm`;
    onProgress(`${eventLabel} · retard ${delayMs} ms · assemblage vidéo`);
    const videoBlob = await assembleWebm(frames, width, height, LIGHTING_DELAY_PROTOCOL.fps, signal);
    const videoBytes = await uploadCapture(packageId, videoName, videoBlob, signal);
    onSequence({
      event: eventId,
      delayMs,
      frameCount: frames.length,
      tau95RadianceMs: tauRadiance.result(),
      tau95IndirectMs: tauIndirect.result(),
      videoUrl: artifactUrl(packageId, videoName),
      videoBytes,
    });
    const keyInstant = Math.min(postFrames.length - 1, Math.round(delayMs / LIGHTING_DELAY_PROTOCOL.frameDurationMs));
    contactRows.push({
      label: `${delayMs} ms`,
      columns: [
        { label: 't0⁻', pngDataUrl: preFrames[preFrames.length - 1] },
        { label: 't0', pngDataUrl: postFrames[0] },
        { label: '~ t0+D (95 %)', pngDataUrl: postFrames[keyInstant] },
        { label: 'fin de séquence', pngDataUrl: postFrames[postFrames.length - 1] },
      ],
    });
  }

  onProgress(`${eventLabel} · planche contact`);
  const sheetName = `contact-sheet-${eventId}.png`;
  const sheetBlob = await assembleContactSheet(contactRows, width, height);
  await uploadCapture(packageId, sheetName, sheetBlob, signal);
  return { contactSheet: { event: eventId, url: artifactUrl(packageId, sheetName) } };
}

async function prepareFixture(signal: AbortSignal) {
  const response = await fetch('/api/lighting-prepare', { method: 'POST', signal });
  if (!response.ok) throw new Error(`Préparation indisponible : ${await response.text()}`);
  return (await response.json()) as { manifestUrl: string; preparationMs: number; provenance: Record<string, unknown>; fixtureKey: string };
}

export async function runLightingDelayScenario(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingDelayReport> {
  const abort = new AbortController(), signal = abort.signal;
  const relay = () => abort.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', relay, { once: true });
  if (options.signal?.aborted) relay();
  const packageId = 'campaign-' + crypto.randomUUID();
  const onProgress = (message: string) => options.onProgress?.(message);
  const report: LightingDelayReport = {
    formatVersion: 1,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    status: 'error',
    protocol: LIGHTING_PROTOCOL,
    delayProtocol: LIGHTING_DELAY_PROTOCOL,
    environment: {},
    provenance: {},
    sequences: [],
    contactSheets: [],
    scope: {
      shows: [
        'Le retard seul de la lumière indirecte après un changement instantané de géométrie ou d’éclairage direct, sur une solution exacte du transport CPU.',
        'La vérification que le mélange exponentiel programmé atteint bien 95 % du saut à l’instant D annoncé (τ95 mesuré sur les tableaux).',
      ],
      doesNotShow: [
        'Le bruit ou le scintillement d’un vrai amortissement temporel ou d’un solveur incrémental.',
        'Une cadence de rendu : chaque image est calculée en temps simulé, hors temps réel, puis assemblée à 60 images par seconde après coup.',
      ],
    },
    limitations: [
      'Chaque état A et B est un point fixe indépendant du solveur (warmStart:false) ; aucun résultat sur un solveur incrémental réel.',
      'Trois événements seulement, caméra fixe sur la pose « doorway » ; aucune généralisation à d’autres vues ou à une scène quelconque.',
      'Une seule machine et un seul navigateur ; les autres systèmes restent non testés.',
    ],
  };
  let owned: Explorer | undefined;
  try {
    onProgress('Préparation de la scène avec le SDK…');
    const prepared = await prepareFixture(signal);
    const initialLights = createDefaultLightingSceneLights();
    const initialScene = createLightingScene({ doorAngle: Math.PI / 2, lightIntensity: 1, roughness: ROUGHNESS, patchSize: LIGHTING_PROTOCOL.patchSize, lights: initialLights });
    const initialTransport = createTransport(initialScene, { raysPerPatch: LIGHTING_PROTOCOL.raysPerPatch, maxIterations: LIGHTING_PROTOCOL.maxIterations, tolerance: LIGHTING_PROTOCOL.tolerance, warmStart: false, cancelled: () => signal.aborted }).update(initialScene, 'rebuild');
    const state: LightingExperimentRenderState = {
      scene: initialScene,
      radiance: initialTransport.radiance.slice(),
      indirectIrradiance: initialTransport.indirectIrradiance.slice(),
      exposure: 1,
      reflectionSamples: LIGHTING_PROTOCOL.reflectionSamples,
      directLightSamples: LIGHTING_PROTOCOL.directLightSamples,
      rayTraversal: 'brute',
    };
    onProgress('Création du rendu expérimental…');
    owned = await createExplorer(canvas, {
      manifestUrl: prepared.manifestUrl,
      scope: 'full',
      width: LIGHTING_PROTOCOL.width,
      height: LIGHTING_PROTOCOL.height,
      pixelRatio: LIGHTING_PROTOCOL.pixelRatio,
      pixelError: 0,
      preload: 'all',
      backends: [createLightingExperimentBackend(state)],
      clearColor: 0x080c12,
      signal,
      diagnosticDetail: 'summary',
    });
    const explorer = owned;
    await explorer.awaitPages();
    signal.throwIfAborted();
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 indisponible');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    report.environment = {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      logicalCpus: navigator.hardwareConcurrency,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      webglVersion: gl.getParameter(gl.VERSION),
      visibility: document.visibilityState,
    };
    report.provenance = {
      ...prepared.provenance,
      preparationMs: prepared.preparationMs,
      fixtureKey: prepared.fixtureKey,
      geometry: { surfaces: initialScene.surfaces.length, patches: initialScene.patches.length, triangles: explorer.metadata.selectedTriangles },
      publicPrepare: true,
      publicExplorer: true,
      preparedClusterGeometryRendered: false,
      productionRenderer: false,
    };
    for (const event of LIGHTING_DELAY_EVENTS) {
      const outcome = await renderEvent(event.id, event.label, explorer, state, packageId, signal, onProgress, sequence => report.sequences.push(sequence));
      report.contactSheets.push(outcome.contactSheet);
    }
    report.status = 'measured';
  } catch (error) {
    const stopped = options.signal?.aborted === true || signal.aborted;
    report.status = stopped ? 'stopped' : 'error';
    report.error = stopped ? 'Campagne arrêtée à la demande.' : error instanceof Error ? error.message : String(error);
  } finally {
    owned?.dispose();
  }
  onProgress('Archivage du rapport…');
  try {
    const response = await fetch('/api/lighting-delay-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, report }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(await response.text());
  } catch (error) {
    report.status = 'error';
    report.error = `Archivage échoué : ${String(error)}`;
  }
  return report;
}
