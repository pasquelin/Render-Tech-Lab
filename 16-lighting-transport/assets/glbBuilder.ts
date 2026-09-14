// Écrivain glTF/GLB minimal, sans dépendance : boîtes et sphères unitaires, matériaux PBR par facteurs,
// nœuds nommés avec hiérarchie (pivot/enfant). Le banc l'utilise pour fabriquer sa propre géométrie de test ;
// ce n'est pas un algorithme de rendu ou d'éclairage, seulement une écriture de fichier glTF 2.0 standard.

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type MeshKind = 'box' | 'sphere';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

function padTo4(buffer: Buffer, fill: number): Buffer {
  const remainder = buffer.length % 4;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, fill)]);
}

/** Quaternion (x,y,z,w) pour une rotation autour d'un axe unitaire. */
export function quatFromAxisAngle([ax, ay, az]: Vec3, radians: number): Vec4 {
  const half = radians / 2, s = Math.sin(half);
  return [ax * s, ay * s, az * s, Math.cos(half)];
}

interface RawGeometry { positions: number[]; normals: number[]; indices: number[] }

/** Unit box: X/Z centrés sur -0.5..0.5, Y de 0 (base) à 1 (haut). Normales par face (24 sommets, 36 indices). */
function unitBoxGeometry(): RawGeometry {
  const faces: { normal: Vec3; corners: Vec3[] }[] = [
    { normal: [0, 0, 1], corners: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]] },
    { normal: [0, 0, -1], corners: [[0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]] },
    { normal: [1, 0, 0], corners: [[0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]] },
    { normal: [-1, 0, 0], corners: [[-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]] },
    { normal: [0, 1, 0], corners: [[-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5]] },
    { normal: [0, -1, 0], corners: [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]] },
  ];
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face.corners) { positions.push(...corner); normals.push(...face.normal); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

/** Unit sphere, rayon 0.5 centré sur l'origine, maillage UV. */
function unitSphereGeometry(segments = 20, rings = 14): RawGeometry {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments, theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
      positions.push(x * 0.5, y * 0.5, z * 0.5);
      normals.push(x, y, z);
    }
  }
  const stride = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * stride + s, b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions, normals, indices };
}

interface GltfBufferView { buffer: 0; byteOffset: number; byteLength: number; target?: number }
interface GltfAccessor { bufferView: number; componentType: number; count: number; type: 'VEC3' | 'SCALAR'; min?: number[]; max?: number[] }
interface GltfMaterial { name?: string; pbrMetallicRoughness: { baseColorFactor: Vec4; metallicFactor: number; roughnessFactor: number }; emissiveFactor: Vec3; doubleSided: boolean }
interface GltfPrimitive { attributes: { POSITION: number; NORMAL: number }; indices: number; material: number; mode: 4 }
interface GltfMesh { name?: string; primitives: GltfPrimitive[] }
export interface GltfNode { name: string; mesh?: number; translation?: Vec3; rotation?: Vec4; scale?: Vec3; children?: number[] }

export interface MaterialOptions {
  name?: string;
  baseColorFactor?: Vec4;
  metallicFactor?: number;
  roughnessFactor?: number;
  emissiveFactor?: Vec3;
  doubleSided?: boolean;
}
export interface NodeOptions {
  name: string;
  mesh?: number;
  translation?: Vec3;
  rotation?: Vec4;
  scale?: Vec3;
  children?: number[];
}

export interface GlbBuilder {
  addMaterial(options: MaterialOptions): number;
  addMesh(kind: MeshKind, materialIndex: number, name?: string): number;
  addNode(options: NodeOptions): number;
  build(rootNodeIndices: number[]): Buffer;
  readonly triangleCount: number;
}

export function createGlbBuilder(): GlbBuilder {
  const bufferChunks: Buffer[] = [];
  let bufferByteLength = 0;
  const accessors: GltfAccessor[] = [], bufferViews: GltfBufferView[] = [], materials: GltfMaterial[] = [];
  const meshes: GltfMesh[] = [], nodes: GltfNode[] = [];
  const sharedGeometry = new Map<MeshKind, { positionAccessor: number; normalAccessor: number; indexAccessor: number }>();

  function pushBinary(typedArray: Float32Array | Uint32Array): number {
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const byteOffset = bufferByteLength;
    bufferChunks.push(bytes);
    bufferByteLength += bytes.length;
    const remainder = bufferByteLength % 4;
    if (remainder !== 0) { const pad = 4 - remainder; bufferChunks.push(Buffer.alloc(pad)); bufferByteLength += pad; }
    return byteOffset;
  }

  function addBufferView(byteOffset: number, byteLength: number, target?: number): number {
    bufferViews.push(target === undefined ? { buffer: 0, byteOffset, byteLength } : { buffer: 0, byteOffset, byteLength, target });
    return bufferViews.length - 1;
  }

  function addVec3Accessor(values: number[]): number {
    const array = new Float32Array(values);
    const byteOffset = pushBinary(array);
    const view = addBufferView(byteOffset, array.byteLength, 34962);
    const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < values.length; i += 3) for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], values[i + axis]);
      maximum[axis] = Math.max(maximum[axis], values[i + axis]);
    }
    accessors.push({ bufferView: view, componentType: 5126, count: values.length / 3, type: 'VEC3', min: minimum, max: maximum });
    return accessors.length - 1;
  }

  function addIndexAccessor(values: number[]): number {
    const array = new Uint32Array(values);
    const byteOffset = pushBinary(array);
    const view = addBufferView(byteOffset, array.byteLength, 34963);
    accessors.push({ bufferView: view, componentType: 5125, count: values.length, type: 'SCALAR' });
    return accessors.length - 1;
  }

  function geometryFor(kind: MeshKind) {
    const cached = sharedGeometry.get(kind);
    if (cached) return cached;
    const built = kind === 'box' ? unitBoxGeometry() : unitSphereGeometry();
    const entry = {
      positionAccessor: addVec3Accessor(built.positions),
      normalAccessor: addVec3Accessor(built.normals),
      indexAccessor: addIndexAccessor(built.indices),
    };
    sharedGeometry.set(kind, entry);
    return entry;
  }

  function addMaterial(options: MaterialOptions): number {
    const { name, baseColorFactor = [0.8, 0.8, 0.8, 1], metallicFactor = 0, roughnessFactor = 0.7, emissiveFactor = [0, 0, 0], doubleSided = false } = options;
    materials.push({ name, pbrMetallicRoughness: { baseColorFactor, metallicFactor, roughnessFactor }, emissiveFactor, doubleSided });
    return materials.length - 1;
  }

  const meshCache = new Map<string, number>();
  function addMesh(kind: MeshKind, materialIndex: number, name?: string): number {
    const cacheKey = kind + ':' + materialIndex;
    const cached = meshCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const geometry = geometryFor(kind);
    meshes.push({
      name,
      primitives: [{
        attributes: { POSITION: geometry.positionAccessor, NORMAL: geometry.normalAccessor },
        indices: geometry.indexAccessor,
        material: materialIndex,
        mode: 4,
      }],
    });
    const index = meshes.length - 1;
    meshCache.set(cacheKey, index);
    return index;
  }

  /** translation/rotation(quat)/scale : pose de repos. Le banc anime ces nœuds à l'exécution, pas ce fichier. */
  function addNode(options: NodeOptions): number {
    const { name, mesh, translation, rotation, scale, children } = options;
    const node: GltfNode = { name };
    if (mesh !== undefined) node.mesh = mesh;
    if (translation) node.translation = translation;
    if (rotation) node.rotation = rotation;
    if (scale) node.scale = scale;
    if (children && children.length) node.children = children;
    nodes.push(node);
    return nodes.length - 1;
  }

  function build(rootNodeIndices: number[]): Buffer {
    const buffer = Buffer.concat(bufferChunks, bufferByteLength);
    const json = {
      asset: { version: '2.0', generator: 'render-tech-lab/16-lighting-transport house.ts' },
      scene: 0,
      scenes: [{ nodes: rootNodeIndices }],
      nodes,
      meshes,
      materials,
      accessors,
      bufferViews,
      buffers: [{ byteLength: buffer.length }],
    };
    const jsonBuffer = padTo4(Buffer.from(JSON.stringify(json)), 0x20);
    const binBuffer = padTo4(buffer, 0);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(GLB_MAGIC, 0);
    header.writeUInt32LE(2, 4);
    const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
    header.writeUInt32LE(totalLength, 8);
    const jsonChunkHeader = Buffer.alloc(8);
    jsonChunkHeader.writeUInt32LE(jsonBuffer.length, 0);
    jsonChunkHeader.writeUInt32LE(JSON_CHUNK, 4);
    const binChunkHeader = Buffer.alloc(8);
    binChunkHeader.writeUInt32LE(binBuffer.length, 0);
    binChunkHeader.writeUInt32LE(BIN_CHUNK, 4);
    return Buffer.concat([header, jsonChunkHeader, jsonBuffer, binChunkHeader, binBuffer]);
  }

  return {
    addMaterial, addMesh, addNode, build,
    get triangleCount() { return meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, p) => n + accessors[p.indices].count / 3, 0), 0); },
  };
}
