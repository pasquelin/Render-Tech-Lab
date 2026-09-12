/**
 * 10-material-batching/implementation/materialBatcher.ts
 *
 * Implémentation des 4 stratégies de matérialisation et du compactage
 * de la table des matériaux en tampon de stockage GPU (Storage Buffer).
 */

import type {
  MaterialDef,
  BatchingInput,
  BatchingOutput,
  MaterialCampaignProgress,
  MaterialCampaignRecord,
  MaterialMeasurement,
  MaterialSubmissionPlan,
  MaterialBatchingStrategy,
} from '../contracts.ts';

/**
 * Taille binaire d'un matériau dans la table GPU (alignement vec4 WGSL) :
 * vec4<f32> albedoOpacity [r, g, b, opacity] (16 o)
 * vec4<f32> surfaceProps  [roughness, metallic, textureId, flags] (16 o)
 * = 32 octets par matériau.
 */
export const BYTES_PER_MATERIAL = 32;

/**
 * Génère une collection déterministe de définitions de matériaux.
 */
export function generateMaterialPalette(count: number): MaterialDef[] {
  const materials: MaterialDef[] = [];
  for (let i = 0; i < count; i++) {
    materials.push({
      id: i,
      albedo: [
        ((i * 37) % 255) / 255,
        ((i * 97) % 255) / 255,
        ((i * 193) % 255) / 255,
      ],
      roughness: 0.1 + ((i % 10) / 10) * 0.8,
      metallic: (i % 5) === 0 ? 0.9 : 0.1,
      opacity: 1.0,
      textureId: i % 16,
    });
  }
  return materials;
}

/**
 * Compacte la table de matériaux en Float32Array prêt pour l'envoi GPU.
 */
export function packMaterialStorageBuffer(materials: MaterialDef[]): Float32Array {
  const floatsPerMaterial = BYTES_PER_MATERIAL / 4; // 8 floats
  const buffer = new Float32Array(materials.length * floatsPerMaterial);

  for (let i = 0; i < materials.length; i++) {
    const o = i * floatsPerMaterial;
    const m = materials[i];

    // albedoOpacity
    buffer[o + 0] = m.albedo[0];
    buffer[o + 1] = m.albedo[1];
    buffer[o + 2] = m.albedo[2];
    buffer[o + 3] = m.opacity;

    // surfaceProps
    buffer[o + 4] = m.roughness;
    buffer[o + 5] = m.metallic;
    buffer[o + 6] = m.textureId ?? -1;
    buffer[o + 7] = 0.0; // padding / flags
  }

  return buffer;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

export function buildMaterialSubmissionPlan(drawMaterialIds: readonly number[], strategy: MaterialBatchingStrategy): MaterialSubmissionPlan {
  const ids = Array.from(drawMaterialIds);
  ids.forEach((id) => assertNonNegativeInteger(id, 'materialId'));
  const batches: MaterialSubmissionPlan['batches'] = [];
  if (strategy === 'state-switch') {
    for (let index = 0; index < ids.length; index++) {
      const materialId = ids[index];
      const previous = batches.at(-1);
      if (previous?.materialId === materialId) previous.drawCount++;
      else batches.push({ materialId, firstDraw: index, drawCount: 1 });
    }
  } else if (ids.length > 0) batches.push({ materialId: -1, firstDraw: 0, drawCount: ids.length });
  return { strategy, drawCount: ids.length, drawMaterialIds: ids, batches,
    pipelineStateChanges: batches.length, bindGroupChanges: batches.length };
}

function deterministicMaterialIds(objectCount: number, materialCount: number): number[] {
  assertNonNegativeInteger(objectCount, 'objectCount');
  if (!Number.isSafeInteger(materialCount) || materialCount < 1) throw new RangeError('materialCount must be positive');
  return Array.from({ length: objectCount }, (_, index) => ((index * 2654435761) >>> 0) % materialCount);
}

function nullableMean(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / values.length;
}

export interface MaterialCampaignOptions {
  materialCounts: number[]; objectCount: number; strategies: MaterialBatchingStrategy[];
  warmup: number; samples: number; signal?: AbortSignal;
  onProgress?: (progress: MaterialCampaignProgress) => void;
  measure: (input: { plan: MaterialSubmissionPlan; sample: number; warmup: boolean }) => Promise<MaterialMeasurement>;
}

export async function runMaterialBatchingCampaign(options: MaterialCampaignOptions): Promise<{
  completed: number; total: number; records: MaterialCampaignRecord[];
}> {
  assertNonNegativeInteger(options.warmup, 'warmup');
  if (!Number.isSafeInteger(options.samples) || options.samples < 1) throw new RangeError('samples must be positive');
  const total = options.materialCounts.length * options.strategies.length;
  const records: MaterialCampaignRecord[] = [];
  let completed = 0;
  const ensureActive = () => { if (options.signal?.aborted) throw new DOMException('Material batching campaign aborted', 'AbortError'); };
  for (const materialCount of options.materialCounts) {
    const ids = deterministicMaterialIds(options.objectCount, materialCount);
    let referenceDigest: string | null = null;
    for (const strategy of options.strategies) {
      ensureActive();
      const plan = buildMaterialSubmissionPlan(ids, strategy);
      options.onProgress?.({ stage: 'warmup', completed, total, strategy, materialCount });
      for (let sample = 0; sample < options.warmup; sample++) { await options.measure({ plan, sample, warmup: true }); ensureActive(); }
      options.onProgress?.({ stage: 'measure', completed, total, strategy, materialCount });
      const measurements: MaterialMeasurement[] = [];
      for (let sample = 0; sample < options.samples; sample++) { measurements.push(await options.measure({ plan, sample, warmup: false })); ensureActive(); }
      if (measurements.some((value) => value.submittedDraws !== plan.drawCount)) throw new Error('Material batching correctness gate failed: submitted draw count differs from plan');
      const digests = new Set(measurements.map((value) => value.correctnessDigest));
      if (digests.size !== 1 || [...digests][0].length === 0) throw new Error('Material batching correctness gate failed: output is unstable');
      const digest = [...digests][0];
      if (referenceDigest === null) referenceDigest = digest;
      else if (digest !== referenceDigest) throw new Error('Material batching correctness gate failed: strategy output differs from baseline');
      records.push({ ...evaluateBatchingStrategy({ objects: options.objectCount, materialCount, strategy }),
        pipelineStateChanges: plan.pipelineStateChanges, bindGroupChanges: plan.bindGroupChanges,
        cpuFrameMs: nullableMean(measurements.map((value) => value.cpuFrameMs)), gpuFrameMs: nullableMean(measurements.map((value) => value.gpuFrameMs)),
        validSamples: measurements.length, submittedDraws: plan.drawCount });
      completed++;
      options.onProgress?.({ stage: 'measure', completed, total, strategy, materialCount });
    }
  }
  options.onProgress?.({ stage: 'complete', completed, total });
  return { completed, total, records };
}

/**
 * Simule le coût et les métriques de soumission pour une stratégie donnée.
 */
export function evaluateBatchingStrategy(input: BatchingInput): BatchingOutput {
  const { objects, materialCount, strategy } = input;
  const tableBytes = materialCount * BYTES_PER_MATERIAL;

  assertNonNegativeInteger(objects, 'objects');
  if (!Number.isSafeInteger(materialCount) || materialCount < 1) throw new RangeError('materialCount must be positive');
  let pipelineStateChanges = objects === 0 ? 0 : 1;
  let bindGroupChanges = objects === 0 ? 0 : 1;

  switch (strategy) {
    case 'state-switch':
      // 1 switch de pipeline par matériau distinct + 1 bindgroup change
      pipelineStateChanges = materialCount;
      bindGroupChanges = materialCount;
      // Coût CPU Three.js standard : ~3µs par changement d'état + validation
      break;

    case 'storage-buffer':
      // 1 seul pipeline, 1 seul bindgroup contenant le storage buffer
      pipelineStateChanges = 1;
      bindGroupChanges = 1;
      // Lookup dynamique dans le shader GPU : coût minime
      break;

    case 'texture-array':
      pipelineStateChanges = 1;
      bindGroupChanges = 1;
      break;

    case 'pseudo-bindless':
      pipelineStateChanges = 1;
      bindGroupChanges = 1;
      break;
  }

  return {
    strategy,
    objectCount: objects,
    materialCount,
    pipelineStateChanges,
    bindGroupChanges,
    cpuFrameMs: null,
    gpuFrameMs: null,
    materialTableBytes: tableBytes,
  };
}

/**
 * Shader WGSL pour l'accès aux matériaux par Storage Buffer.
 */
export const WGSL_MATERIAL_STORAGE_BUFFER = /* wgsl */ `
struct MaterialData {
  albedoOpacity : vec4<f32>,
  surfaceProps  : vec4<f32>,
};

@group(0) @binding(0) var<storage, read> materials : array<MaterialData>;

fn getMaterial(materialId : u32) -> MaterialData {
  return materials[materialId];
}
`;
