# Oracles mathématiques et tests intégrés

Ce document contient les fonctions de référence et leurs tests. Python 3.10+ et sa bibliothèque standard suffisent. Aucun original, paquet tiers ou fichier Python à conserver n’est nécessaire. Les deux blocs sont extraits dans un dossier temporaire uniquement pendant l’exécution.

Ces tests vérifient des calculs et contre-exemples, pas un moteur complet, un shader GPU ou des performances matérielles. Les tirages déterministes complètent les exemples sans constituer une preuve exhaustive sur toutes les entrées.

## Exécuter depuis le dossier rapport

```sh
python3 - <<'PY'
from pathlib import Path
import re
import subprocess
import sys
import tempfile

document = Path('ORACLES_ET_TESTS.md').read_text()
with tempfile.TemporaryDirectory(prefix='geometry-oracles-') as temporary:
    for name in ['reference_math.py', 'test_reference_math.py']:
        pattern = r'<!-- executable: ' + re.escape(name) + r' -->\n```python\n([\s\S]*?)\n```'
        match = re.search(pattern, document)
        if match is None:
            raise RuntimeError('Bloc executable manquant: ' + name)
        (Path(temporary) / name).write_text(match.group(1) + '\n')
    result = subprocess.run([sys.executable, '-B', '-m', 'unittest', '-v', 'test_reference_math.py'], cwd=temporary)
    raise SystemExit(result.returncode)
PY
```

## Fonctions de référence

<!-- executable: reference_math.py -->
```python
import math


def dot(left, right):
    return sum(first * second for first, second in zip(left, right))


def norm(vector):
    return math.sqrt(dot(vector, vector))


def quadric_from_planes(planes):
    result = [[0.0] * 4 for _ in range(4)]
    for plane, weight in planes:
        if weight < 0 or not math.isclose(norm(plane[:3]), 1.0):
            raise ValueError('Plan non normalise ou poids negatif')
        for row in range(4):
            for column in range(4):
                result[row][column] += weight * plane[row] * plane[column]
    return result


def quadric_energy(quadric, position):
    homogeneous = [*position, 1.0]
    return sum(homogeneous[row] * quadric[row][column] * homogeneous[column]
               for row in range(4) for column in range(4))


def solve_pivoted(matrix, target, relative_tolerance=1e-12):
    size = len(target)
    augmented = [list(row) + [value] for row, value in zip(matrix, target)]
    scale = max(abs(value) for row in matrix for value in row)
    if scale == 0:
        return None
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) <= scale * relative_tolerance:
            return None
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row != column:
                factor = augmented[row][column]
                augmented[row] = [value - factor * selected for value, selected in zip(augmented[row], augmented[column])]
    return [row[-1] for row in augmented]


def quadric_candidate(quadric, left, right):
    matrix = [row[:3] for row in quadric[:3]]
    target = [-row[3] for row in quadric[:3]]
    optimum = solve_pivoted(matrix, target)
    candidates = [list(left), list(right), [(first + second) / 2 for first, second in zip(left, right)]]
    if optimum is not None:
        candidates.append(optimum)
    return min(candidates, key=lambda point: quadric_energy(quadric, point))


def projected_point(point, focal):
    if point[2] <= 0:
        raise ValueError('Point hors domaine perspective')
    return [focal[0] * point[0] / point[2], focal[1] * point[1] / point[2]]


def projected_error_bound(error, minimum, maximum, focal, near=0.01):
    if error < 0 or any(not math.isfinite(value) for value in [error, *minimum, *maximum, *focal, near]):
        raise ValueError('Valeur invalide')
    if any(lower > upper for lower, upper in zip(minimum, maximum)) or near <= 0:
        raise ValueError('Boite ou plan proche invalide')
    if minimum[2] <= near:
        return math.inf
    transverse_squared = sum(max(abs(minimum[axis]), abs(maximum[axis])) ** 2 for axis in range(2))
    return error * max(abs(value) for value in focal) / minimum[2] * math.sqrt(1 + transverse_squared / minimum[2] ** 2)


def sphere_union(first_center, first_radius, second_center, second_radius):
    if first_radius < 0 or second_radius < 0:
        raise ValueError('Rayon negatif')
    direction = [second - first for first, second in zip(first_center, second_center)]
    distance = norm(direction)
    if first_radius >= distance + second_radius:
        return list(first_center), first_radius
    if second_radius >= distance + first_radius:
        return list(second_center), second_radius
    radius = (distance + first_radius + second_radius) / 2
    center = [value + (radius - first_radius) * delta / distance for value, delta in zip(first_center, direction)]
    return center, radius


def aabb_outside_plane(center, extent, normal, offset):
    if any(value < 0 for value in extent):
        raise ValueError('Etendue negative')
    return dot(normal, center) + offset + dot([abs(value) for value in normal], extent) < 0


def exclusive_scan(values):
    result = []
    total = 0
    for value in values:
        result.append(total)
        total += value
    return result, total


def compact(values, flags):
    if len(values) != len(flags) or any(flag not in (0, 1) for flag in flags):
        raise ValueError('Predicats invalides')
    offsets, total = exclusive_scan(flags)
    result = [None] * total
    for index, flag in enumerate(flags):
        if flag:
            result[offsets[index]] = values[index]
    return result


def hiz_reduce_ceil(depth, reversed_z=False):
    height = len(depth)
    width = len(depth[0]) if height else 0
    if width == 0 or any(len(row) != width for row in depth):
        raise ValueError('Image vide ou non rectangulaire')
    reducer = min if reversed_z else max
    result = []
    for start_row in range(0, height, 2):
        row = []
        for start_column in range(0, width, 2):
            footprint = [depth[source_row][source_column]
                         for source_row in range(start_row, min(start_row + 2, height))
                         for source_column in range(start_column, min(start_column + 2, width))]
            row.append(reducer(footprint))
        result.append(row)
    return result


def edge(first, second, point):
    return (second[0] - first[0]) * (point[1] - first[1]) - (second[1] - first[1]) * (point[0] - first[0])


def barycentric(vertices, point):
    first, second, third = vertices
    area = edge(first, second, third)
    if area == 0:
        raise ValueError('Triangle degenere')
    return [edge(second, third, point) / area, edge(third, first, point) / area, edge(first, second, point) / area]


def perspective_attribute(weights, clip_w, attributes):
    denominator = sum(weight / divisor for weight, divisor in zip(weights, clip_w))
    if denominator == 0:
        raise ValueError('Denominateur nul')
    return sum(weight * value / divisor for weight, divisor, value in zip(weights, clip_w, attributes)) / denominator


def perspective_derivative(weights, derivative_weights, clip_w, attributes):
    denominator = sum(weight / divisor for weight, divisor in zip(weights, clip_w))
    numerator = sum(weight * value / divisor for weight, divisor, value in zip(weights, clip_w, attributes))
    derivative_denominator = sum(weight / divisor for weight, divisor in zip(derivative_weights, clip_w))
    derivative_numerator = sum(weight * value / divisor for weight, divisor, value in zip(derivative_weights, clip_w, attributes))
    return (derivative_numerator * denominator - numerator * derivative_denominator) / denominator ** 2


def quantize(value, step, origin=0.0):
    if step <= 0:
        raise ValueError('Pas invalide')
    scaled = (value - origin) / step
    integer = math.floor(scaled + 0.5)
    return integer, origin + step * integer


def sign_not_zero(value):
    return -1 if value < 0 else 1


def oct_encode(normal):
    total = sum(abs(value) for value in normal)
    if total == 0:
        raise ValueError('Normale nulle')
    horizontal, vertical, depth = [value / total for value in normal]
    if depth < 0:
        horizontal, vertical = (1 - abs(vertical)) * sign_not_zero(horizontal), (1 - abs(horizontal)) * sign_not_zero(vertical)
    return [horizontal, vertical]


def oct_decode(encoded):
    horizontal, vertical = encoded
    depth = 1 - abs(horizontal) - abs(vertical)
    if depth < 0:
        horizontal, vertical = (1 - abs(vertical)) * sign_not_zero(horizontal), (1 - abs(horizontal)) * sign_not_zero(vertical)
    length = norm([horizontal, vertical, depth])
    return [horizontal / length, vertical / length, depth / length]


def crc(data):
    value = 0xFFFFFFFF
    for byte in data:
        value ^= byte
        for bit in range(8):
            value = (value >> 1) ^ (0xEDB88320 if value & 1 else 0)
    return value ^ 0xFFFFFFFF


def packed_weights(weights, maximum):
    if not isinstance(maximum, int) or maximum <= 0:
        raise ValueError('Budget entier invalide')
    if not weights or any(not math.isfinite(value) or value < 0 for value in weights):
        raise ValueError('Poids invalides')
    total = sum(weights)
    if not math.isfinite(total) or total <= 0:
        raise ValueError('Somme invalide')
    raw = [value / total * maximum for value in weights]
    result = [math.floor(value) for value in raw]
    remainder = maximum - sum(result)
    if not 0 <= remainder <= len(result):
        raise ValueError('Arrondi hors domaine')
    order = sorted(range(len(result)), key=lambda index: (-(raw[index] - result[index]), index))
    for index in order[:remainder]:
        result[index] += 1
    return result


def valid_range(offset, size, total):
    return all(isinstance(value, int) and value >= 0 for value in [offset, size, total]) and offset <= total and size <= total - offset


def signed_fold(value):
    return 2 * value if value >= 0 else -2 * value - 1


def signed_unfold(value):
    if not isinstance(value, int) or value < 0:
        raise ValueError('Entier non signe requis')
    return value // 2 if value % 2 == 0 else -(value // 2) - 1
```

## Tests indépendants et contre-exemples

<!-- executable: test_reference_math.py -->
```python
import itertools
import math
import random
import struct
import unittest

import reference_math as reference


class MathematicalContractTests(unittest.TestCase):
    def test_qem_known_intersection(self):
        quadric = reference.quadric_from_planes([([1, 0, 0, -1], 1), ([0, 1, 0, -2], 1), ([0, 0, 1, -3], 1)])
        optimum = reference.quadric_candidate(quadric, [0, 0, 0], [4, 4, 4])
        self.assertEqual(optimum, [1, 2, 3])
        self.assertAlmostEqual(reference.quadric_energy(quadric, optimum), 0)

    def test_qem_singular_fallback(self):
        quadric = reference.quadric_from_planes([([0, 0, 1, 0], 1)])
        self.assertEqual(reference.quadric_candidate(quadric, [0, 0, 1], [1, 1, -1]), [0.5, 0.5, 0.0])

    def test_qem_energy_matches_plane_distance(self):
        quadric = reference.quadric_from_planes([([0.6, 0.8, 0, -2], 3)])
        point = [4, 5, 6]
        self.assertAlmostEqual(reference.quadric_energy(quadric, point), 3 * (0.6 * 4 + 0.8 * 5 - 2) ** 2)

    def test_qem_rejects_non_normalized_input(self):
        with self.assertRaises(ValueError):
            reference.quadric_from_planes([([2, 0, 0, 0], 1)])

    def test_max_error_is_not_cumulative_bound(self):
        first_displacement = 0.001
        second_displacement = 0.001
        self.assertGreater(first_displacement + second_displacement, max(first_displacement, second_displacement))

    def test_focal_example(self):
        focal = 1080 / (2 * math.tan(math.pi / 6))
        self.assertAlmostEqual(focal * 0.01 / 10, 0.935307436, places=8)

    def test_projected_bound_random_pairs(self):
        generator = random.Random(20260911)
        minimum, maximum, focal = [-8, -5, 2], [7, 9, 30], [900, 1100]
        for _ in range(2000):
            first = [generator.uniform(lower, upper) for lower, upper in zip(minimum, maximum)]
            second = [generator.uniform(lower, upper) for lower, upper in zip(minimum, maximum)]
            error = reference.norm([right - left for left, right in zip(first, second)])
            bound = reference.projected_error_bound(error, minimum, maximum, focal)
            projected_first = reference.projected_point(first, focal)
            projected_second = reference.projected_point(second, focal)
            observed = reference.norm([right - left for left, right in zip(projected_first, projected_second)])
            self.assertLessEqual(observed, bound + 1e-9)

    def test_radial_distance_underestimates_off_axis(self):
        first, second, focal = [10, 0, 10], [10, 0, 10.01], [1000, 1000]
        observed = abs(reference.projected_point(first, focal)[0] - reference.projected_point(second, focal)[0])
        radial_approximation = 1000 * 0.01 / reference.norm(first)
        self.assertGreater(observed, radial_approximation)

    def test_near_plane_requests_refinement(self):
        self.assertTrue(math.isinf(reference.projected_error_bound(0.01, [-1, -1, 0], [1, 1, 3], [900, 900])))

    def test_nested_bounds_project_monotonically(self):
        child = reference.projected_error_bound(0.01, [-1, -1, 10], [1, 1, 12], [900, 900])
        parent = reference.projected_error_bound(0.02, [-3, -3, 8], [3, 3, 15], [900, 900])
        self.assertGreaterEqual(parent, child)

    def test_shear_max_column_not_spectral_bound(self):
        direction = [1 / math.sqrt(2), 1 / math.sqrt(2), 0]
        transformed = [direction[0] + direction[1], direction[1], 0]
        maximum_column = math.sqrt(2)
        self.assertGreater(reference.norm(transformed), maximum_column)

    def test_sphere_union_contains_both(self):
        center, radius = reference.sphere_union([0, 0, 0], 1, [4, 0, 0], 1)
        self.assertEqual((center, radius), ([2, 0, 0], 3))
        self.assertLessEqual(reference.norm(center) + 1, radius)

    def test_sphere_union_coincident(self):
        self.assertEqual(reference.sphere_union([0, 0, 0], 1, [0, 0, 0], 2), ([0, 0, 0], 2))

    def test_aabb_plane_equals_corner_maximum(self):
        center, extent, normal, offset = [1, 2, 3], [0.5, 0.25, 2], [-3, 1, 2], -11
        corners = [[middle + sign * half for middle, sign, half in zip(center, signs, extent)] for signs in itertools.product([-1, 1], repeat=3)]
        expected = max(reference.dot(normal, corner) + offset for corner in corners) < 0
        self.assertEqual(reference.aabb_outside_plane(center, extent, normal, offset), expected)

    def test_tangent_aabb_is_kept(self):
        self.assertFalse(reference.aabb_outside_plane([-1, 0, 0], [1, 1, 1], [1, 0, 0], 0))

    def test_unique_cut_and_threshold_equality(self):
        scores = [8, 2, 0]
        parents = [math.inf, 8, 2]
        for threshold in [0, 1, 2, 3, 8, 10]:
            selected = [score <= threshold < parent for score, parent in zip(scores, parents)]
            self.assertEqual(sum(selected), 1)

    def test_scan_example(self):
        self.assertEqual(reference.exclusive_scan([1, 0, 1, 1, 0]), ([0, 1, 1, 2, 3], 3))

    def test_compaction_empty_and_partial(self):
        self.assertEqual(reference.compact([], []), [])
        self.assertEqual(reference.compact(['a', 'b', 'c'], [1, 0, 1]), ['a', 'c'])

    def test_compaction_matches_filter(self):
        generator = random.Random(121)
        for size in [1, 31, 32, 33, 63, 64, 65, 129]:
            flags = [generator.randrange(2) for _ in range(size)]
            self.assertEqual(reference.compact(list(range(size)), flags), [index for index, flag in enumerate(flags) if flag])

    def test_hiz_background_prevents_false_rejection(self):
        self.assertEqual(reference.hiz_reduce_ceil([[0.2, 0.3], [0.4, 1.0]]), [[1.0]])
        self.assertEqual(reference.hiz_reduce_ceil([[0.8, 0.7], [0.6, 0]], reversed_z=True), [[0]])

    def test_hiz_odd_dimension_keeps_last_column(self):
        level = reference.hiz_reduce_ceil([[0.2, 0.3, 1], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]])
        self.assertEqual(level, [[0.5, 1], [0.8, 0.9]])
        self.assertEqual(reference.hiz_reduce_ceil(level), [[1]])

    def test_indirect_base_vertex_signed(self):
        command = struct.pack('<IIIiI', 3, 1, 0, -7, 0)
        self.assertEqual(len(command), 20)
        self.assertEqual(struct.unpack_from('<i', command, 12)[0], -7)

    def test_barycentric_vertex_and_center(self):
        vertices = [[0, 0], [3, 0], [0, 3]]
        self.assertEqual(reference.barycentric(vertices, [0, 0]), [1, 0, 0])
        for weight in reference.barycentric(vertices, [1, 1]):
            self.assertAlmostEqual(weight, 1 / 3)

    def test_edge_increment(self):
        first, second, point = [2, 3], [4, 7], [5, 8]
        self.assertEqual(reference.edge(first, second, [6, 8]) - reference.edge(first, second, point), -4)
        self.assertEqual(reference.edge(first, second, [5, 9]) - reference.edge(first, second, point), 2)

    def test_perspective_attribute_example(self):
        self.assertAlmostEqual(reference.perspective_attribute([1 / 3] * 3, [1, 2, 4], [0, 1, 0]), 2 / 7)

    def test_analytic_derivative_matches_same_triangle_finite_difference(self):
        weights, derivative, clip_w, attributes = [0.3, 0.3, 0.4], [-0.2, 0.2, 0], [1, 2, 4], [0.1, 0.8, 0.2]
        epsilon = 1e-5
        after = reference.perspective_attribute([value + epsilon * delta for value, delta in zip(weights, derivative)], clip_w, attributes)
        before = reference.perspective_attribute([value - epsilon * delta for value, delta in zip(weights, derivative)], clip_w, attributes)
        self.assertAlmostEqual(reference.perspective_derivative(weights, derivative, clip_w, attributes), (after - before) / (2 * epsilon), places=9)

    def test_quantization_negative_tie_is_explicit(self):
        self.assertEqual(reference.quantize(-0.5, 1), (0, 0))
        self.assertEqual(reference.quantize(0.5, 1), (1, 1))

    def test_quantization_distance_bound(self):
        generator = random.Random(422)
        step = 0.001
        for _ in range(1000):
            point = [generator.uniform(-10, 10) for _ in range(3)]
            decoded = [reference.quantize(value, step)[1] for value in point]
            self.assertLessEqual(reference.norm([value - decoded_value for value, decoded_value in zip(point, decoded)]), math.sqrt(3) * step / 2 + 1e-12)

    def test_octahedral_roundtrip(self):
        generator = random.Random(234)
        normals = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]
        normals.extend([[generator.uniform(-1, 1) for _ in range(3)] for _ in range(1000)])
        for normal in normals:
            expected = [value / reference.norm(normal) for value in normal]
            reconstructed = reference.oct_decode(reference.oct_encode(normal))
            self.assertLess(reference.norm([value - other for value, other in zip(expected, reconstructed)]), 1e-12)

    def test_amdahl_example(self):
        self.assertAlmostEqual(1 / (0.9 + 0.1 / 4), 1.081081081081081)

    def test_crc_check_value(self):
        self.assertEqual(reference.crc(b'123456789'), 0xCBF43926)

    def test_crc_empty(self):
        self.assertEqual(reference.crc(b''), 0)

    def test_weight_integer_sum(self):
        self.assertEqual(reference.packed_weights([0.2, 0.3, 0.5], 255), [51, 77, 127])
        self.assertEqual(reference.packed_weights([1, 1, 1], 4), [2, 1, 1])

    def test_weight_random_sum(self):
        generator = random.Random(715)
        for count in range(1, 20):
            weights = [generator.random() for index in range(count)]
            result = reference.packed_weights(weights, 255)
            self.assertEqual(sum(result), 255)
            self.assertTrue(all(0 <= value <= 255 for value in result))

    def test_weight_rejects_invalid_input(self):
        for weights in [[], [0, 0], [-1, 2], [math.nan], [math.inf]]:
            with self.assertRaises(ValueError):
                reference.packed_weights(weights, 255)

    def test_section_ranges(self):
        self.assertTrue(reference.valid_range(10, 90, 100))
        self.assertTrue(reference.valid_range(100, 0, 100))
        self.assertFalse(reference.valid_range(10, 91, 100))
        self.assertFalse(reference.valid_range(-1, 1, 100))
        self.assertFalse(reference.valid_range(2**64 - 1, 2, 2**64))

    def test_signed_integer_roundtrip(self):
        for value in range(-1000, 1001):
            self.assertEqual(reference.signed_unfold(reference.signed_fold(value)), value)

    def test_weight_budget_rejected(self):
        for maximum in [0, -1, 1.5]:
            with self.assertRaises(ValueError):
                reference.packed_weights([1], maximum)


if __name__ == '__main__':
    unittest.main(verbosity=2)
```
