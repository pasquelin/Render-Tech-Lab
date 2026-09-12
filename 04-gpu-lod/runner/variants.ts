import type { CpuLodSelectionResult } from '../implementation/cpuLodSelector.ts';
import {
  DEFAULT_LOD_THRESHOLDS,
  evaluateLodTier,
  type LodThresholds,
} from '../../shared/math/screenSpaceError.ts';

/** Same guards and operation order as calculateScreenSpacePixels. */
export function preparedScreenSpacePixels(
  diameter: number,
  distance: number,
  screenHeight: number,
  fovRad: number,
  halfFovTan: number
): number {
  if (distance <= 0.0001) return Infinity;
  if (diameter <= 0 || screenHeight <= 0 || fovRad <= 0) return 0;
  if (halfFovTan <= 0) return 0;
  return (diameter * screenHeight) / (2 * distance * halfFovTan);
}

/** Benchmark B: original allocations, guards, arithmetic and counters; one tan per call. */
export function selectLodsPrepared(
  positions: Float32Array,
  radii: Float32Array,
  cameraPos: [number, number, number],
  screenHeight: number,
  fovRad: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS
): CpuLodSelectionResult {
  const tStart = performance.now();
  const count = radii.length;
  const selectedLods = new Uint8Array(count);
  const lodCounts: [number, number, number] = [0, 0, 0];
  const [cx, cy, cz] = cameraPos;
  const halfFovTan = Math.tan(fovRad * 0.5);
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const diameter = radii[i] * 2;
    const projectedPixels = preparedScreenSpacePixels(diameter, distance, screenHeight, fovRad, halfFovTan);
    const tier = evaluateLodTier(projectedPixels, thresholds);
    selectedLods[i] = tier;
    lodCounts[tier]++;
  }
  return { lodCounts, durationMs: performance.now() - tStart, selectedLods };
}

/**
 * C is an experimental benchmark, not a portable ECMAScript certificate.
 * The derivation requires binary64 round-to-nearest arithmetic and sqrt relative
 * error <= 2^-53 on the tested engine. ECMAScript does not promise this sqrt bound.
 * Differential tests establish observed equality, not that runtime assumption.
 */
export const GUARDED_VARIANT_ASSUMPTIONS = {
  status: 'experimental-conditional' as const,
  arithmetic: 'binary64 round-to-nearest; sqrt relative error at most 2^-53',
  portableCertificate: false,
  fallback: 'original-order prepared-tangent formula near cutoffs or outside bounded domain',
};

const LOWER_MAGNITUDE = 2 ** -100;
const UPPER_MAGNITUDE = 2 ** 100;
const SAFE_NEAR_SQUARED = 4 * 0.0001 * 0.0001;
const ROUNDING_BAND = 16 * Number.EPSILON;
const bounded = (value: number): boolean => value >= LOWER_MAGNITUDE && value <= UPPER_MAGNITUDE;

/**
 * For N=fl(diameter*height), T=tan, threshold t and computed distance squared S:
 * P=(N/(2*T*sqrt(S)))*a, a in [(1-u)/(1+u)^2,(1+u)/(1-u)^2].
 * C=fl(fl(N*fl(1/fl(2*T*t)))^2) = (N/(2*T*t))^2*b,
 * b in [(1-u)^5/(1+u)^2,(1+u)^5/(1-u)^2], u=2^-53.
 * Safe decision boundaries relative to C are (1-u)^4/(1+u)^9 and
 * (1+u)^4/(1-u)^9. fl(C*(1 +/- 32u)) encloses both including its own
 * rounding; variants.test.ts verifies the exact rational inequalities.
 * Every intermediate stays normal/finite when N,T,t,S are in [2^-100,2^100].
 * S>4*(1e-4)^2 excludes the original near-distance guard. All other cases,
 * including the uncertainty band and its endpoints, use the original formula.
 * No image tolerance or changed LOD threshold is introduced.
 */
export function selectLodsGuarded(
  positions: Float32Array,
  radii: Float32Array,
  cameraPos: [number, number, number],
  screenHeight: number,
  fovRad: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS
): CpuLodSelectionResult {
  const tStart = performance.now();
  const count = radii.length;
  const selectedLods = new Uint8Array(count);
  const lodCounts: [number, number, number] = [0, 0, 0];
  const [cx, cy, cz] = cameraPos;
  const halfFovTan = Math.tan(fovRad * 0.5);
  const lod0 = thresholds.lod0;
  const lod1 = thresholds.lod1;
  const ready = screenHeight > 0 && fovRad > 0 && bounded(halfFovTan) && bounded(lod0) && bounded(lod1);
  const inverse0 = ready ? 1 / ((2 * halfFovTan) * lod0) : 0;
  const inverse1 = ready ? 1 / ((2 * halfFovTan) * lod1) : 0;
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const squared = dx * dx + dy * dy + dz * dz;
    const diameter = radii[i] * 2;
    let tier = -1;
    if (ready && squared > SAFE_NEAR_SQUARED && bounded(squared) && diameter > 0) {
      const numerator = diameter * screenHeight;
      if (bounded(numerator)) {
        const distance0 = numerator * inverse0;
        const cutoff0 = distance0 * distance0;
        if (squared < cutoff0 * (1 - ROUNDING_BAND)) tier = 0;
        else if (squared > cutoff0 * (1 + ROUNDING_BAND)) {
          const distance1 = numerator * inverse1;
          const cutoff1 = distance1 * distance1;
          if (squared < cutoff1 * (1 - ROUNDING_BAND)) tier = 1;
          else if (squared > cutoff1 * (1 + ROUNDING_BAND)) tier = 2;
        }
      }
    }
    if (tier < 0) {
      const pixels = preparedScreenSpacePixels(diameter, Math.sqrt(squared), screenHeight, fovRad, halfFovTan);
      tier = evaluateLodTier(pixels, thresholds);
    }
    selectedLods[i] = tier;
    lodCounts[tier]++;
  }
  return { lodCounts, durationMs: performance.now() - tStart, selectedLods };
}
