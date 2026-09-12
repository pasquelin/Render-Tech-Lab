import type { RefObject } from 'react';

type ViewportCanvasesProps = {
  webglRef: RefObject<HTMLCanvasElement | null>;
  webgpuRef: RefObject<HTMLCanvasElement | null>;
  showWebgl: boolean;
  showWebgpu: boolean;
};

export function ViewportCanvases({ webglRef, webgpuRef, showWebgl, showWebgpu }: ViewportCanvasesProps) {
  return (
    <>
      <canvas id="canvas-webgl" ref={webglRef} className={`absolute inset-0 w-full h-full block object-cover ${showWebgl ? '' : 'hidden'}`} />
      <canvas id="canvas-webgpu" ref={webgpuRef} className={`absolute inset-0 w-full h-full block object-cover ${showWebgpu ? '' : 'hidden'}`} />
    </>
  );
}
