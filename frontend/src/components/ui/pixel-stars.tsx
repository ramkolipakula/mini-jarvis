import { useEffect, useRef } from 'react';

interface PixelStarsProps {
  className?: string;
  opacity?: number;
  active?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  colorType: 'cyan' | 'white' | 'dim';
}

export function PixelStars({
  className = '',
  opacity = 0.28,
  active = true,
}: PixelStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Create 90 subtle stars across the screen
    const starCount = 90;
    const stars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      const rand = Math.random();
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.25 ? 2 : 1, // 1px or 2px
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        colorType: rand < 0.45 ? 'cyan' : rand < 0.8 ? 'white' : 'dim',
      });
    }

    let isHidden = false;
    const handleVisibility = () => {
      isHidden = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let lastTime = performance.now();

    const render = () => {
      if (isHidden) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      for (let i = 0; i < starCount; i++) {
        const s = stars[i];
        s.y -= s.speed * dt * 8; // subtle upward drift
        if (s.y < 0) {
          s.y = height;
          s.x = Math.random() * width;
        }

        const twinkle = Math.sin(now * 0.002 * s.speed + s.phase) * 0.35 + 0.65;
        const a = twinkle * opacity;

        if (isLight) {
          // Ink-toned cyan in light mode
          ctx.fillStyle =
            s.colorType === 'cyan'
              ? `rgba(14, 116, 144, ${a * 0.8})`
              : `rgba(11, 22, 32, ${a * 0.7})`;
        } else {
          // Cyan & White in dark mode
          ctx.fillStyle =
            s.colorType === 'cyan'
              ? `rgba(34, 211, 238, ${a})`
              : s.colorType === 'white'
              ? `rgba(255, 255, 255, ${a})`
              : `rgba(125, 211, 252, ${a * 0.6})`;
        }

        // Draw crisp 1-2px pixel square
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
    };
  }, [active, opacity]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
