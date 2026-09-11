struct CameraUniforms {
  viewProj: mat4x4<f32>,
  frustumPlanes: array<vec4<f32>, 6>,
};

struct GPUObject {
  transform: mat4x4<f32>,
  boundingCenterRadius: vec4<f32>, // xyz: centre local, w: rayon local
  geometryId: u32,
  materialId: u32,
  flags: u32,
  padding: u32,
};

struct GPUGeometry {
  vertexOffset: u32,
  indexOffset: u32,
  indexCount: u32,
  instanceOffset: u32,
  boundingRadius: f32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

struct DrawIndexedIndirectCommand {
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: i32,
  firstInstance: u32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> objects: array<GPUObject>;
@group(0) @binding(2) var<storage, read> geometries: array<GPUGeometry>;
@group(0) @binding(3) var<storage, read_write> drawCommands: array<DrawIndexedIndirectCommand>;
@group(0) @binding(4) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(5) var<storage, read_write> globalCounters: array<atomic<u32>, 4>; // [0]=visibleCount, [1]=culledCount

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let objectIndex = global_id.x;
  let totalObjects = arrayLength(&objects);

  if (objectIndex >= totalObjects) {
    return;
  }

  let obj = objects[objectIndex];

  // 1. Transformation du centre englobant dans l'espace monde
  let localCenter = vec4<f32>(obj.boundingCenterRadius.xyz, 1.0);
  let worldCenter = (obj.transform * localCenter).xyz;

  // Calcul du rayon mondial avec facteur d'échelle
  let scaleX = length(vec3<f32>(obj.transform[0][0], obj.transform[0][1], obj.transform[0][2]));
  let scaleY = length(vec3<f32>(obj.transform[1][0], obj.transform[1][1], obj.transform[1][2]));
  let scaleZ = length(vec3<f32>(obj.transform[2][0], obj.transform[2][1], obj.transform[2][2]));
  let maxScale = max(scaleX, max(scaleY, scaleZ));
  let worldRadius = obj.boundingCenterRadius.w * maxScale;

  // 2. Test contre les 6 plans du cône de vue (Frustum Culling)
  var isVisible = true;
  for (var i = 0u; i < 6u; i = i + 1u) {
    let plane = camera.frustumPlanes[i];
    let dist = dot(plane.xyz, worldCenter) + plane.w;
    if (dist < -worldRadius) {
      isVisible = false;
      break;
    }
  }

  // 3. Traitement du résultat de visibilité
  if (!isVisible) {
    atomicAdd(&globalCounters[1], 1u);
    return;
  }

  // L'objet est visible :
  atomicAdd(&globalCounters[0], 1u);

  // Allocation d'un slot d'instance compacté propre à la géométrie de cet objet
  let geomId = obj.geometryId;
  let geom = geometries[geomId];
  let localSlot = atomicAdd(&drawCommands[geomId].instanceCount, 1u);
  let targetSlot = geom.instanceOffset + localSlot;
  visibleIndices[targetSlot] = objectIndex;
}
