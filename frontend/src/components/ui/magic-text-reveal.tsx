import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface MagicTextRevealProps {
  text?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  letterSpacing?: string;
  spread?: number;
  speed?: number;
  density?: number;
  /** If provided, manually controls whether particles assemble into text (true) or disperse (false) */
  isAssembled?: boolean;
  /** Whether to trigger disperse/reform on hover */
  hoverable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onAssembled?: () => void;
  onDispersed?: () => void;
}

interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  color: string;
  opacity: number;
  originalAlpha: number;
  floatingOffsetX: number;
  floatingOffsetY: number;
  floatingSpeed: number;
  floatingAngle: number;
  targetOpacity: number;
  sparkleSpeed: number;
}

export function MagicTextReveal({
  text = 'JARVIS',
  color = 'rgba(255, 255, 255, 1)',
  fontSize = 64,
  fontFamily = 'Inter, system-ui, -apple-system, sans-serif',
  fontWeight = 300,
  letterSpacing = '0.35em',
  spread = 45,
  speed = 0.5,
  density = 4,
  isAssembled: controlledAssembled,
  hoverable = false,
  className = '',
  style = {},
  onAssembled,
  onDispersed,
}: MagicTextRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  const [hovered, setHovered] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [textMetrics, setTextMetrics] = useState({ width: 0, height: 0 });

  // Effective assembly state: controlled prop takes precedence, otherwise hoverable state
  const isTargetAssembled = controlledAssembled !== undefined ? controlledAssembled : hovered;

  const densityStep = 6 - density;
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reducedMotion ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2);
  }, []);

  // Measure text dimensions
  const measure = useCallback(
    (t: string, size: number, weight: number | string, font: string, spacing: string) => {
      if (typeof window === 'undefined') return { width: 300, height: 80 };
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d');
      if (!ctx) return { width: 300, height: 80 };

      // Set letter spacing if supported
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = spacing;
      }
      ctx.font = `${weight} ${size}px ${font}`;
      const metrics = ctx.measureText(t);
      const w = Math.ceil(metrics.width + size * 0.8);
      const h = Math.ceil(size * 1.5);
      return { width: Math.max(w, 160), height: Math.max(h, 60) };
    },
    []
  );

  useEffect(() => {
    const measured = measure(text, fontSize, fontWeight, fontFamily, letterSpacing);
    setTextMetrics(measured);
  }, [text, fontSize, fontWeight, fontFamily, letterSpacing, measure]);

  // Sample particles from rendered text pixels (21st.dev implementation)
  const sampleParticles = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      str: string,
      cx: number,
      cy: number,
      fontStr: string,
      spacing: string,
      fillColor: string,
      step: number
    ): Particle[] => {
      const particles: Particle[] = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = spacing;
      }
      ctx.fillStyle = fillColor;
      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = true;
      ctx.fillText(str, cx, cy);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const cssW = parseInt(canvas.style.width) || canvas.width;
      const dprRatio = canvas.width / cssW;
      const sampleStep = Math.max(2, Math.round(dprRatio)) * step;

      let minX = canvas.width,
        maxX = 0,
        minY = canvas.height,
        maxY = 0;

      for (let y = 0; y < canvas.height; y += sampleStep) {
        for (let x = 0; x < canvas.width; x += sampleStep) {
          const idx = (y * canvas.width + x) * 4;
          if (data[idx + 3] > 0) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const bboxSpan = Math.max(maxX - minX, maxY - minY) * 0.12;

      for (let y = 0; y < canvas.height; y += sampleStep) {
        for (let x = 0; x < canvas.width; x += sampleStep) {
          const idx = (y * canvas.width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha > 0) {
            const normalizedAlpha = alpha / 255;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * bboxSpan;
            const initX = x + Math.cos(angle) * dist;
            const initY = y + Math.sin(angle) * dist;

            particles.push({
              x: initX,
              y: initY,
              originalX: x,
              originalY: y,
              color: `rgba(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]}, ${normalizedAlpha})`,
              opacity: normalizedAlpha * 0.3,
              originalAlpha: normalizedAlpha,
              floatingOffsetX: 0,
              floatingOffsetY: 0,
              floatingSpeed: Math.random() * 2 + 1,
              floatingAngle: Math.random() * Math.PI * 2,
              targetOpacity: Math.random() * normalizedAlpha * 0.5,
              sparkleSpeed: Math.random() * 2 + 1,
            });
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return particles;
    },
    []
  );

  // Physics animation update (21st.dev implementation)
  const updateParticles = useCallback(
    (
      particles: Particle[],
      dt: number,
      assembled: boolean,
      isRevealed: boolean,
      onRevealChange: (rev: boolean) => void,
      spreadDist: number,
      simSpeed: number
    ) => {
      const p = spreadDist;
      const assembleSpeed = 3.5;
      const floatFactor = 5 * simSpeed;
      const timeScale = 0.6;
      const noise = 1.3;
      const fadeSpeed = 13;

      let allInPlace = true;

      particles.forEach((pt) => {
        if (assembled) {
          const dx = pt.originalX - pt.x;
          const dy = pt.originalY - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.15) {
            allInPlace = false;
            pt.x += (dx / dist) * assembleSpeed * dt * 60;
            pt.y += (dy / dist) * assembleSpeed * dt * 60;
          } else {
            pt.x = pt.originalX;
            pt.y = pt.originalY;
          }
          pt.opacity = Math.max(0, pt.opacity - fadeSpeed * dt);
        } else {
          allInPlace = false;
          pt.floatingAngle += dt * pt.floatingSpeed * (1 + Math.random() * noise);
          const tSec = Date.now() * 0.001;
          const phase = pt.floatingSpeed * 2000;
          const offsetHarmonicX =
            (Math.sin(tSec * pt.floatingSpeed + pt.floatingAngle) * 1.2 +
              Math.sin((tSec + phase) * 0.5) * 0.8 +
              (Math.random() - 0.5) * noise) *
            timeScale;
          const offsetHarmonicY =
            (Math.cos(tSec * pt.floatingSpeed + pt.floatingAngle * 1.5) * 0.6 +
              Math.cos((tSec + phase) * 0.5) * 0.4 +
              (Math.random() - 0.5) * noise) *
            timeScale;

          const targetX = pt.originalX + p * offsetHarmonicX;
          const targetY = pt.originalY + p * offsetHarmonicY;
          const diffX = targetX - pt.x;
          const diffY = targetY - pt.y;
          const diffDist = Math.sqrt(diffX * diffX + diffY * diffY);
          const ratio = Math.min(1, diffDist / (p * 1.5));
          const jitterX = (Math.random() - 0.5) * simSpeed * ratio;
          const jitterY = (Math.random() - 0.5) * simSpeed * ratio;

          pt.x += diffX * floatFactor * dt + jitterX;
          pt.y += diffY * floatFactor * dt + jitterY;

          const distFromOrigin = Math.sqrt(
            Math.pow(pt.x - pt.originalX, 2) + Math.pow(pt.y - pt.originalY, 2)
          );
          if (distFromOrigin > p) {
            const angle = Math.atan2(pt.y - pt.originalY, pt.x - pt.originalX);
            const excess = (distFromOrigin - p) * 0.1;
            pt.x -= Math.cos(angle) * excess;
            pt.y -= Math.sin(angle) * excess;
          }

          const opDiff = pt.targetOpacity - pt.opacity;
          pt.opacity += opDiff * pt.sparkleSpeed * dt * 3;
          if (Math.abs(opDiff) < 0.01) {
            pt.targetOpacity =
              Math.random() < 0.5
                ? Math.random() * 0.1 * pt.originalAlpha
                : pt.originalAlpha * 3;
            pt.sparkleSpeed = Math.random() * 3 + 1;
          }
        }
      });

      if (assembled && !isRevealed && allInPlace) {
        onRevealChange(true);
        onAssembled?.();
      } else if (!assembled && isRevealed) {
        onRevealChange(false);
        onDispersed?.();
      }
    },
    [onAssembled, onDispersed]
  );

  // Render particles to canvas
  const drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, particles: Particle[], pixelRatio: number) => {
      ctx.save();
      ctx.scale(pixelRatio, pixelRatio);
      const groups = new Map<string, { x: number; y: number }[]>();

      particles.forEach((pt) => {
        if (pt.opacity <= 0) return;
        const colorWithAlpha = pt.color.replace(/[\d.]+\)$/, `${Math.min(1, pt.opacity)})`);
        if (!groups.has(colorWithAlpha)) groups.set(colorWithAlpha, []);
        groups.get(colorWithAlpha)!.push({ x: pt.x / pixelRatio, y: pt.y / pixelRatio });
      });

      groups.forEach((points, fill) => {
        ctx.fillStyle = fill;
        points.forEach(({ x, y }) => {
          // Sharp round particle representation
          ctx.beginPath();
          ctx.arc(x, y, 0.75, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.restore();
    },
    []
  );

  // Rebuild particle positions
  const init = useCallback(() => {
    if (!containerRef.current || !canvasRef.current || !dimensions.width || !dimensions.height)
      return;
    const canvas = canvasRef.current;
    const { width: w, height: h } = dimensions;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const fontStr = `${fontWeight} ${fontSize * dpr}px ${fontFamily}`;

    const pts = sampleParticles(
      ctx,
      canvas,
      text,
      cx,
      cy,
      fontStr,
      letterSpacing,
      color,
      densityStep
    );
    particlesRef.current = pts;
    drawParticles(ctx, pts, dpr);
  }, [
    dimensions,
    dpr,
    text,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing,
    color,
    densityStep,
    sampleParticles,
    drawParticles,
  ]);

  // Main animation rAF loop
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !particlesRef.current.length) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updateParticles(
        particlesRef.current,
        dt,
        isTargetAssembled,
        textVisible,
        setTextVisible,
        spread,
        speed
      );
      drawParticles(ctx, particlesRef.current, dpr);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTargetAssembled, textVisible, spread, speed, dpr, updateParticles, drawParticles]);

  // Responsive dimension updates
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current || !textMetrics.width || !textMetrics.height) return;
      const isMobile = window.innerWidth < 768;
      const pad = isMobile ? Math.max(fontSize * 0.3, 20) : Math.max(fontSize * 0.5, 40);
      const w = Math.max(textMetrics.width + pad * 2, isMobile ? 180 : 320);
      const h = Math.max(textMetrics.height + pad * 2, isMobile ? 80 : 120);

      const parent = containerRef.current.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      const maxW = parentRect ? parentRect.width * 0.95 : window.innerWidth * 0.95;
      const maxH = parentRect ? parentRect.height * 0.95 : window.innerHeight * 0.95;

      setDimensions({
        width: Math.min(w, maxW),
        height: Math.min(h, maxH),
      });
    };

    if (textMetrics.width && textMetrics.height) updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [textMetrics, fontSize]);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center overflow-hidden pointer-events-none select-none',
        hoverable && 'cursor-pointer pointer-events-auto',
        className
      )}
      style={{
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto',
        ...style,
      }}
      onMouseEnter={hoverable ? () => setHovered(true) : undefined}
      onMouseLeave={hoverable ? () => setHovered(false) : undefined}
    >
      {/* Crisp fallback text overlay while assembled */}
      <div
        className={cn(
          'absolute z-10 transition-opacity duration-300 pointer-events-none select-none text-center',
          textVisible ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          color,
          fontFamily,
          fontWeight,
          fontSize: `${fontSize}px`,
          letterSpacing,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 16px rgba(255, 255, 255, 0.4)',
        }}
      >
        {text}
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}
