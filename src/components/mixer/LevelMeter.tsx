import { useRef, useEffect } from 'react';

interface Props {
  getLevel: () => number;
  width?: number;
  height?: number;
}

export function LevelMeter({ getLevel, width = 6, height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const peakRef = useRef(0);
  const peakDecay = 0.005;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const level = getLevel();

      if (level > peakRef.current) {
        peakRef.current = level;
      } else {
        peakRef.current = Math.max(0, peakRef.current - peakDecay);
      }

      ctx.clearRect(0, 0, width, height);

      const barHeight = level * height;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#2d6b3f');
      gradient.addColorStop(0.6, '#D4A843');
      gradient.addColorStop(0.85, '#E8C76A');
      gradient.addColorStop(1, '#ff4444');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - barHeight, width, barHeight);

      const peakY = height - peakRef.current * height;
      ctx.fillStyle = '#E8C76A';
      ctx.fillRect(0, peakY, width, 2);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [getLevel, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-sm"
    />
  );
}
