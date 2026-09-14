/**
 * Host-side blending only: no lighting algorithm lives here. The SDK solves states A and B;
 * this module mixes their public Float64Array outputs and checks the mix against its own claim.
 */

/** alpha(t) for t < 0 is always 0 (pure A); callers guard that themselves before calling this. */
export function delayAlpha(elapsedMs: number, delayMs: number, targetConvergence: number): number {
  if (elapsedMs <= 0) return 0;
  if (delayMs <= 0) return 1;
  const rate = -Math.log(1 - targetConvergence) / delayMs;
  return 1 - Math.exp(-rate * elapsedMs);
}

/** out[i] = a[i] + (b[i] - a[i]) * alpha; out may alias a scratch buffer reused every frame. */
export function blendArrays(a: Float64Array, b: Float64Array, alpha: number, out: Float64Array): void {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * alpha;
}

export function maxAbsDifference(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = Math.abs(a[i] - b[i]);
    if (delta > max) max = delta;
  }
  return max;
}

/** Tracks the first simulated instant (ms after t0) where the blend's error against B drops under the threshold. */
export function createTau95Tracker(amplitude: number, errorThreshold: number) {
  let crossedAtMs: number | null = null;
  return {
    /** Call once per post-t0 frame, in increasing simTimeMs order. */
    observe(blended: Float64Array, target: Float64Array, simTimeMs: number): void {
      if (crossedAtMs !== null) return;
      const ratio = amplitude > 0 ? maxAbsDifference(blended, target) / amplitude : 0;
      if (ratio <= errorThreshold) crossedAtMs = simTimeMs;
    },
    result(): number | null {
      return crossedAtMs;
    },
  };
}
