/**
 * shared/math/oracles.test.ts
 *
 * Banc de test des 30 oracles mathématiques de référence du laboratoire.
 * Porte à l'identique les contrats de files_local/rapport/ORACLES_ET_TESTS.md.
 */

import {
  dot,
  norm,
  sphereUnion,
  aabbOutsidePlane,
  projectedPoint,
  projectedErrorBound,
  quantize,
} from './geometry.ts';
import {
  quadricFromPlanes,
  quadricEnergy,
  quadricCandidate,
} from './qem.ts';
import { exclusiveScan, compact } from './compaction.ts';
import { hizReduceCeil } from './hiz.ts';
import { octEncode, octDecode } from './octahedral.ts';
import {
  edge,
  barycentric,
  perspectiveAttribute,
  perspectiveDerivative,
} from './barycentric.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertAlmostEqual(a: number, b: number, eps: number = 1e-6, message?: string) {
  if (Math.abs(a - b) > eps) {
    throw new Error(
      `AlmostEqual failed: ${a} !== ${b} (diff: ${Math.abs(a - b)}, tol: ${eps}) ${message || ''}`
    );
  }
}

function runOracleTests() {
  console.log('🧪 Exécution des 30 tests oracles mathématiques du laboratoire...');

  // 1. test_qem_known_intersection
  {
    const quadric = quadricFromPlanes([
      [[1, 0, 0, -1], 1],
      [[0, 1, 0, -2], 1],
      [[0, 0, 1, -3], 1],
    ]);
    const optimum = quadricCandidate(quadric, [0, 0, 0], [4, 4, 4]);
    assertAlmostEqual(optimum[0], 1);
    assertAlmostEqual(optimum[1], 2);
    assertAlmostEqual(optimum[2], 3);
    assertAlmostEqual(quadricEnergy(quadric, optimum), 0);
  }

  // 2. test_qem_singular_fallback
  {
    const quadric = quadricFromPlanes([[[0, 0, 1, 0], 1]]);
    const candidate = quadricCandidate(quadric, [0, 0, 1], [1, 1, -1]);
    assertAlmostEqual(candidate[0], 0.5);
    assertAlmostEqual(candidate[1], 0.5);
    assertAlmostEqual(candidate[2], 0.0);
  }

  // 3. test_qem_energy_matches_plane_distance
  {
    const quadric = quadricFromPlanes([[[0.6, 0.8, 0, -2], 3]]);
    const point = [4, 5, 6];
    assertAlmostEqual(
      quadricEnergy(quadric, point),
      3 * (0.6 * 4 + 0.8 * 5 - 2) ** 2
    );
  }

  // 4. test_qem_rejects_non_normalized_input
  {
    let caught = false;
    try {
      quadricFromPlanes([[[2, 0, 0, 0], 1]]);
    } catch {
      caught = true;
    }
    assert(caught, 'QEM must reject unnormalized planes');
  }

  // 5. test_max_error_is_not_cumulative_bound
  {
    const d1 = 0.001;
    const d2 = 0.001;
    assert(d1 + d2 > Math.max(d1, d2), 'Cumulative error must exceed max error');
  }

  // 6. test_focal_example
  {
    const focal = 1080 / (2 * Math.tan(Math.PI / 6));
    assertAlmostEqual((focal * 0.01) / 10, 0.935307436, 1e-7);
  }

  // 7. test_projected_bound_random_pairs
  {
    let seed = 20260911;
    function pseudoRandom() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    const minimum = [-8, -5, 2];
    const maximum = [7, 9, 30];
    const focal: [number, number] = [900, 1100];

    for (let i = 0; i < 2000; i++) {
      const first = [
        minimum[0] + pseudoRandom() * (maximum[0] - minimum[0]),
        minimum[1] + pseudoRandom() * (maximum[1] - minimum[1]),
        minimum[2] + pseudoRandom() * (maximum[2] - minimum[2]),
      ];
      const second = [
        minimum[0] + pseudoRandom() * (maximum[0] - minimum[0]),
        minimum[1] + pseudoRandom() * (maximum[1] - minimum[1]),
        minimum[2] + pseudoRandom() * (maximum[2] - minimum[2]),
      ];
      const error = norm([
        second[0] - first[0],
        second[1] - first[1],
        second[2] - first[2],
      ]);
      const bound = projectedErrorBound(error, minimum, maximum, focal);
      const projFirst = projectedPoint(first, focal);
      const projSecond = projectedPoint(second, focal);
      const observed = norm([
        projSecond[0] - projFirst[0],
        projSecond[1] - projFirst[1],
      ]);
      assert(
        observed <= bound + 1e-9,
        `Projected error ${observed} exceeds bound ${bound}`
      );
    }
  }

  // 8. test_radial_distance_underestimates_off_axis
  {
    const first = [10, 0, 10];
    const second = [10, 0, 10.01];
    const focal: [number, number] = [1000, 1000];
    const observed = Math.abs(
      projectedPoint(first, focal)[0] - projectedPoint(second, focal)[0]
    );
    const radialApproximation = (1000 * 0.01) / norm(first);
    assert(
      observed > radialApproximation,
      'Radial distance underestimates off-axis projection'
    );
  }

  // 9. test_near_plane_requests_refinement
  {
    assert(
      !Number.isFinite(
        projectedErrorBound(0.01, [-1, -1, 0], [1, 1, 3], [900, 900])
      ),
      'Near plane bounds must be infinite'
    );
  }

  // 10. test_nested_bounds_project_monotonically
  {
    const child = projectedErrorBound(
      0.01,
      [-1, -1, 10],
      [1, 1, 12],
      [900, 900]
    );
    const parent = projectedErrorBound(
      0.02,
      [-3, -3, 8],
      [3, 3, 15],
      [900, 900]
    );
    assert(parent >= child, 'Parent bound must be >= child bound');
  }

  // 11. test_shear_max_column_not_spectral_bound
  {
    const dir = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];
    const transformed = [dir[0] + dir[1], dir[1], 0];
    const maxColumn = Math.sqrt(2);
    assert(norm(transformed) > maxColumn - 1e-7, 'Shear norm check');
  }

  // 12. test_sphere_union_contains_both
  {
    const [center, radius] = sphereUnion([0, 0, 0], 1, [4, 0, 0], 1);
    assertAlmostEqual(center[0], 2);
    assertAlmostEqual(center[1], 0);
    assertAlmostEqual(center[2], 0);
    assertAlmostEqual(radius, 3);
    assert(norm(center) + 1 <= radius + 1e-9, 'Sphere union contains first');
  }

  // 13. test_sphere_union_coincident
  {
    const [center, radius] = sphereUnion([0, 0, 0], 1, [0, 0, 0], 2);
    assertAlmostEqual(center[0], 0);
    assertAlmostEqual(radius, 2);
  }

  // 14. test_aabb_plane_equals_corner_maximum
  {
    const center = [1, 2, 3];
    const extent = [0.5, 0.25, 2];
    const normal = [-3, 1, 2];
    const offset = -11;
    const signs = [-1, 1];
    let maxCornerDist = -Infinity;
    for (const sx of signs) {
      for (const sy of signs) {
        for (const sz of signs) {
          const corner = [
            center[0] + sx * extent[0],
            center[1] + sy * extent[1],
            center[2] + sz * extent[2],
          ];
          const dist = dot(normal, corner) + offset;
          if (dist > maxCornerDist) maxCornerDist = dist;
        }
      }
    }
    const expected = maxCornerDist < 0;
    assert(
      aabbOutsidePlane(center, extent, normal, offset) === expected,
      'AABB plane test must match corner evaluation'
    );
  }

  // 15. test_tangent_aabb_is_kept
  {
    assert(
      !aabbOutsidePlane([-1, 0, 0], [1, 1, 1], [1, 0, 0], 0),
      'Tangent AABB must not be rejected'
    );
  }

  // 16. test_unique_cut_and_threshold_equality
  {
    const scores = [8, 2, 0];
    const parents = [Infinity, 8, 2];
    for (const threshold of [0, 1, 2, 3, 8, 10]) {
      const selected = scores.map(
        (score, idx) => score <= threshold && threshold < parents[idx]
      );
      const count = selected.filter(Boolean).length;
      assert(count === 1, `DAG cut at threshold ${threshold} must select exactly 1 node`);
    }
  }

  // 17. test_scan_example
  {
    const [res, total] = exclusiveScan([1, 0, 1, 1, 0]);
    assert(JSON.stringify(res) === JSON.stringify([0, 1, 1, 2, 3]), 'Scan result mismatch');
    assert(total === 3, 'Scan total mismatch');
  }

  // 18. test_compaction_empty_and_partial
  {
    assert(compact([], []).length === 0, 'Compaction on empty arrays');
    const compacted = compact(['a', 'b', 'c'], [1, 0, 1]);
    assert(JSON.stringify(compacted) === JSON.stringify(['a', 'c']), 'Compaction partial');
  }

  // 19. test_compaction_matches_filter
  {
    let seed = 121;
    function pseudoRand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    for (const size of [1, 31, 32, 33, 63, 64, 65, 129]) {
      const flags = Array.from({ length: size }, () => (pseudoRand() > 0.5 ? 1 : 0));
      const indices = Array.from({ length: size }, (_, i) => i);
      const compacted = compact(indices, flags);
      const expected = indices.filter((_, i) => flags[i] === 1);
      assert(
        JSON.stringify(compacted) === JSON.stringify(expected),
        `Compaction mismatch for size ${size}`
      );
    }
  }

  // 20. test_hiz_background_prevents_false_rejection
  {
    const resStandard = hizReduceCeil([[0.2, 0.3], [0.4, 1.0]], false);
    assertAlmostEqual(resStandard[0][0], 1.0);
    const resReversed = hizReduceCeil([[0.8, 0.7], [0.6, 0.0]], true);
    assertAlmostEqual(resReversed[0][0], 0.0);
  }

  // 21. test_hiz_odd_dimension_keeps_last_column
  {
    const level = hizReduceCeil([
      [0.2, 0.3, 1],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ]);
    assertAlmostEqual(level[0][0], 0.5);
    assertAlmostEqual(level[0][1], 1.0);
    assertAlmostEqual(level[1][0], 0.8);
    assertAlmostEqual(level[1][1], 0.9);
    const level2 = hizReduceCeil(level);
    assertAlmostEqual(level2[0][0], 1.0);
  }

  // 22. test_indirect_base_vertex_signed
  {
    // WGSL/Vulkan DrawIndexedIndirect struct layout:
    // indexCount: u32, instanceCount: u32, firstIndex: u32, baseVertex: i32, firstInstance: u32
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setUint32(0, 3, true);
    view.setUint32(4, 1, true);
    view.setUint32(8, 0, true);
    view.setInt32(12, -7, true); // baseVertex signed!
    view.setUint32(16, 0, true);

    assert(buffer.byteLength === 20, 'Indirect command buffer must be 20 bytes');
    assert(view.getInt32(12, true) === -7, 'baseVertex must be signed -7');
  }

  // 23. test_barycentric_vertex_and_center
  {
    const vertices: [number, number][] = [[0, 0], [3, 0], [0, 3]];
    const atVertex = barycentric(vertices, [0, 0]);
    assertAlmostEqual(atVertex[0], 1);
    assertAlmostEqual(atVertex[1], 0);
    assertAlmostEqual(atVertex[2], 0);

    const atCenter = barycentric(vertices, [1, 1]);
    assertAlmostEqual(atCenter[0], 1 / 3);
    assertAlmostEqual(atCenter[1], 1 / 3);
    assertAlmostEqual(atCenter[2], 1 / 3);
  }

  // 24. test_edge_increment
  {
    const p1: [number, number] = [2, 3];
    const p2: [number, number] = [4, 7];
    const pt: [number, number] = [5, 8];
    const ePt = edge(p1, p2, pt);
    const eStepX = edge(p1, p2, [6, 8]);
    const eStepY = edge(p1, p2, [5, 9]);
    assertAlmostEqual(eStepX - ePt, -4);
    assertAlmostEqual(eStepY - ePt, 2);
  }

  // 25. test_perspective_attribute_example
  {
    const weights = [1 / 3, 1 / 3, 1 / 3];
    const clipW = [1, 2, 4];
    const attributes = [0, 1, 0];
    const val = perspectiveAttribute(weights, clipW, attributes);
    assertAlmostEqual(val, 2 / 7);
  }

  // 26. test_analytic_derivative_matches_same_triangle_finite_difference
  {
    const weights = [0.3, 0.3, 0.4];
    const derivative = [-0.2, 0.2, 0];
    const clipW = [1, 2, 4];
    const attributes = [0.1, 0.8, 0.2];
    const epsilon = 1e-5;

    const afterW = weights.map((w, idx) => w + epsilon * derivative[idx]);
    const beforeW = weights.map((w, idx) => w - epsilon * derivative[idx]);

    const afterVal = perspectiveAttribute(afterW, clipW, attributes);
    const beforeVal = perspectiveAttribute(beforeW, clipW, attributes);
    const finiteDiff = (afterVal - beforeVal) / (2 * epsilon);
    const analytic = perspectiveDerivative(weights, derivative, clipW, attributes);

    assertAlmostEqual(analytic, finiteDiff, 1e-7);
  }

  // 27. test_quantization_negative_tie_is_explicit
  {
    const [intNeg, valNeg] = quantize(-0.5, 1);
    assert(intNeg === 0 && valNeg === 0, 'Quantize -0.5 tie');
    const [intPos, valPos] = quantize(0.5, 1);
    assert(intPos === 1 && valPos === 1, 'Quantize 0.5 tie');
  }

  // 28. test_quantization_distance_bound
  {
    let seed = 422;
    function pseudoRand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    const step = 0.001;
    for (let i = 0; i < 1000; i++) {
      const pt = [
        -10 + pseudoRand() * 20,
        -10 + pseudoRand() * 20,
        -10 + pseudoRand() * 20,
      ];
      const decoded = pt.map((v) => quantize(v, step)[1]);
      const dist = norm([pt[0] - decoded[0], pt[1] - decoded[1], pt[2] - decoded[2]]);
      assert(
        dist <= (Math.sqrt(3) * step) / 2 + 1e-12,
        `Quantization error ${dist} exceeds bound`
      );
    }
  }

  // 29. test_octahedral_roundtrip
  {
    let seed = 234;
    function pseudoRand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    const normals: number[][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (let i = 0; i < 1000; i++) {
      normals.push([
        -1 + pseudoRand() * 2,
        -1 + pseudoRand() * 2,
        -1 + pseudoRand() * 2,
      ]);
    }
    for (const rawN of normals) {
      const len = norm(rawN);
      const expected = rawN.map((v) => v / len);
      const encoded = octEncode(expected);
      const reconstructed = octDecode(encoded);
      const diff = norm([
        expected[0] - reconstructed[0],
        expected[1] - reconstructed[1],
        expected[2] - reconstructed[2],
      ]);
      assert(diff < 1e-11, `Octahedral roundtrip diff ${diff} exceeds tolerance`);
    }
  }

  // 30. test_amdahl_example
  {
    const speedup = 1 / (0.9 + 0.1 / 4);
    assertAlmostEqual(speedup, 1.081081081081081, 1e-7);
  }

  console.log('✅ Les 30 tests oracles mathématiques sont validés avec succès !');
}

runOracleTests();
