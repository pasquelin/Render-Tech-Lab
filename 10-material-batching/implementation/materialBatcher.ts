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
} from '../types.ts';

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

/**
 * Simule le coût et les métriques de soumission pour une stratégie donnée.
 */
export function evaluateBatchingStrategy(input: BatchingInput): BatchingOutput {
  const { objects, materialCount, strategy } = input;
  const tableBytes = materialCount * BYTES_PER_MATERIAL;

  let pipelineStateChanges = 0;
  let bindGroupChanges = 0;

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
