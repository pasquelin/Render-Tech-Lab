export interface GPUObjectData {
  transform: Float32Array; // mat4x4 (16 floats = 64 octets)
  boundingCenterRadius: [number, number, number, number]; // [x, y, z, radius] (16 octets)
  geometryId: number;      // u32 (4 octets)
  materialId: number;      // u32 (4 octets)
  flags: number;           // u32 (4 octets)
  padding: number;         // u32 (4 octets alignement 16-octets)
}

export interface GPUGeometryData {
  vertexOffset: number;    // Sommet de départ dans le méga vertex buffer (u32)
  indexOffset: number;     // Index de départ dans le méga index buffer (u32)
  indexCount: number;      // Nombre d'indices à tirer (u32)
  instanceOffset: number;  // Offset de début dans visibleIndices (u32)
  maxInstances: number;    // Capacité maximale d'instances pour cette géométrie
  boundingRadius: number;  // Rayon englobant local (f32)
}

export interface GPUMaterialData {
  color: [number, number, number, number];    // [r, g, b, roughness] (16 octets)
  parameters: [number, number, number, number]; // [metalness, flags, unused, unused] (16 octets)
}

export interface SceneStressConfig {
  name: string;
  dimension: 'A-geometry' | 'B-material' | 'C-dynamic' | 'D-visibility';
  objectCount: number;
  geometryCount: number; // Ex: 1, 10, 100, 1000
  materialCount: number; // Ex: 1, 10, 100, 1000
  dynamicRatio: number;  // Ex: 0.0 (statique), 0.1 (10%), 0.5 (50%), 1.0 (100%)
  targetVisibility: number; // Ex: 0.1 (10% visible), 0.5, 1.0
}

/**
 * Résultat d'un tier A/B.
 * `null` signifie « non instrumenté sur ce mode » — jamais une valeur estimée :
 * un rapport ne doit pas pouvoir présenter une constante comme une mesure.
 */
export interface GpuSceneBenchResult {
  mode: 'classic' | 'gpu-scene';
  config: SceneStressConfig;
  avgCpuSubmitMs: number;
  avgCpuFrameMs: number;
  drawCalls: number;
  culledObjects: number | null;
  visibleObjects: number | null;
  gpuMemoryBytes: number | null;
  gpuFrameMs?: number | null;
}
