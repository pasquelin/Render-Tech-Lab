/**
 * 06-meshlet-culling/implementation/meshletCuller.ts
 *
 * Implémentation du culling à 3 étages pour les meshlets :
 * 1. Culling Frustum (sphère englobante vs 6 plans)
 * 2. Backface culling de cône de normales (orientation vs caméra)
 * 3. Culling sub-pixel (taille projetée vs seuil en pixels)
 *
 * Réutilise les primitives partagées de shared/math (dot, norm, SSE).
 */

import type { Meshlet } from '../../05-meshlets/types.ts';
import type { CullingInput, CullingOutput, RejectFlag } from '../types.ts';
import { dot, norm } from '../../shared/math/geometry.ts';
import { calculateScreenSpacePixels } from '../../shared/math/screenSpaceError.ts';

/**
 * Test 1 : Culling Frustum conservateur sur la sphère englobante du meshlet.
 * Renvoie true si la sphère est VISIBLE (ou coupe un plan), false si rejetée.
 */
export function testMeshletFrustum(
  meshlet: Meshlet,
  planes: { n: [number, number, number]; d: number }[]
): boolean {
  const { center, radius } = meshlet.boundingSphere;
  for (const plane of planes) {
    const dist = dot(plane.n, center) + plane.d;
    if (dist < -radius) {
      return false; // Rejeté
    }
  }
  return true; // Conservé
}

/**
 * Test 2 : Backface culling de cône de normales.
 * Si tous les triangles font dos à la vue, le cluster est rejeté.
 * Renvoie true si le cône est VISIBLE, false si rejeté (backface).
 */
export function testMeshletBackface(
  meshlet: Meshlet,
  viewPosition: [number, number, number]
): boolean {
  const { apex, axis, cosHalfAngle } = meshlet.normalCone;

  // Vecteur de l'apex vers la caméra
  const viewDir: [number, number, number] = [
    viewPosition[0] - apex[0],
    viewPosition[1] - apex[1],
    viewPosition[2] - apex[2],
  ];
  const viewDist = norm(viewDir);
  if (viewDist < 1e-6) {
    return true; // Caméra sur le meshlet -> visible
  }

  const normalizedView: [number, number, number] = [
    viewDir[0] / viewDist,
    viewDir[1] / viewDist,
    viewDir[2] / viewDist,
  ];

  // Le produit scalaire axis · normalizedView indique l'angle entre le cône moyen et la direction de vue.
  // Si cosHalfAngle est la demi-ouverture, sinHalfAngle = sqrt(1 - cosHalfAngle^2).
  // Le cluster est entièrement orienté dos à la caméra si :
  // dot(axis, normalizedView) < -sqrt(max(0, 1 - cosHalfAngle^2))
  const sinHalfAngle = Math.sqrt(Math.max(0, 1.0 - cosHalfAngle * cosHalfAngle));

  // Si le cône pointe à l'opposé de la vue au-delà de sa demi-ouverture -> dos à la caméra
  if (dot(axis, normalizedView) < -sinHalfAngle) {
    return false; // Rejeté (backface)
  }

  return true; // Potentiellement visible
}

/**
 * Test 3 : Culling de primitive sous-pixel.
 * Renvoie true si le cluster est VISIBLE, false si sub-pixel (< seuil).
 */
export function testMeshletSubPixel(
  meshlet: Meshlet,
  viewPosition: [number, number, number],
  screenHeight: number,
  fovRad: number,
  subPixelThresholdPx: number
): boolean {
  const { center, radius } = meshlet.boundingSphere;
  const dist = norm([
    viewPosition[0] - center[0],
    viewPosition[1] - center[1],
    viewPosition[2] - center[2],
  ]);

  if (dist <= radius) {
    return true; // Caméra à l'intérieur de la sphère
  }

  const diameter = radius * 2;
  const projectedPx = calculateScreenSpacePixels(
    diameter,
    dist,
    screenHeight,
    fovRad
  );

  return projectedPx >= subPixelThresholdPx;
}

/**
 * Exécute la chaîne complète des 3 tests de culling sur une collection de meshlets.
 */
export function cullMeshlets(input: CullingInput): CullingOutput {
  const visible: Meshlet[] = [];
  const rejectReasons: RejectFlag[] = [];
  const rejectCounts = {
    frustum: 0,
    backface: 0,
    subpixel: 0,
    total: 0,
  };

  for (const m of input.meshlets) {
    // 1. Frustum test
    const passFrustum = testMeshletFrustum(m, input.frustumPlanes);
    if (!passFrustum) {
      rejectCounts.frustum++;
      rejectCounts.total++;
      rejectReasons.push(1);
      continue;
    }

    // 2. Backface test
    const passBackface = testMeshletBackface(m, input.viewPosition);
    if (!passBackface) {
      rejectCounts.backface++;
      rejectCounts.total++;
      rejectReasons.push(2);
      continue;
    }

    // 3. Sub-pixel test
    const passSubpixel = testMeshletSubPixel(
      m,
      input.viewPosition,
      input.screenHeight,
      input.fovRad,
      input.subPixelThreshold
    );
    if (!passSubpixel) {
      rejectCounts.subpixel++;
      rejectCounts.total++;
      rejectReasons.push(3);
      continue;
    }

    // Visible après les 3 tests
    visible.push(m);
    rejectReasons.push(0);
  }

  const total = input.meshlets.length;
  const globalRejectRate = total > 0 ? rejectCounts.total / total : 0;

  return {
    visible,
    rejectReasons,
    rejectCounts,
    globalRejectRate,
  };
}

/**
 * Shader Compute WGSL standardisé pour le culling cluster (3 tests).
 */
export const WGSL_MESHLET_CULLING = /* wgsl */ `
struct MeshletBounding {
  sphereCenterRadius : vec4<f32>, // xyz = center, w = radius
  coneApexCutoff     : vec4<f32>, // xyz = apex, w = cosHalfAngle
  coneAxis           : vec4<f32>, // xyz = axis (normalized)
};

struct CullUniforms {
  frustumPlanes : array<vec4<f32>, 6>,
  viewPos : vec4<f32>,
  screenHeight : f32,
  tanHalfFov : f32,
  subPixelThreshold : f32,
  totalMeshlets : u32,
};

@group(0) @binding(0) var<uniform> uniforms : CullUniforms;
@group(0) @binding(1) var<storage, read> meshlets : array<MeshletBounding>;
@group(0) @binding(2) var<storage, read_write> visibleMeshletIndices : array<u32>;
@group(0) @binding(3) var<storage, read_write> visibleCount : atomic<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let index = global_id.x;
  if (index >= uniforms.totalMeshlets) {
    return;
  }

  let m = meshlets[index];
  let center = m.sphereCenterRadius.xyz;
  let radius = m.sphereCenterRadius.w;

  // 1. Frustum Test
  for (var i = 0u; i < 6u; i = i + 1u) {
    let plane = uniforms.frustumPlanes[i];
    let dist = dot(plane.xyz, center) + plane.w;
    if (dist < -radius) {
      return; // Rejeté Frustum
    }
  }

  // 2. Backface Cone Test
  let apex = m.coneApexCutoff.xyz;
  let cosHalfAngle = m.coneApexCutoff.w;
  let axis = m.coneAxis.xyz;
  let viewDir = uniforms.viewPos.xyz - apex;
  let viewDist = length(viewDir);
  if (viewDist > 1e-4) {
    let normView = viewDir / viewDist;
    let sinHalfAngle = sqrt(max(0.0, 1.0 - cosHalfAngle * cosHalfAngle));
    if (dot(axis, normView) < -sinHalfAngle) {
      return; // Rejeté Backface
    }
  }

  // 3. Sub-pixel Test
  let d = max(viewDist, 0.001);
  let diameter = radius * 2.0;
  let projectedPx = (diameter * uniforms.screenHeight) / (2.0 * d * uniforms.tanHalfFov);
  if (projectedPx < uniforms.subPixelThreshold) {
    return; // Rejeté Sub-pixel
  }

  // Meshlet Visible -> compaction
  let slot = atomicAdd(&visibleCount, 1u);
  visibleMeshletIndices[slot] = index;
}
`;
