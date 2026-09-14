import {closeSync, openSync, readFileSync, writeSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshoptSimplifier} from 'meshoptimizer';
import * as THREE from 'three';
import {modelById} from './modelCatalog.ts';

type Tuple = [number, number, number];
type Accessor = {bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; min?: Tuple; max?: Tuple};
type Node = {mesh?: number; children?: number[]; matrix?: number[]; translation?: Tuple; rotation?: [number, number, number, number]; scale?: Tuple};
type Primitive = {attributes: {POSITION: number}; indices?: number; material?: number};
type Document = {scene?: number; scenes: Array<{nodes: number[]}>; nodes: Node[]; meshes: Array<{primitives: Primitive[]}>; materials?: Array<{name?: string; alphaMode?: string}>; accessors: Accessor[]; bufferViews: Array<{byteOffset?: number; byteStride?: number}>; buffers: Array<{uri: string}>};

const model = modelById(process.argv[2] ?? 'emerald-square');
if (!model) throw new Error('Modèle de navigation inconnu');
const root = fileURLToPath(new URL('../../', import.meta.url));
const full = resolve(root, model.derivedDirectory, 'native/full');
const pointer = JSON.parse(readFileSync(resolve(full, 'manifest.json'), 'utf8')) as {key: string};
if (!/^[a-f0-9]{64}$/i.test(pointer.key)) throw new Error('Clé de cache invalide');
const base = resolve(full, pointer.key);
const document = JSON.parse(readFileSync(resolve(base, 'source.gltf'), 'utf8')) as Document;
if (document.buffers.length !== 1 || document.buffers[0].uri !== 'source.bin') throw new Error('Source binaire glTF non prise en charge');
const source = readFileSync(resolve(base, 'source.bin'));
const binary = new DataView(source.buffer, source.byteOffset, source.byteLength);

const objects = document.nodes.map(node => {
  const object = new THREE.Group();
  if (node.matrix) {object.matrix.fromArray(node.matrix); object.matrixAutoUpdate = false;}
  else {
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
  }
  return object;
});
document.nodes.forEach((node, index) => {for (const child of node.children ?? []) objects[index].add(objects[child]);});
const scene = new THREE.Group();
for (const node of document.scenes[document.scene ?? 0].nodes) scene.add(objects[node]);
scene.updateMatrixWorld(true);

const bounds = new THREE.Box3();
const scales = new Map<string, number>();
for (const [nodeIndex, node] of document.nodes.entries()) {
  if (node.mesh === undefined) continue;
  for (const [primitiveIndex, primitive] of document.meshes[node.mesh].primitives.entries()) {
    const accessor = document.accessors[primitive.attributes.POSITION];
    if (!accessor?.min || !accessor.max) continue;
    bounds.union(new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max)).applyMatrix4(objects[nodeIndex].matrixWorld));
    const key = `${node.mesh}:${primitiveIndex}`;
    scales.set(key, Math.max(scales.get(key) ?? 0, objects[nodeIndex].matrixWorld.getMaxScaleOnAxis()));
  }
}
if (bounds.isEmpty()) throw new Error('Géométrie de navigation vide');
const size = bounds.getSize(new THREE.Vector3());
const height = Math.max(1.8, Math.max(1, Math.min(size.x, size.z)) * 0.008);

function positions(accessor: Accessor): Float32Array {
  if (accessor.type !== 'VEC3' || accessor.componentType !== 5126) throw new Error('Positions glTF non prises en charge');
  const view = document.bufferViews[accessor.bufferView];
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
  const result = new Float32Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i++) for (let axis = 0; axis < 3; axis++) result[i * 3 + axis] = binary.getFloat32(base + i * stride + axis * 4, true);
  return result;
}
function indices(accessor: Accessor): Uint32Array {
  const width = accessor.componentType === 5123 ? 2 : accessor.componentType === 5125 ? 4 : 0;
  if (!width) throw new Error('Indices glTF non pris en charge');
  const view = document.bufferViews[accessor.bufferView];
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? width;
  const result = new Uint32Array(accessor.count);
  for (let i = 0; i < accessor.count; i++) result[i] = width === 2 ? binary.getUint16(base + i * stride, true) : binary.getUint32(base + i * stride, true);
  return result;
}
function weld(vertices: Float32Array, triangles: Uint32Array, step: number) {
  const known = new Map<string, number>();
  const remap = new Uint32Array(vertices.length / 3);
  const welded: number[] = [];
  for (let i = 0; i < remap.length; i++) {
    const x = Math.round(vertices[i * 3] / step), y = Math.round(vertices[i * 3 + 1] / step), z = Math.round(vertices[i * 3 + 2] / step);
    const key = `${x}:${y}:${z}`;
    let index = known.get(key);
    if (index === undefined) {
      index = welded.length / 3;
      known.set(key, index);
      welded.push(x * step, y * step, z * step);
    }
    remap[i] = index;
  }
  const indices: number[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const a = remap[triangles[i]], b = remap[triangles[i + 1]], c = remap[triangles[i + 2]];
    if (a !== b && b !== c && a !== c) indices.push(a, b, c);
  }
  return {positions: new Float32Array(welded), indices: new Uint32Array(indices)};
}

await MeshoptSimplifier.ready;
const prepared = new Map<string, {positions: Float32Array; indices: Uint32Array}>();
const output = resolve(base, 'navigation.bin');
const fd = openSync(output, 'w');
const header = Buffer.alloc(36);
writeSync(fd, header);
const chunk = Buffer.allocUnsafe(18 * 8192);
let chunkTriangles = 0, triangleCount = 0, sourceTriangles = 0;
const min = bounds.min.toArray(), extent = size.toArray();
const quantize = (value: number, axis: number) => Math.max(0, Math.min(65535, Math.round((value - min[axis]) / (extent[axis] || 1) * 65535)));
const flush = () => {if (!chunkTriangles) return; writeSync(fd, chunk, 0, chunkTriangles * 18); chunkTriangles = 0;};
const point = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3();
try {
  for (const [nodeIndex, node] of document.nodes.entries()) {
    if (node.mesh === undefined) continue;
    const matrix = objects[nodeIndex].matrixWorld;
    for (const [primitiveIndex, primitive] of document.meshes[node.mesh].primitives.entries()) {
      if (primitive.indices === undefined) continue;
      const material = primitive.material === undefined ? undefined : document.materials?.[primitive.material];
      // Leaves and similar blended decoration have no solid surface; named glazing still blocks the player.
      if (material?.alphaMode === 'BLEND' && !/(glass|window|windshield|verre|vitre)/i.test(material.name ?? '')) continue;
      const cacheKey = `${node.mesh}:${primitiveIndex}`;
      let geometry = prepared.get(cacheKey);
      if (!geometry) {
        const compact = weld(positions(document.accessors[primitive.attributes.POSITION]), indices(document.accessors[primitive.indices]), height * 0.03 / Math.max(scales.get(cacheKey) ?? 1, 1e-6));
        const vertexData = compact.positions, sourceIndices = compact.indices;
        sourceTriangles += sourceIndices.length / 3;
        const target = sourceIndices.length < 3000 ? sourceIndices.length : Math.max(3, Math.floor(sourceIndices.length * 0.08 / 3) * 3);
        const error = height * 0.02 / Math.max(scales.get(cacheKey) ?? 1, 1e-6);
        const reduced = target === sourceIndices.length ? sourceIndices : MeshoptSimplifier.simplify(sourceIndices, vertexData, 3, target, error, ['ErrorAbsolute'])[0];
        geometry = {positions: vertexData, indices: reduced};
        prepared.set(cacheKey, geometry);
      }
      const {positions: vertices, indices: triangles} = geometry;
      for (let i = 0; i < triangles.length; i += 3) {
        for (let j = 0; j < 3; j++) {
          const offset = triangles[i + j] * 3;
          point[j].set(vertices[offset], vertices[offset + 1], vertices[offset + 2]).applyMatrix4(matrix);
        }
        edgeA.subVectors(point[1], point[0]); edgeB.subVectors(point[2], point[0]);
        if (edgeA.cross(edgeB).lengthSq() < 1e-12) continue;
        const offset = chunkTriangles * 18;
        for (let j = 0; j < 3; j++) for (let axis = 0; axis < 3; axis++) chunk.writeUInt16LE(quantize(point[j].getComponent(axis), axis), offset + j * 6 + axis * 2);
        chunkTriangles++; triangleCount++;
        if (chunkTriangles === 8192) flush();
      }
    }
  }
  flush();
  header.write('NAVG', 0, 'ascii');
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(triangleCount, 8);
  for (let axis = 0; axis < 3; axis++) {header.writeFloatLE(min[axis], 12 + axis * 4); header.writeFloatLE(extent[axis], 24 + axis * 4);}
  writeSync(fd, header, 0, header.length, 0);
} finally {closeSync(fd);}
console.log(`${model.id}: ${triangleCount.toLocaleString()} triangles de collision préparés, ${sourceTriangles.toLocaleString()} triangles source uniques → ${output}`);
