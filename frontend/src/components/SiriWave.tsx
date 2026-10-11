import { useEffect, useRef, type MutableRefObject } from 'react';
import type { OrbState } from '@/types';
import { cn } from '@/lib/utils';

export interface SiriWaveProps {
  /** True while JARVIS is speaking. */
  active?: boolean;
  /** Current assistant orb state: 'idle' (ready) | 'listening' | 'thinking' | 'speaking' */
  state?: OrbState;
  /** Speech energy 0..1 bumped on each spoken word */
  energyRef?: MutableRefObject<number>;
  height?: number;
  className?: string;
}

export function SiriWave({
  active = false,
  state,
  energyRef,
  height = 56,
  className,
}: SiriWaveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveState: OrbState = state ?? (active ? 'speaking' : 'idle');
  const stateRef = useRef(effectiveState);
  stateRef.current = effectiveState;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let paused = false;
    let time = 0;
    let curAmp = 3.0; // Current smooth amplitude
    let lastTime = performance.now();

    const resize = () => {
      if (!container || !canvas) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dpr = reduceMotion
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 2);

      const w = container.clientWidth || 360;
      const h = height;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const render = (now: number) => {
      if (paused) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      time += dt;

      const st = stateRef.current;
      const w = container.clientWidth || 360;
      const h = height;
      const midY = h / 2;

      // Determine target amplitude per state
      // READY = calm flat line (~2.5px micro-breath)
      // LISTENING = gentle wave (~9px)
      // THINKING = soft ripple (~12px)
      // SPEAKING = full amplitude (~22px + speech energy)
      let targetAmp = 2.5;
      let waveSpeed = 1.8;

      if (st === 'listening') {
        let energy = 0;
        if (energyRef) {
          energy = energyRef.current;
        }
        targetAmp = 7.0 + energy * 18.0;
        waveSpeed = 3.2;
      } else if (st === 'thinking') {
        targetAmp = 11.5;
        waveSpeed = 2.4;
      } else if (st === 'speaking') {
        let energy = 0;
        if (energyRef) {
          energy = energyRef.current;
          energyRef.current = energy * Math.exp(-dt * 5.0);
        }
        targetAmp = 18.0 + energy * 16.0;
        waveSpeed = 5.0;
      }

      // Smooth amplitude easing (~200ms)
      const easeK = 1 - Math.exp(-dt / 0.20);
      curAmp += (targetAmp - curAmp) * easeK;

      // Detect theme for colors
      const isLight =
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('data-theme') === 'light';

      const cyanColor = isLight ? '#0E7490' : '#22d3ee';
      const secondaryColor = isLight ? '#0B1620' : '#FFFFFF';
      const glowColor = isLight ? 'rgba(14, 116, 144, 0.35)' : 'rgba(34, 211, 238, 0.45)';

      // Clear frame
      ctx.clearRect(0, 0, w, h);

      // Helper to draw a single tapered sine strand
      const drawStrand = (
        color: string,
        lineWidth: number,
        freq: number,
        phase: number,
        ampMultiplier: number,
        withGlow = false
      ) => {
        ctx.save();
        ctx.beginPath();

        if (withGlow) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 10;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const step = 4;
        for (let x = 0; x <= w; x += step) {
          // Normalised x 0..1
          const normX = x / w;
          // Smooth bell envelope tapering to 0 at edges
          const env = Math.sin(normX * Math.PI);
          const y = midY + Math.sin(normX * freq * Math.PI * 2 + phase) * curAmp * ampMultiplier * env;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.restore();
      };

      // 1. Third harmonic ambient strand (subtle cyan depth)
      drawStrand(cyanColor + (isLight ? '40' : '50'), 1.2, 1.8, time * waveSpeed * 0.7 + 1.2, 0.6, false);

      // 2. Secondary thin strand (white in dark, ink in light theme)
      drawStrand(secondaryColor, 1.3, 2.4, time * waveSpeed * 1.1 + 0.8, 0.75, false);

      // 3. Main hero cyan strand with soft radiant glow
      drawStrand(cyanColor, 2.2, 2.0, time * waveSpeed, 1.0, true);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        if (animId) cancelAnimationFrame(animId);
      } else {
        paused = false;
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full max-w-[360px] flex items-center justify-center overflow-hidden pointer-events-none select-none',
        className
      )}
      style={{ height }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: '100%', height }}
      />
    </div>
  );
}
