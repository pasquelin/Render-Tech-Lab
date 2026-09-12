/**
 * 12-visibility-buffer/implementation/visibilityBuffer.ts
 *
 * Implémentation du pipeline Visibility Buffer à deux passes :
 * - Passe 1 : Rasterisation compacte d'un ID 32-bit (instanceId:16 | primitiveId:16) + Profondeur
 * - Passe 2 : Shading différé via reconstruction barycentrique (zéro overdraw de calcul de fragment)
 *
 * Réutilise les formules d'interpolation de perspective de shared/math/barycentric.ts.
 */

import {
  barycentric,
  perspectiveAttribute,
} from '../../shared/math/barycentric.ts';
import type {
  VisibilityPassInput,
  VisibilityPassOutput,
  VisibilityExecution,
  VisibilityProgress,
} from '../contracts.ts';

export const BACKGROUND_VISIBILITY_ID = 0;

/**
 * Encode un couple (instanceId, primitiveId) sur un unique mot 32-bit non signé.
 * Supporte jusqu'à 65 536 instances et 65 536 primitives par meshlet/batch.
 */
export function packVisibilityId(instanceId: number, primitiveId: number): number {
  if (!Number.isInteger(instanceId) || !Number.isInteger(primitiveId) || instanceId < 0 || instanceId > 0xffff || primitiveId < 0 || primitiveId > 0xffff) {
    throw new Error('Identifiant hors bornes 16-bit');
  }
  const raw = instanceId * 0x10000 + primitiveId;
  if (raw === 0xffffffff) throw new Error('Visibility ID capacity exceeded: pair collides with background');
  return (raw + 1) >>> 0;
}

/**
 * Décode un mot 32-bit vers (instanceId, primitiveId).
 */
export function unpackVisibilityId(visibilityId: number): [number, number] | null {
  if (visibilityId === BACKGROUND_VISIBILITY_ID) return null;
  const raw = (visibilityId - 1) >>> 0;
  const instanceId = (raw >>> 16) & 0xffff;
  const primitiveId = raw & 0xffff;
  return [instanceId, primitiveId];
}

export interface VisibilitySampleInput {
  pixelCoord: [number, number]; triangleVertices2D: [number, number][]; clipW: number[]; clipZ: number[]; attributes: number[][];
}

export function reconstructVisibilitySample(input: VisibilitySampleInput): { depth: number; attributes: number[] } {
  if (input.clipZ.length !== 3 || input.clipW.length !== 3 || input.attributes.some((values) => values.length !== 3)) throw new Error('Visibility reconstruction requires one triangle');
  const weights = barycentric(input.triangleVertices2D, input.pixelCoord);
  return { depth: perspectiveAttribute(weights, input.clipW, input.clipZ), attributes: input.attributes.map((values) => perspectiveAttribute(weights, input.clipW, values)) };
}

/**
 * Reconstruit un attribut interpolé en perspective à partir des coordonnées écran
 * et des données du triangle source.
 */
export function reconstructAttributeAtPixel(
  pixelCoord: [number, number],
  triangleVertices2D: [number, number][],
  clipW: number[],
  vertexAttributes: number[]
): number {
  const weights = barycentric(triangleVertices2D, pixelCoord);
  return perspectiveAttribute(weights, clipW, vertexAttributes);
}

/**
 * Calcule l'empreinte mémoire et la bande passante comparée G-Buffer vs Visibility Buffer.
 */
export function evaluateVisibilityBuffer(input: VisibilityPassInput): VisibilityPassOutput {
  const { viewportWidth, viewportHeight } = input;
  const pixelCount = viewportWidth * viewportHeight;

  // Passe 1 : Visibility Buffer (u32 ID = 4 octets, Depth = 4 octets)
  const primitiveIdBufferBytes = pixelCount * 4;
  const depthBufferBytes = pixelCount * 4;
  const deferredBufferBytes = primitiveIdBufferBytes + depthBufferBytes; // 8 octets par pixel

  // Comparaison : G-Buffer traditionnel (Forward / Deferred standard)
  // Albedo (RGBA8 = 4 o) + Normales (RGB10A2 = 4 o) + Matériau (RG8 = 2 o) + Depth (4 o) = 14 octets
  // Écritures G-Buffer + lectures Shading pass = ~28 octets par pixel
  const forwardBufferBytes = pixelCount * 28;

  return {
    primitiveIdBufferBytes,
    materialIdBufferBytes: 0,
    depthBufferBytes,
    forwardBufferBytes,
    deferredBufferBytes,
    shadingCostMs: null,
    overdrawAvoided: null,
    materialLookupMs: null,
  };
}

function nullableMean(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / values.length;
}

function validateExecution(execution: VisibilityExecution): void {
  if (execution.expectedIds.length !== execution.actualIds.length || execution.expectedDepth.length !== execution.actualDepth.length) throw new Error('Visibility correctness gate failed: readback lengths differ');
  for (let index = 0; index < execution.expectedIds.length; index++) if (execution.expectedIds[index] !== execution.actualIds[index]) throw new Error(`Visibility correctness gate failed: ID mismatch at ${index}`);
  for (let index = 0; index < execution.expectedDepth.length; index++) if (Math.abs(execution.expectedDepth[index] - execution.actualDepth[index]) > 1e-5) throw new Error(`Visibility correctness gate failed: depth mismatch at ${index}`);
}

export interface VisibilityCampaignOptions {
  objectCounts: number[]; warmup: number; samples: number; signal?: AbortSignal;
  onProgress?: (event: VisibilityProgress) => void;
  execute: (input: { objectCount: number; sample: number; warmup: boolean; signal?: AbortSignal }) => Promise<VisibilityExecution>;
}

export async function runVisibilityCampaign(options: VisibilityCampaignOptions): Promise<{ records: Array<{
  objectCount: number; correct: true; validSamples: number; visibilityMs: number | null; shadingMs: number | null;
  forwardMs: number | null; materialLookupMs: number | null; overdrawAvoided: number | null;
}> }> {
  const records = []; const total = options.objectCounts.length;
  for (let tier = 0; tier < total; tier++) {
    const objectCount = options.objectCounts[tier];
    if (options.signal?.aborted) throw new DOMException('Visibility campaign aborted', 'AbortError');
    options.onProgress?.({ stage: 'warmup', completed: tier, total, objectCount });
    for (let sample = 0; sample < options.warmup; sample++) await options.execute({ objectCount, sample, warmup: true, signal: options.signal });
    options.onProgress?.({ stage: 'visibility', completed: tier, total, objectCount });
    const executions: VisibilityExecution[] = [];
    for (let sample = 0; sample < options.samples; sample++) {
      const execution = await options.execute({ objectCount, sample, warmup: false, signal: options.signal });
      validateExecution(execution); executions.push(execution);
    }
    options.onProgress?.({ stage: 'shading', completed: tier + 1, total, objectCount });
    records.push({ objectCount, correct: true as const, validSamples: executions.length,
      visibilityMs: nullableMean(executions.map((value) => value.visibilityMs)), shadingMs: nullableMean(executions.map((value) => value.shadingMs)),
      forwardMs: nullableMean(executions.map((value) => value.forwardMs)), materialLookupMs: nullableMean(executions.map((value) => value.materialLookupMs)),
      overdrawAvoided: nullableMean(executions.map((value) => value.forwardFragments > 0 ? 1 - value.shadedPixels / value.forwardFragments : null)) });
  }
  options.onProgress?.({ stage: 'complete', completed: total, total });
  return { records };
}

/**
 * Shaders WGSL pour Passe 1 (Raster ID) et Passe 2 (Compute Shading).
 */
export const WGSL_VISIBILITY_PASS1 = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) @interpolate(flat) visibilityId : u32,
};

@fragment
fn fs_main(in : VertexOutput) -> @location(0) u32 {
  return in.visibilityId + 1u;
}
`;

export const WGSL_VISIBILITY_PASS2 = /* wgsl */ `
@group(0) @binding(0) var visibilityTexture : texture_2d<u32>;
@group(0) @binding(1) var depthTexture : texture_depth_2d;
@group(0) @binding(2) var outputColor : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn cs_main(@builtin(global_invocation_id) id : vec3<u32>) {
  let coord = vec2<i32>(id.xy);
  let dims = textureDimensions(visibilityTexture);
  if (coord.x >= dims.x || coord.y >= dims.y) { return; }

  let visId = textureLoad(visibilityTexture, coord, 0).r;
  if (visId == 0u) {
    textureStore(outputColor, coord, vec4<f32>(0.05, 0.05, 0.08, 1.0)); // Fond
    return;
  }

  let packedGeometryId = visId - 1u;
  let instanceId = packedGeometryId >> 16u;
  let primitiveId = packedGeometryId & 0xFFFFu;

  // Shading différé à overdraw zéro
  textureStore(outputColor, coord, vec4<f32>(0.8, 0.5, 0.2, 1.0));
}
`;
