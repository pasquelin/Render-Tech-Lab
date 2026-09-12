import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  adaptiveVisible,
  centerLengthOf,
  prepareCoherence,
  rejectingPlaneIndex,
  resetAdaptiveEntry,
  type AdaptiveEntry,
  type CoherenceState,
} from '../implementation/adaptiveCulling.ts';

function frustumFrom(position: THREE.Vector3, target: THREE.Vector3, fov = 60): THREE.Frustum {
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 200);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return new THREE.Frustum().setFromProjectionMatrix(viewProjection);
}

function entryAt(x: number, y: number, z: number, radius: number): AdaptiveEntry {
  const center = new THREE.Vector3(x, y, z);
  return { center, radius, centerLength: centerLengthOf(center), lastPlane: 0, margin: -Infinity };
}

function state(): CoherenceState {
  return { previousPlanes: new Float64Array(24), havePreviousPlanes: false };
}

test('rejecting-plane permutation visits each of the six planes once', () => {
  for (let last = 0; last < 6; last++) {
    const order = Array.from({ length: 6 }, (_, step) => rejectingPlaneIndex(last, step));
    assert.equal(order[0], last);
    assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  }
});

test('exact six-plane test matches Three.js intersectsSphere, including tangency', () => {
  const frustum = frustumFrom(new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, 0));
  const inside = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0.5);
  const far = new THREE.Sphere(new THREE.Vector3(80, 0, 0), 0.2);
  const tangent = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0.0001);
  assert.equal(frustum.intersectsSphere(inside), true);
  assert.equal(adaptiveVisible(entryAt(0, 0, 0, 0.5), frustum.planes, 'adaptive-frustum', 0, 0, 1).visible, true);
  assert.equal(frustum.intersectsSphere(far), false);
  assert.equal(adaptiveVisible(entryAt(80, 0, 0, 0.2), frustum.planes, 'adaptive-frustum', 0, 0, 1).visible, false);
  assert.equal(frustum.intersectsSphere(tangent), adaptiveVisible(entryAt(0, 0, 0, 0.0001), frustum.planes, 'adaptive-frustum', 0, 0, 1).visible);
});

test('coherent certificate never accepts a sphere that the exact planes reject', () => {
  const first = frustumFrom(new THREE.Vector3(0, 2, 10), new THREE.Vector3(0, 0, 0));
  const coherence = state();
  const deltas = prepareCoherence(first.planes, coherence);
  const mesh = entryAt(0, 0, 0, 0.8);
  const initial = adaptiveVisible(mesh, first.planes, 'adaptive-coherent', deltas.deltaNormal, deltas.deltaConstant, deltas.constantScale);
  assert.equal(initial.certified, false);
  assert.equal(initial.visible, first.intersectsSphere(new THREE.Sphere(new THREE.Vector3(mesh.center.x, mesh.center.y, mesh.center.z), mesh.radius)));
  for (let i = 1; i <= 40; i++) {
    const next = frustumFrom(new THREE.Vector3(Math.sin(i * 0.15) * i * 0.4, 2, 10 + i * 0.2), new THREE.Vector3(0, 0, 0));
    const step = prepareCoherence(next.planes, coherence);
    const result = adaptiveVisible(mesh, next.planes, 'adaptive-coherent', step.deltaNormal, step.deltaConstant, step.constantScale);
    const exact = next.intersectsSphere(new THREE.Sphere(new THREE.Vector3(mesh.center.x, mesh.center.y, mesh.center.z), mesh.radius));
    if (result.certified) assert.equal(exact, true);
    assert.equal(result.visible, exact);
  }
});

test('a large camera jump invalidates the certificate and retests the six planes', () => {
  const near = frustumFrom(new THREE.Vector3(0, 0, 6), new THREE.Vector3(0, 0, 0));
  const far = frustumFrom(new THREE.Vector3(50, 20, -40), new THREE.Vector3(10, 0, 0));
  const coherence = state();
  const mesh = entryAt(0, 0, 0, 1);
  prepareCoherence(near.planes, coherence);
  adaptiveVisible(mesh, near.planes, 'adaptive-coherent', 0, 0, 1);
  assert.ok(mesh.margin > 0);
  const jump = prepareCoherence(far.planes, coherence);
  const result = adaptiveVisible(mesh, far.planes, 'adaptive-coherent', jump.deltaNormal, jump.deltaConstant, jump.constantScale);
  assert.equal(result.certified, false);
  assert.equal(result.planeTests, 6);
  assert.equal(result.visible, far.intersectsSphere(new THREE.Sphere(new THREE.Vector3(mesh.center.x, mesh.center.y, mesh.center.z), mesh.radius)));
});

test('a rejected sphere stores an empty margin and is retested on the next camera', () => {
  const outside = frustumFrom(new THREE.Vector3(40, 0, 0), new THREE.Vector3(40, 0, -1));
  const inside = frustumFrom(new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, 0));
  const mesh = entryAt(0, 0, 0, 0.5);
  const first = adaptiveVisible(mesh, outside.planes, 'adaptive-coherent', 0, 0, 1);
  assert.equal(first.visible, false);
  assert.equal(mesh.margin, -Infinity);
  const second = adaptiveVisible(mesh, inside.planes, 'adaptive-coherent', 0, 0, 1);
  assert.equal(second.certified, false);
  assert.equal(second.visible, true);
  assert.ok(second.planeTests >= 1);
});

test('resetAdaptiveEntry clears certificate state used between quality and measurement', () => {
  const mesh = entryAt(1, 2, 3, 4);
  mesh.lastPlane = 5;
  mesh.margin = 12;
  resetAdaptiveEntry(mesh);
  assert.equal(mesh.lastPlane, 0);
  assert.equal(mesh.margin, -Infinity);
});
