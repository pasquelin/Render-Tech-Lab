import * as THREE from 'three';
import type {
  GPUObjectData,
  GPUGeometryData,
  GPUMaterialData,
  SceneStressConfig,
} from '../types.ts';

export interface GeneratedGPUScene {
  objects: GPUObjectData[];
  geometries: GPUGeometryData[];
  materials: GPUMaterialData[];
  mergedVertexBuffer: Float32Array; // [x, y, z, nx, ny, nz]
  mergedIndexBuffer: Uint32Array;
  threeMeshes: THREE.Mesh[]; // Pour la baseline Three.js classique
}

// Générateur de géométries procédurales distinctes
export function createVariedGeometries(count: number): {
  geometries: GPUGeometryData[];
  mergedVertices: Float32Array;
  mergedIndices: Uint32Array;
  threeGeometries: THREE.BufferGeometry[];
} {
  const threeGeoms: THREE.BufferGeometry[] = [];
  const geomDataList: GPUGeometryData[] = [];

  let currentVertexOffset = 0;
  let currentIndexOffset = 0;

  // Passe 1 : création des géométries et comptage, pour allouer les méga-tampons
  // à leur taille exacte (l'accumulation via number[] + copie finale coûtait
  // deux fois la mémoire et une passe de copie complète).
  for (let i = 0; i < count; i++) {
    // Variations procédurales de formes pour simuler des géométries réelles hétérogènes
    let geom: THREE.BufferGeometry;
    const shapeType = i % 5;
    const detail = Math.max(3, 4 + (i % 6));

    if (shapeType === 0) {
      geom = new THREE.BoxGeometry(2, 2, 2, 1 + (i % 3), 1 + (i % 3), 1 + (i % 3));
    } else if (shapeType === 1) {
      geom = new THREE.SphereGeometry(1.2, detail, detail);
    } else if (shapeType === 2) {
      geom = new THREE.CylinderGeometry(0.8, 1.2, 2.5, detail);
    } else if (shapeType === 3) {
      geom = new THREE.TorusGeometry(1.0, 0.4, Math.max(4, detail), detail);
    } else {
      geom = new THREE.IcosahedronGeometry(1.3, (i % 2));
    }

    geom.computeVertexNormals();
    threeGeoms.push(geom);

    const pos = geom.getAttribute('position');
    const idx = geom.getIndex();

    const vertexCount = pos.count;
    const indexCount = idx ? idx.count : 0;

    geom.computeBoundingSphere();
    const radius = geom.boundingSphere ? geom.boundingSphere.radius : 1.5;

    geomDataList.push({
      vertexOffset: currentVertexOffset,
      indexOffset: currentIndexOffset,
      indexCount: indexCount,
      instanceOffset: 0,
      maxInstances: 0,
      boundingRadius: radius,
    });

    currentVertexOffset += vertexCount;
    currentIndexOffset += indexCount;
  }

  // Passe 2 : remplissage des méga-tampons à taille exacte, par accès direct
  // aux tableaux sous-jacents (getX/getY/getZ coûtaient 6 appels par sommet).
  const mergedVertices = new Float32Array(currentVertexOffset * 6);
  const mergedIndices = new Uint32Array(currentIndexOffset);

  for (let i = 0; i < threeGeoms.length; i++) {
    const geom = threeGeoms[i];
    const data = geomDataList[i];
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const idx = geom.getIndex();

    const posArray = pos.array as ArrayLike<number>;
    const normArray = norm ? (norm.array as ArrayLike<number>) : null;

    let out = data.vertexOffset * 6;
    for (let v = 0; v < pos.count; v++) {
      const p = v * 3;
      mergedVertices[out++] = posArray[p];
      mergedVertices[out++] = posArray[p + 1];
      mergedVertices[out++] = posArray[p + 2];
      mergedVertices[out++] = normArray ? normArray[p] : 0;
      mergedVertices[out++] = normArray ? normArray[p + 1] : 1;
      mergedVertices[out++] = normArray ? normArray[p + 2] : 0;
    }

    if (idx) {
      mergedIndices.set(idx.array as ArrayLike<number>, data.indexOffset);
    }
  }

  return {
    geometries: geomDataList,
    mergedVertices,
    mergedIndices,
    threeGeometries: threeGeoms,
  };
}

// Générateur de matériaux variés
export function createVariedMaterials(count: number): {
  materials: GPUMaterialData[];
  threeMaterials: THREE.MeshStandardMaterial[];
} {
  const materials: GPUMaterialData[] = [];
  const threeMaterials: THREE.MeshStandardMaterial[] = [];

  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden ratio pour répartition uniforme
    const color = new THREE.Color().setHSL(hue / 360, 0.75, 0.55);
    const roughness = 0.2 + ((i * 17) % 80) / 100;
    const metalness = ((i * 31) % 100) / 100;

    materials.push({
      color: [color.r, color.g, color.b, roughness],
      parameters: [metalness, 0, 0, 0],
    });

    threeMaterials.push(
      new THREE.MeshStandardMaterial({
        color: color,
        roughness: roughness,
        metalness: metalness,
      })
    );
  }

  return { materials, threeMaterials };
}

// Générateur de la scène complète selon la configuration de stress
export function generateStressScene(config: SceneStressConfig): GeneratedGPUScene {
  const { geometries, mergedVertices, mergedIndices, threeGeometries } =
    createVariedGeometries(config.geometryCount);
  const { materials, threeMaterials } = createVariedMaterials(config.materialCount);

  // Calcul des offsets d'instances et capacités par topologie géométrique
  let runningInstanceOffset = 0;
  for (let g = 0; g < geometries.length; g++) {
    const count = Math.floor(config.objectCount / geometries.length) + (g < (config.objectCount % geometries.length) ? 1 : 0);
    geometries[g].instanceOffset = runningInstanceOffset;
    geometries[g].maxInstances = count;
    runningInstanceOffset += count;
  }

  const objects: GPUObjectData[] = [];
  const threeMeshes: THREE.Mesh[] = [];

  const spread = Math.cbrt(config.objectCount) * 12.0;
  const tempMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  // Une seule allocation pour toutes les transforms : chaque objet reçoit une
  // vue subarray, au lieu de N petits Float32Array(16).
  const transformPool = new Float32Array(config.objectCount * 16);

  for (let i = 0; i < config.objectCount; i++) {
    const geomId = i % geometries.length;
    const matId = i % materials.length;

    // Répartition dans l'espace
    position.set(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread * 2
    );

    rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    quaternion.setFromEuler(rotation);

    const s = 0.8 + Math.random() * 0.6;
    scale.set(s, s, s);

    tempMatrix.compose(position, quaternion, scale);

    const transformArray = transformPool.subarray(i * 16, i * 16 + 16);
    tempMatrix.toArray(transformArray);

    const radius = geometries[geomId].boundingRadius * s;
    const isDynamic = Math.random() < config.dynamicRatio;

    objects.push({
      transform: transformArray,
      boundingCenterRadius: [0, 0, 0, radius],
      geometryId: geomId,
      materialId: matId,
      flags: isDynamic ? 1 : 0,
      padding: 0,
    });

    // Équivalent Three.js pour le test A baseline
    const mesh = new THREE.Mesh(threeGeometries[geomId], threeMaterials[matId]);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    mesh.scale.copy(scale);
    threeMeshes.push(mesh);
  }

  return {
    objects,
    geometries,
    materials,
    mergedVertexBuffer: mergedVertices,
    mergedIndexBuffer: mergedIndices,
    threeMeshes,
  };
}
