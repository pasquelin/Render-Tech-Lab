import * as THREE from 'three';

/**
 * Normalised S0–S5 load scenarios:
 * S0 : Baseline minimale (1 cube, 1 lumière)
 * S1 : 500 objets instanciés (InstancedMesh)
 * S2 : 1 000 objets instanciés
 * S3 : 2 000 objets uniques (stress soumission CPU - Mesh individuels)
 * S4 : 30 lumières dynamiques (stress passes GPU)
 * S5 : Hostile (cumul géométrie dense 5 000 objets, lumières dynamiques, ombres)
 */
export type ScenarioId = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export interface BaselineScenarioDef {
  id: ScenarioId;
  name: string;
  description: string;
  objectCount: number;
  isInstanced: boolean;
  lightCount: number;
}

/** Stable PRNG: every baseline run receives the exact same scene layout. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

export const BASELINE_SCENARIOS: BaselineScenarioDef[] = [
  { id: 'S0', name: 'Minimal baseline', description: 'Minimal control scene', objectCount: 1, isInstanced: false, lightCount: 1 },
  { id: 'S1', name: '500 instanced', description: 'Standard Three.js instancing test', objectCount: 500, isInstanced: true, lightCount: 2 },
  { id: 'S2', name: '1 000 instanced', description: 'Instanced geometry scale-up', objectCount: 1000, isInstanced: true, lightCount: 2 },
  { id: 'S3', name: '2 000 unique', description: 'CPU submission bottleneck', objectCount: 2000, isInstanced: false, lightCount: 2 },
  { id: 'S4', name: '30 dynamic lights', description: 'Lighting and forward/deferred pass stress', objectCount: 200, isInstanced: true, lightCount: 30 },
  { id: 'S5', name: 'Hostile', description: 'Dense geometry combined with multiple loads', objectCount: 5000, isInstanced: false, lightCount: 8 },
];

export class ReferenceEngineScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public objects: THREE.Object3D[] = [];
  public scenario: BaselineScenarioDef;

  constructor(scenario: BaselineScenarioDef) {
    this.scenario = scenario;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    this.camera.position.set(0, 20, 60);
    this.camera.lookAt(0, 0, 0);

    this.setupLighting();
    this.setupGeometry();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0x223344, 1.0);
    this.scene.add(ambient);

    for (let i = 0; i < this.scenario.lightCount; i++) {
      const angle = (i / this.scenario.lightCount) * Math.PI * 2;
      const light = new THREE.PointLight(
        new THREE.Color().setHSL(i / this.scenario.lightCount, 0.8, 0.6),
        5.0,
        50
      );
      light.position.set(Math.cos(angle) * 30, 10 + (i % 5) * 3, Math.sin(angle) * 30);
      this.scene.add(light);
    }
  }

  private setupGeometry() {
    const rng = createSeededRandom(0x00ba5e1 + Number(this.scenario.id.slice(1)));
    const geom = new THREE.SphereGeometry(1.0, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });

    if (this.scenario.isInstanced) {
      const instMesh = new THREE.InstancedMesh(geom, mat, this.scenario.objectCount);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.scenario.objectCount; i++) {
        dummy.position.set(
          (rng() - 0.5) * 80,
          (rng() - 0.5) * 30,
          (rng() - 0.5) * 80
        );
        dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(instMesh);
      this.objects.push(instMesh);
    } else {
      for (let i = 0; i < this.scenario.objectCount; i++) {
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(
          (rng() - 0.5) * 100,
          (rng() - 0.5) * 40,
          (rng() - 0.5) * 100
        );
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.scene.add(mesh);
        this.objects.push(mesh);
      }
    }
  }

  public render(renderer: THREE.WebGLRenderer) {
    const t0 = performance.now();
    renderer.render(this.scene, this.camera);
    const t1 = performance.now();
    return {
      submitMs: t1 - t0,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }

  public dispose() {
    for (const obj of this.objects) {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(material => material.dispose());
      }
      this.scene.remove(obj);
    }
    this.objects.length = 0;
  }
}
