/** Visibility is derived from the same module/mode that owns rendering. */
export function canvasVisibility(moduleId: string, mode: string) {
  const dualPipeline = moduleId === '01-indirect-draw' || moduleId === '03-gpu-scene';
  const integrated = moduleId === '02-gpu-frustum-culling' || /^0[5-9]-|^1[0-2]-/.test(moduleId);
  return {
    showWebgl: (dualPipeline && mode === 'classic') || moduleId === '14-open-world',
    showWebgpu: (dualPipeline && mode !== 'classic') || integrated || moduleId === '04-gpu-lod',
  };
}
