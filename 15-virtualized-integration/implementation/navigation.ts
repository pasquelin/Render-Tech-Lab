import * as THREE from 'three';

type Bounds = THREE.Box3;
type Cities = 1 | 4 | 9 | 12;

export function walkDirection(yaw: number, forward: number, right: number): THREE.Vector3 {
  const direction = new THREE.Vector3(
    -Math.sin(yaw) * forward + Math.cos(yaw) * right,
    0,
    -Math.cos(yaw) * forward - Math.sin(yaw) * right,
  );
  return direction.lengthSq() > 1 ? direction.normalize() : direction;
}

// Exact distance between a vertical player axis and one edge of a source triangle.
function axisEdgeDistanceSq(x: number, z: number, low: number, high: number, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const breaks = [0, 1];
  if (Math.abs(dy) > 1e-12) {
    for (const y of [low, high]) {
      const t = (y - a.y) / dy;
      if (t > 0 && t < 1) breaks.push(t);
    }
  }
  breaks.sort((left, right) => left - right);
  let best = Infinity;
  for (let i = 0; i + 1 < breaks.length; i++) {
    const start = breaks[i], end = breaks[i + 1];
    const midpointY = a.y + dy * (start + end) / 2;
    const targetY = midpointY < low ? low : midpointY > high ? high : null;
    const denominator = dx * dx + dz * dz + (targetY === null ? 0 : dy * dy);
    const numerator = dx * (a.x - x) + dz * (a.z - z) + (targetY === null ? 0 : dy * (a.y - targetY));
    const t = THREE.MathUtils.clamp(denominator > 0 ? -numerator / denominator : start, start, end);
    const px = a.x + dx * t, pz = a.z + dz * t, py = a.y + dy * t;
    const gapY = py < low ? low - py : py > high ? py - high : 0;
    best = Math.min(best, (px - x) ** 2 + (pz - z) ** 2 + gapY ** 2);
  }
  return best;
}

/** Collision on source triangles only. The grid chooses candidate triangles; it never blocks movement itself. */
export function buildTriangleWorld(triangles: Float32Array, sourceBounds: Bounds, bounds: Bounds, cities: Cities) {
  if (triangles.length % 9 !== 0 || !triangles.length) throw new Error('Triangles de navigation absents');
  const columns = cities === 12 ? 4 : Math.sqrt(cities);
  const rows = cities / columns;
  const size = bounds.getSize(new THREE.Vector3());
  const cityWidth = size.x / columns, cityDepth = size.z / rows;
  const scale = Math.max(1, Math.min(cityWidth, cityDepth));
  const height = Math.max(1.8, scale * 0.008);
  const radius = Math.max(0.1, height * 0.18);
  const ground = bounds.min.y < 0 && bounds.max.y > 0 ? 0 : bounds.min.y;
  const stepHeight = height * 0.22;
  const cellSize = Math.max(height * 2, scale / 80);
  const count = triangles.length / 9;
  const minY = new Float32Array(count), maxY = new Float32Array(count), floor = new Uint8Array(count);
  const grid = new Map<string, number[]>();
  const cell = (value: number) => Math.floor(value / cellSize);
  const key = (x: number, z: number) => `${x}:${z}`;
  for (let index = 0; index < count; index++) {
    const at = index * 9;
    const ax = triangles[at], ay = triangles[at + 1], az = triangles[at + 2];
    const bx = triangles[at + 3], by = triangles[at + 4], bz = triangles[at + 5];
    const cx = triangles[at + 6], cy = triangles[at + 7], cz = triangles[at + 8];
    minY[index] = Math.min(ay, by, cy); maxY[index] = Math.max(ay, by, cy);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    floor[index] = Math.abs(ny) / Math.hypot(nx, ny, nz) >= 0.7 ? 1 : 0;
    const x0 = cell(Math.min(ax, bx, cx)), x1 = cell(Math.max(ax, bx, cx));
    const z0 = cell(Math.min(az, bz, cz)), z1 = cell(Math.max(az, bz, cz));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const id = key(x, z);
      let bucket = grid.get(id);
      if (!bucket) {bucket = []; grid.set(id, bucket);}
      bucket.push(index);
    }
  }
  const offsets: Array<[number, number]> = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++)
    offsets.push([(col - (columns - 1) / 2) * cityWidth, (row - (rows - 1) / 2) * cityDepth]);
  const seen = new Uint32Array(count);
  let epoch = 0;
  const nearby = (x: number, z: number, reach: number, visit: (index: number, localX: number, localZ: number) => boolean) => {
    for (const [offsetX, offsetZ] of offsets) {
      const localX = x - offsetX, localZ = z - offsetZ;
      if (localX + reach < sourceBounds.min.x || localX - reach > sourceBounds.max.x ||
          localZ + reach < sourceBounds.min.z || localZ - reach > sourceBounds.max.z) continue;
      epoch++;
      if (epoch === 0xffffffff) {seen.fill(0); epoch = 1;}
      for (let cx = cell(localX - reach); cx <= cell(localX + reach); cx++)
        for (let cz = cell(localZ - reach); cz <= cell(localZ + reach); cz++)
          for (const index of grid.get(key(cx, cz)) ?? []) {
            if (seen[index] === epoch) continue;
            seen[index] = epoch;
            if (visit(index, localX, localZ)) return true;
          }
    }
    return false;
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const low = new THREE.Vector3(), high = new THREE.Vector3(), closest = new THREE.Vector3();
  const intersection = new THREE.Vector3(), normal = new THREE.Vector3();
  const triangle = new THREE.Triangle();
  const loadTriangle = (index: number) => {
    const at = index * 9;
    a.fromArray(triangles, at); b.fromArray(triangles, at + 3); c.fromArray(triangles, at + 6);
    triangle.set(a, b, c);
  };
  const floorAt = (x: number, z: number, referenceFootY: number): number | null => {
    let best: number | null = null;
    nearby(x, z, 0, (index, localX, localZ) => {
      if (!floor[index] || minY[index] > referenceFootY + stepHeight) return false;
      loadTriangle(index);
      const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(denominator) < 1e-10) return false;
      const wa = ((b.z - c.z) * (localX - c.x) + (c.x - b.x) * (localZ - c.z)) / denominator;
      const wb = ((c.z - a.z) * (localX - c.x) + (a.x - c.x) * (localZ - c.z)) / denominator;
      const wc = 1 - wa - wb;
      if (wa < -1e-5 || wb < -1e-5 || wc < -1e-5) return false;
      const y = wa * a.y + wb * b.y + wc * c.y;
      if (y <= referenceFootY + stepHeight && (best === null || y > best)) best = y;
      return false;
    });
    return best;
  };
  const collides = (position: THREE.Vector3, playerRadius = radius, playerHeight = height) => {
    low.set(position.x, position.y - playerHeight + playerRadius, position.z);
    high.set(position.x, position.y - playerRadius, position.z);
    const limit = playerRadius * playerRadius * (1 - 1e-5);
    return nearby(position.x, position.z, playerRadius, (index, localX, localZ) => {
      if (maxY[index] < low.y - playerRadius || minY[index] > high.y + playerRadius) return false;
      loadTriangle(index);
      low.x = high.x = localX; low.z = high.z = localZ;
      if (triangle.closestPointToPoint(low, closest).distanceToSquared(low) < limit ||
          triangle.closestPointToPoint(high, closest).distanceToSquared(high) < limit) return true;
      if (axisEdgeDistanceSq(localX, localZ, low.y, high.y, a, b) < limit ||
          axisEdgeDistanceSq(localX, localZ, low.y, high.y, b, c) < limit ||
          axisEdgeDistanceSq(localX, localZ, low.y, high.y, c, a) < limit) return true;
      triangle.getNormal(normal);
      const dLow = normal.dot(intersection.copy(low).sub(a));
      const dHigh = normal.dot(intersection.copy(high).sub(a));
      if (dLow * dHigh <= 0 && Math.abs(dLow - dHigh) > 1e-10) {
        intersection.copy(low).lerp(high, dLow / (dLow - dHigh));
        if (triangle.containsPoint(intersection)) return true;
      }
      return false;
    });
  };
  const move = (position: THREE.Vector3, delta: THREE.Vector3) => {
    const result = position.clone();
    const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (radius * 0.5)));
    const dx = delta.x / steps, dz = delta.z / steps;
    const candidate = new THREE.Vector3();
    for (let i = 0; i < steps; i++) {
      for (const [x, z] of [[dx, 0], [0, dz]]) {
        candidate.copy(result); candidate.x += x; candidate.z += z;
        const support = floorAt(candidate.x, candidate.z, result.y - height);
        if (support !== null && support > result.y - height && support - (result.y - height) <= stepHeight)
          candidate.y = support + height;
        if (!collides(candidate)) result.copy(candidate);
      }
    }
    return result;
  };
  const moveVertical = (position: THREE.Vector3, targetY: number) => {
    const result = position.clone();
    const steps = Math.max(1, Math.ceil(Math.abs(targetY - position.y) / (radius * 0.5)));
    const dy = (targetY - position.y) / steps;
    const candidate = new THREE.Vector3();
    for (let i = 0; i < steps; i++) {
      candidate.copy(result); candidate.y += dy;
      if (collides(candidate)) return {position: result, blocked: true};
      result.y = candidate.y;
    }
    return {position: result, blocked: false};
  };
  const startOnGeometry = (cityIndex: number, centerX: number, centerZ: number) => {
    const [offsetX, offsetZ] = offsets[cityIndex];
    const candidates: Array<{score: number; x: number; y: number; z: number}> = [];
    for (let index = 0; index < count; index++) {
      if (!floor[index]) continue;
      const at = index * 9;
      const x = (triangles[at] + triangles[at + 3] + triangles[at + 6]) / 3 + offsetX;
      const y = (triangles[at + 1] + triangles[at + 4] + triangles[at + 7]) / 3;
      const z = (triangles[at + 2] + triangles[at + 5] + triangles[at + 8]) / 3 + offsetZ;
      const score = (x - centerX) ** 2 + (z - centerZ) ** 2 + ((y - ground) * 8) ** 2;
      if (candidates.length === 128 && score >= candidates[candidates.length - 1].score) continue;
      const insert = candidates.findIndex(candidate => candidate.score > score);
      candidates.splice(insert < 0 ? candidates.length : insert, 0, {score, x, y, z});
      if (candidates.length > 128) candidates.pop();
    }
    for (const candidate of candidates) {
      const support = floorAt(candidate.x, candidate.z, candidate.y);
      if (support === null) continue;
      const position = new THREE.Vector3(candidate.x, support + height, candidate.z);
      if (!collides(position)) return position;
    }
    return null;
  };
  return {radius, height, ground, cityWidth, cityDepth, floorAt, collides, move, moveVertical, startOnGeometry, stats: {triangles: count, gridCells: grid.size}};
}

export type NavigationWorld = ReturnType<typeof buildTriangleWorld>;

/** Useful for procedural geometry; the bench uses a prepared triangle stream for real models. */
export function buildNavigationWorld(source: THREE.Object3D, bounds: Bounds, cities: Cities) {
  source.updateMatrixWorld(true);
  const positions: number[] = [];
  source.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const attribute = mesh.geometry.getAttribute('position'), indices = mesh.geometry.getIndex();
    if (!attribute) return;
    const point = new THREE.Vector3();
    for (let i = 0; i + 2 < (indices?.count ?? attribute.count); i += 3) for (let j = 0; j < 3; j++) {
      point.fromBufferAttribute(attribute, indices ? indices.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld);
      positions.push(point.x, point.y, point.z);
    }
  });
  return buildTriangleWorld(new Float32Array(positions), new THREE.Box3().setFromObject(source), bounds, cities);
}

export function advancePlayer(world: NavigationWorld, position: THREE.Vector3, velocityY: number, horizontalVelocity: THREE.Vector3, seconds: number, jump: boolean) {
  const footY = position.y - world.height;
  const support = world.floorAt(position.x, position.z, footY);
  const grounded = support !== null && footY <= support + world.height * 0.025 && velocityY <= 0;
  const jumped = jump && grounded;
  const gravity = world.height * 18;
  const nextVelocityY = jumped ? Math.sqrt(2 * gravity * world.height * 0.55) : velocityY;
  const horizontal = world.move(position, horizontalVelocity.clone().multiplyScalar(seconds));
  const vertical = world.moveVertical(horizontal, horizontal.y + nextVelocityY * seconds - gravity * seconds * seconds / 2);
  const next = vertical.position;
  const nextFoot = next.y - world.height;
  const nextSupport = world.floorAt(next.x, next.z, Math.max(footY, nextFoot));
  if (nextSupport !== null && nextFoot <= nextSupport + world.radius * 0.5 && nextVelocityY <= 0)
    return {position: next.setY(nextSupport + world.height), velocityY: 0, jumped};
  return {position: next, velocityY: vertical.blocked ? 0 : nextVelocityY - gravity * seconds, jumped};
}

export function startPosition(world: NavigationWorld, bounds: Bounds, cities: Cities, cityIndex: number): THREE.Vector3 {
  if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= cities) throw new Error('Indice de ville invalide');
  const columns = cities === 12 ? 4 : Math.sqrt(cities);
  const col = cityIndex % columns, row = Math.floor(cityIndex / columns);
  const centerX = bounds.min.x + (col + 0.5) * world.cityWidth;
  const centerZ = bounds.min.z + (row + 0.5) * world.cityDepth;
  for (const distance of [0, 0.15, 0.3, 0.45]) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const x = centerX + dx * distance * world.cityWidth, z = centerZ + dz * distance * world.cityDepth;
    const floor = world.floorAt(x, z, world.ground);
    if (floor === null) continue;
    const position = new THREE.Vector3(x, floor + world.height, z);
    if (!world.collides(position)) return position;
  }
  const geometricStart = world.startOnGeometry(cityIndex, centerX, centerZ);
  if (geometricStart) return geometricStart;
  throw new Error(`Aucun départ praticable sur la géométrie de la ville ${cityIndex + 1}.`);
}
