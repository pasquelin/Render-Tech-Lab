/**
 * 04-gpu-lod/gpuLodShader.ts
 *
 * 04C : Compute Shader WGSL de sélection Screen-Space Error (SSE) sur GPU.
 * Évalue la taille projetée par instance et sélectionne le niveau de détail
 * directement en VRAM sans aller-retour CPU.
 */

export const GPU_LOD_SELECTION_SHADER = /* wgsl */ `
struct CameraUniforms {
  cameraPosition : vec4<f32>, // xyz, w = non utilisé
  screenParams   : vec4<f32>, // x = screenHeight, y = halfFovTan, z = thresholdLod0 (250.0), w = thresholdLod1 (60.0)
};

struct ObjectData {
  transformCol0 : vec4<f32>,
  transformCol1 : vec4<f32>,
  transformCol2 : vec4<f32>,
  transformCol3 : vec4<f32>,
  boundingCenterRadius : vec4<f32>, // xyz = center, w = radius
  meta          : vec4<u32>,        // x = geometryId, y = materialId, z = flags, w = padding
};

struct LodSelectionResult {
  selectedLod     : u32,
  projectedPixels : f32,
  padding0        : u32,
  padding1        : u32,
};

struct LodCounters {
  lod0Count : atomic<u32>,
  lod1Count : atomic<u32>,
  lod2Count : atomic<u32>,
  totalProcessed : atomic<u32>,
};

@group(0) @binding(0) var<uniform> camera : CameraUniforms;
@group(0) @binding(1) var<storage, read> objects : array<ObjectData>;
@group(0) @binding(2) var<storage, read_write> selections : array<LodSelectionResult>;
@group(0) @binding(3) var<storage, read_write> counters : LodCounters;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&objects)) {
    return;
  }

  let obj = objects[index];
  let center = obj.boundingCenterRadius.xyz;
  let radius = obj.boundingCenterRadius.w;

  // Calcul de la distance euclidienne objet-caméra
  let camPos = camera.cameraPosition.xyz;
  let diff = center - camPos;
  let distance = max(0.0001, length(diff));

  let screenHeight = camera.screenParams.x;
  let halfFovTan   = camera.screenParams.y;
  let threshLod0   = camera.screenParams.z; // 250.0 px
  let threshLod1   = camera.screenParams.w; // 60.0 px

  // Formule Screen-Space Error canonique : pixels = (2 * R * H) / (2 * d * tan(FOV/2))
  let diameter = radius * 2.0;
  let projectedPixels = (diameter * screenHeight) / (2.0 * distance * halfFovTan);

  // Évaluation du niveau LOD
  var lod : u32 = 2u;
  if (projectedPixels > threshLod0) {
    lod = 0u;
    atomicAdd(&counters.lod0Count, 1u);
  } else if (projectedPixels > threshLod1) {
    lod = 1u;
    atomicAdd(&counters.lod1Count, 1u);
  } else {
    lod = 2u;
    atomicAdd(&counters.lod2Count, 1u);
  }

  atomicAdd(&counters.totalProcessed, 1u);

  // Écriture du résultat direct en storage buffer
  selections[index].selectedLod = lod;
  selections[index].projectedPixels = projectedPixels;
}
`;
