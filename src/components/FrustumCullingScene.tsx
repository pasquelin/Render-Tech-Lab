import { useEffect, useRef } from 'react';

type FrustumCullingSceneProps = {
  instanceCount: number;
  onFirstFrame: () => void;
};

const fallbackInstanceCount = 500;
function resolvedInstanceCount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : fallbackInstanceCount;
}

export function FrustumCullingScene({ instanceCount, onFirstFrame }: FrustumCullingSceneProps) {
  const count = resolvedInstanceCount(instanceCount);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrame = 0;
    const draw = (time: number) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cssWidth = width / ratio;
      const cssHeight = height / ratio;
      context.fillStyle = '#101722';
      context.fillRect(0, 0, cssWidth, cssHeight);

      context.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      context.lineWidth = 1;
      for (let x = 0; x < cssWidth; x += 42) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, cssHeight); context.stroke();
      }
      for (let y = 0; y < cssHeight; y += 42) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(cssWidth, y); context.stroke();
      }

      const originX = cssWidth * 0.14;
      const originY = cssHeight * 0.5;
      const reach = cssWidth * 0.72;
      const halfHeight = cssHeight * 0.36;
      context.fillStyle = 'rgba(34, 211, 238, 0.08)';
      context.strokeStyle = 'rgba(34, 211, 238, 0.75)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(originX, originY);
      context.lineTo(originX + reach, originY - halfHeight);
      context.lineTo(originX + reach, originY + halfHeight);
      context.closePath();
      context.fill();
      context.stroke();

      const phase = time * 0.00045;
      const displayedInstances = Math.min(260, Math.max(32, Math.round(32 + Math.log2(Math.max(1, count) / 500) * 42)));
      for (let index = 0; index < displayedInstances; index += 1) {
        const lane = (index * 37) % 83;
        const x = cssWidth * (0.04 + ((index * 0.071 + phase) % 0.92));
        const y = cssHeight * (0.09 + lane / 101);
        const relativeX = (x - originX) / reach;
        const inside = relativeX >= 0 && relativeX <= 1 && Math.abs(y - originY) <= halfHeight * relativeX;
        context.fillStyle = inside ? '#67e8f9' : 'rgba(148, 163, 184, 0.35)';
        context.beginPath();
        context.arc(x, y, inside ? 3.5 : 2.2, 0, Math.PI * 2);
        context.fill();
      }

      if (!readyRef.current) {
        readyRef.current = true;
        onFirstFrame();
      }
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [count, onFirstFrame]);

  return <canvas ref={canvasRef} data-bench-scene="02-gpu-frustum-culling" data-instance-count={count} aria-label={`Scène animée du culling de frustum · ${count.toLocaleString('fr-FR')} instances`} className="absolute inset-0 block h-full w-full" />;
}
