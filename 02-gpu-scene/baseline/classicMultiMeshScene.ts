import * as THREE from 'three';

export class ClassicMultiMeshScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private meshes: THREE.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

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
  }

  public populate(meshes: THREE.Mesh[]) {
    // Nettoyage de l'ancienne scène
    for (const m of this.meshes) {
      this.scene.remove(m);
    }
    this.meshes = meshes;
    for (const m of this.meshes) {
      this.scene.add(m);
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
