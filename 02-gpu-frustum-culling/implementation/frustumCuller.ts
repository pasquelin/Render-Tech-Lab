/**
 * 02-gpu-frustum-culling/implementation/frustumCuller.ts
 *
 * Implémentation du culling frustum CPU et shader de culling GPU (WGSL).
 * Réutilise les primitives géométriques de shared/math.
 */

import { dot } from '../../shared/math/geometry.ts';
import type {
  FrustumPlane,
  CullingBoundingSphere,
  CullingInstance,
  CullingBatchResult,
} from '../contracts.ts';

/**
 * Test conservateur sphère / plan :
 * Renvoie true si la sphère est strictement hors du frustum (distance < -radius).
 */
export function isSphereOutsidePlane(
  sphere: CullingBoundingSphere,
  plane: FrustumPlane
): boolean {
  const dist = dot(plane.normal, sphere.center) + plane.offset;
  return dist < -sphere.radius;
}

/**
 * Test conservateur d'intersection sphère englobante / frustum à 6 plans.
 * Renvoie true si la sphère est VISIBLE (ou coupe au moins un plan).
 */
export function cullBoundingSphereAgainstFrustum(
  sphere: CullingBoundingSphere,
  planes: FrustumPlane[]
): boolean {
  for (let i = 0; i < planes.length; i++) {
    if (isSphereOutsidePlane(sphere, planes[i])) {
      return false; // Rejeté par au moins un plan
    }
  }
  return true; // Visible ou sécant
}

/**
 * Exécute le culling en lot sur CPU (témoin).
 */
export function cullInstancesCPU(
  instances: CullingInstance[],
  planes: FrustumPlane[]
): CullingBatchResult {
  const start = performance.now();
  const visibleIndices: number[] = [];

  for (let i = 0; i < instances.length; i++) {
    if (cullBoundingSphereAgainstFrustum(instances[i].boundingSphere, planes)) {
      visibleIndices.push(i);
    }
  }

  const duration = performance.now() - start;
  const visibleCount = visibleIndices.length;
  const culledCount = instances.length - visibleCount;
  const cullRate = instances.length > 0 ? culledCount / instances.length : 0;

  return {
    totalInstances: instances.length,
    visibleCount,
    culledCount,
    cullRate,
    visibleIndices,
    cpuTimeMs: duration,
    gpuTimeMs: null,
  };
}

/**
 * Shader Compute WGSL standardisé pour le culling frustum sur GPU.
 * Compatible WebGPU avec compaction atomique dans le drawIndexedIndirect buffer.
 */
export const WGSL_FRUSTUM_CULLING = /* wgsl */ `
struct InstanceData {
  modelMatrix : mat4x4<f32>,
  sphereCenter : vec3<f32>,
  sphereRadius : f32,
};

struct FrustumPlane {
  normal : vec3<f32>,
  offset : f32,
};

struct FrustumUniforms {
  planes : array<FrustumPlane, 6>,
  totalInstances : u32,
};

struct DrawIndexedIndirectArgs {
  indexCount : u32,
  instanceCount : atomic<u32>,
  firstIndex : u32,
  baseVertex : i32,
  firstInstance : u32,
};

@group(0) @binding(0) var<uniform> uniforms : FrustumUniforms;
@group(0) @binding(1) var<storage, read> instances : array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> indirectDraw : DrawIndexedIndirectArgs;
@group(0) @binding(3) var<storage, read_write> visibleInstanceIndices : array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let index = global_id.x;
  if (index >= uniforms.totalInstances) {
    return;
  }

  let inst = instances[index];
  var visible = true;

  for (var i = 0u; i < 6u; i = i + 1u) {
    let p = uniforms.planes[i];
    let dist = dot(p.normal, inst.sphereCenter) + p.offset;
    if (dist < -inst.sphereRadius) {
      visible = false;
      break;
    }
  }

  if (visible) {
    let slot = atomicAdd(&indirectDraw.instanceCount, 1u);
    visibleInstanceIndices[slot] = index;
  }
}
`;
