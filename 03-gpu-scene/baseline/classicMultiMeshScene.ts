import * as THREE from 'three';

export class ClassicMultiMeshScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private meshes: THREE.Mesh[] = [];
  /** Conteneur dédié : permet un détachement en O(1) sans toucher aux lumières. */
  private meshRoot = new THREE.Group();

  /**
   * @param renderer Renderer partagé du banc : un canvas n'a qu'un seul contexte
   *                 WebGL, en instancier un second ici désynchroniserait l'état
   *                 GL et fausserait `info.render.calls`.
   */
  constructor(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement) {
    this.renderer = renderer;
    this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1c212a');

    this.camera = new THREE.PerspectiveCamera(
      60,
      (canvas.clientWidth || 800) / (canvas.clientHeight || 600),
      0.1,
      1000
    );
    this.camera.position.set(0, 25, 80);

    // Éclairage d'ambiance et directionnel basique
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(50, 100, 50);
    this.scene.add(dirLight);

    this.scene.add(this.meshRoot);
  }

  public populate(meshes: THREE.Mesh[]) {
    // Détachement en un seul coup : scene.remove() par mesh était en O(n²)
    // (indexOf + splice pour chacun des n meshes).
    this.meshRoot.clear();

    // Les géométries et matériaux sont partagés entre meshes : on déduplique
    // avant de libérer, sinon la VRAM de chaque scénario de la matrice fuit.
    const staleGeometries = new Set<THREE.BufferGeometry>();
    const staleMaterials = new Set<THREE.Material>();
    for (const m of this.meshes) {
      staleGeometries.add(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        staleMaterials.add(mat);
      }
    }
    for (const m of meshes) {
      staleGeometries.delete(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        staleMaterials.delete(mat);
      }
    }
    for (const g of staleGeometries) g.dispose();
    for (const mat of staleMaterials) mat.dispose();

    this.meshes = meshes;
    for (const m of this.meshes) {
      this.meshRoot.add(m);
    }
  }

  public updateDynamicObjects(time: number, dynamicRatio: number) {
    const dynamicCount = Math.floor(this.meshes.length * dynamicRatio);
    for (let i = 0; i < dynamicCount; i++) {
      const mesh = this.meshes[i];
      mesh.rotation.y += 0.02;
      mesh.rotation.x += 0.01;
      mesh.position.y += Math.sin(time * 0.003 + i) * 0.05;
    }
  }

  public render(): { submitMs: number; drawCalls: number } {
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    const submitMs = performance.now() - t0;

    return {
      submitMs,
      drawCalls: this.renderer.info.render.calls,
    };
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
