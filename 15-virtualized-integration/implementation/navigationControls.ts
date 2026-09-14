import * as THREE from 'three';
import {advancePlayer, startPosition, walkDirection, type NavigationWorld} from './navigation.ts';

export type NavigationMode = 'free' | 'game';

const HANDLED_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Controls are owned by one explorer canvas and removed on engine switch or stop. */
export function createNavigationControls(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, world: NavigationWorld, mode: NavigationMode, initialCity: number) {
  const keys = new Set<string>();
  const movement = new THREE.Vector3();
  const look = camera.getWorldDirection(new THREE.Vector3());
  let yaw = Math.atan2(-look.x, -look.z);
  let pitch = Math.asin(THREE.MathUtils.clamp(look.y, -1, 1));
  let dragging = false;
  let lastX = 0, lastY = 0, velocityY = 0, jumpPendingUntil = 0;
  const lastSafePosition = new THREE.Vector3();
  const reset = (city: number) => {
    camera.position.copy(startPosition(world, city));
    lastSafePosition.copy(camera.position);
    yaw = 0; pitch = 0; velocityY = 0; jumpPendingUntil = 0;
    camera.rotation.set(0, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  };
  reset(initialCity);
  const active = () => document.pointerLockElement === canvas || document.activeElement === canvas;
  const keyDown = (event: KeyboardEvent) => {
    if (!active()) return;
    if (HANDLED_KEYS.has(event.code)) event.preventDefault();
    if (mode === 'game' && event.code === 'Space' && !keys.has('Space')) jumpPendingUntil = performance.now() + 500;
    keys.add(event.code);
  };
  const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const clearKeys = () => {keys.clear(); jumpPendingUntil = 0; dragging = false;};
  const mouseMove = (event: MouseEvent) => {
    const looking = mode === 'game' ? document.pointerLockElement === canvas : dragging;
    if (!looking) return;
    const dx = mode === 'game' ? event.movementX : event.clientX - lastX;
    const dy = mode === 'game' ? event.movementY : event.clientY - lastY;
    lastX = event.clientX; lastY = event.clientY;
    yaw -= dx * 0.002;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.002, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    canvas.focus();
    if (mode === 'game') { void canvas.requestPointerLock().catch(() => {}); return; }
    dragging = true; lastX = event.clientX; lastY = event.clientY;
  };
  const pointerUp = () => {dragging = false;};
  const contextMenu = (event: MouseEvent) => event.preventDefault();
  const lockChange = () => {if (mode === 'game' && document.pointerLockElement !== canvas) clearKeys();};
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('contextmenu', contextMenu);
  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointerlockchange', lockChange);
  window.addEventListener('blur', clearKeys);
  return {
    update(seconds: number) {
      const dt = Math.max(0, Math.min(seconds, 0.05));
      if (!dt || !active()) return;
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const speed = mode === 'game'
        ? Math.max(3.8, Math.min(world.cityWidth, world.cityDepth) * 0.018)
        : Math.max(3, Math.min(world.cityWidth, world.cityDepth) * 0.045);
      walkDirection(movement, yaw, forward, right).multiplyScalar(speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.8 : 1));
      if (mode === 'game') {
        const jump = jumpPendingUntil > performance.now();
        const next = advancePlayer(world, camera.position, velocityY, movement, dt, jump);
        camera.position.copy(next.position);
        velocityY = next.velocityY;
        if (next.jumped) jumpPendingUntil = 0;
        if (next.support !== null && Math.abs(camera.position.y - world.height - next.support) < world.height * 0.03)
          lastSafePosition.copy(camera.position);
        if (camera.position.y < lastSafePosition.y - world.height * 3) {
          camera.position.copy(lastSafePosition);
          velocityY = 0;
          jumpPendingUntil = 0;
        }
      } else {
        camera.position.copy(world.move(camera.position, movement.multiplyScalar(dt)));
        const vertical = Number(keys.has('KeyR')) - Number(keys.has('KeyF'));
        const floor = world.floorAt(camera.position.x, camera.position.z, camera.position.y - world.height);
        camera.position.y = floor === null ? camera.position.y + vertical * speed * dt :
          Math.max(floor + world.height, camera.position.y + vertical * speed * dt);
      }
      camera.updateMatrixWorld();
    },
    reset,
    dispose() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('contextmenu', contextMenu);
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointerlockchange', lockChange);
      window.removeEventListener('blur', clearKeys);
      clearKeys();
    },
  };
}
