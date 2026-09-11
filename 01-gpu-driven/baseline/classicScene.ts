import * as THREE from 'three';
import type { MeshInstanceDef, FrameMeasurement } from '../types.ts';
import { createBaseGeometry } from '../common/sceneGenerator.ts';

export class ClassicThreeScene {
  public scene: THREE.Scene;
  public meshes: THREE.Mesh[] = [];
  public totalTriangles: number = 0;
  private baseGeometry: THREE.BufferGeometry;

  constructor(instances: MeshInstanceDef[]) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);

    // Éclairage standard
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(50, 100, 50);
    this.scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(ambLight);

    this.baseGeometry = createBaseGeometry();
    const triCountPerMesh = this.baseGeometry.index
      ? this.baseGeometry.index.count / 3
      : this.baseGeometry.attributes.position.count / 3;

    // Matériaux partagés ou distincts
    // Nous créons des Mesh individuels pour reproduire fidèlement les 2 000 objets uniques
    const materialsCache: THREE.MeshStandardMaterial[] = [];
    for (let c = 0; c < 16; c++) {
      materialsCache.push(
        new THREE.MeshStandardMaterial({
          roughness: 0.35,
          metalness: 0.2,
          color: new THREE.Color().setHSL(c / 16, 0.7, 0.5),
        })
      );
    }

    for (const inst of instances) {
      const mat = materialsCache[inst.id % materialsCache.length];
      const mesh = new THREE.Mesh(this.baseGeometry, mat);
      mesh.position.copy(inst.position);
      mesh.rotation.copy(inst.rotation);
      mesh.scale.copy(inst.scale);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();

      // Forcer le culling frustum standard Three.js
      mesh.frustumCulled = true;

      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    this.totalTriangles = triCountPerMesh * instances.length;
  }

  /**
   * Effectue un rendu classique en mesurant précisément le temps de soumission CPU
   */
  public renderFrame(
    renderer: THREE.WebGLRenderer, // ou WebGPURenderer
    camera: THREE.Camera,
    frameIndex: number
  ): FrameMeasurement {
    const tStartCpu = performance.now();

    // Mesure isolée de la soumission Three.js (traversal + frustum culling CPU + encodage draw calls)
    const tStartSubmit = performance.now();
    renderer.render(this.scene, camera);
    const tEndSubmit = performance.now();

    const tEndCpu = performance.now();

    const submitMs = tEndSubmit - tStartSubmit;
    const cpuFrameMs = tEndCpu - tStartCpu;

    // Récupération des compteurs d'appels de dessin
    const drawCalls = renderer.info?.render?.calls ?? this.meshes.length;
    const triangles = renderer.info?.render?.triangles ?? this.totalTriangles;

    return {
      frameIndex,
      cpuFrameMs,
      submitMs,
      fps: cpuFrameMs > 0 ? 1000 / cpuFrameMs : 60,
      drawCalls,
      triangles,
    };
  }

  public dispose() {
    this.baseGeometry.dispose();
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
    }
    this.meshes = [];
  }
}
