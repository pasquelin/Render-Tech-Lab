import type { WorldMode } from '../contracts.ts';

export type PlaneLike = { normal: { x: number; y: number; z: number }; constant: number; distanceToPoint(point: { x: number; y: number; z: number }): number };
export type AdaptiveEntry = {
  center: { x: number; y: number; z: number };
  radius: number;
  centerLength: number;
  lastPlane: number;
  margin: number;
};
export type CoherenceState = { previousPlanes: Float64Array; havePreviousPlanes: boolean };
export type AdaptiveDecision = { visible: boolean; certified: boolean; planeTests: number };

export function centerLengthOf(center: { x: number; y: number; z: number }): number {
  return Math.hypot(center.x, center.y, center.z) * (1 + 16 * Number.EPSILON) + 16 * Number.EPSILON;
}

export function rejectingPlaneIndex(lastPlane: number, step: number): number {
  return step === 0 ? lastPlane : step <= lastPlane ? step - 1 : step;
}

export function resetAdaptiveEntry(entry: AdaptiveEntry): void {
  entry.lastPlane = 0;
  entry.margin = -Infinity;
}

export function prepareCoherence(planes: readonly PlaneLike[], state: CoherenceState): { deltaNormal: number; deltaConstant: number; constantScale: number } {
  let deltaNormal = 0, deltaConstant = 0, constantScale = 1;
  for (let i = 0; i < 6; i++) {
    const plane = planes[i], k = i * 4;
    if (state.havePreviousPlanes) {
      deltaNormal = Math.max(deltaNormal, Math.hypot(
        plane.normal.x - state.previousPlanes[k],
        plane.normal.y - state.previousPlanes[k + 1],
        plane.normal.z - state.previousPlanes[k + 2],
      ));
      deltaConstant = Math.max(deltaConstant, Math.abs(plane.constant - state.previousPlanes[k + 3]));
    }
    constantScale = Math.max(constantScale, Math.abs(plane.constant), Math.abs(state.previousPlanes[k + 3]));
    state.previousPlanes[k] = plane.normal.x;
    state.previousPlanes[k + 1] = plane.normal.y;
    state.previousPlanes[k + 2] = plane.normal.z;
    state.previousPlanes[k + 3] = plane.constant;
  }
  deltaNormal += 64 * Number.EPSILON;
  deltaConstant += 64 * Number.EPSILON * constantScale;
  state.havePreviousPlanes = true;
  return { deltaNormal, deltaConstant, constantScale };
}

export function adaptiveVisible(
  entry: AdaptiveEntry,
  planes: readonly PlaneLike[],
  mode: Extract<WorldMode, 'adaptive-frustum' | 'adaptive-coherent'>,
  deltaNormal: number,
  deltaConstant: number,
  constantScale: number,
): AdaptiveDecision {
  const rounding = 64 * Number.EPSILON * (entry.centerLength + entry.radius + constantScale + 1);
  if (mode === 'adaptive-coherent') {
    entry.margin -= deltaNormal * entry.centerLength + deltaConstant + rounding;
    if (entry.margin > 0) return { visible: true, certified: true, planeTests: 0 };
  }
  let margin = Infinity, planeTests = 0;
  const first = entry.lastPlane;
  for (let step = 0; step < 6; step++) {
    const i = rejectingPlaneIndex(first, step);
    planeTests++;
    const distance = planes[i].distanceToPoint(entry.center);
    if (distance < -entry.radius) {
      entry.lastPlane = i;
      entry.margin = -Infinity;
      return { visible: false, certified: false, planeTests };
    }
    margin = Math.min(margin, distance + entry.radius);
  }
  entry.margin = margin - rounding;
  return { visible: true, certified: false, planeTests };
}
