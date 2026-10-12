import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface IntroSequenceProps {
  onComplete: () => void;
  onSwirlToOrb?: () => void;
}

interface Particle {
  // Dust state (0.6 - 1.6s)
  dustX: number;
  dustY: number;
  dustVx: number;
  dustVy: number;

  // Band state (1.6 - 2.4s)
  bandX: number;
  bandY: number;

  // Text state (2.4 - 3.8s)
  textX: number;
  textY: number;

  // Fibonacci sphere unit coordinates (Golden Spiral: no moiré)
  sphereX: number;
  sphereY: number;
  sphereZ: number;

  // Curl arc for smooth vortex during 3.8s - 4.9s hand-off
  curlVx: number;
  curlVy: number;
  curlFactor: number;

  // Visual properties
  baseSize: number;
  twinklePhase: number;
  twinkleSpeed: number;
  randZ: number;
}

const PARTICLE_COUNT = 3500;
const HUD_FULL_TEXT = 'SYSTEM // AUDIO · LANGUAGE · SYNAPSE // READY';

// Smoothstep helper matching WebGL shader
function smoothstep(min: number, max: number, val: number): number {
  const x = Math.max(0, Math.min(1, (val - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function IntroSequence({ onComplete, onSwirlToOrb }: IntroSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const swirlTriggeredRef = useRef(false);

  const [hudText, setHudText] = useState('');
  const [showHud, setShowHud] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Skip handler (click, any key, Esc)
  const handleSkip = useCallback(() => {
    if (isDone) return;
    setIsDone(true);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    onComplete();
  }, [isDone, onComplete]);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return;
    }

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

    const isDesktop = width >= 768;
    const textCenterY = height / 2;

    // ── Dynamically Measure Real Hero Orb Position & Radius ──────────────────
    const getHeroOrbTarget = () => {
      if (typeof document !== 'undefined') {
        const orbEl = document.querySelector('[role="img"]');
        if (orbEl) {
          const r = orbEl.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) {
            return {
              cx: r.left + r.width / 2,
              cy: r.top + r.height / 2,
              radius: r.width / 2, // 110px on desktop (220px diameter)
            };
          }
        }
      }
      // Analytical fallback strictly matching flex column layout
      return {
        cx: width / 2,
        cy: height / 2 - (isDesktop ? 68 : 50),
        radius: isDesktop ? 110 : 90,
      };
    };

    let heroTarget = getHeroOrbTarget();

    // ── Generate Sampled Text Points for "JARVIS" ────────────────────────────
    const sampleWordmark = (): { x: number; y: number }[] => {
      const offscreen = document.createElement('canvas');
      const offW = Math.max(800, width);
      const offH = 300;
      offscreen.width = offW;
      offscreen.height = offH;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return [];

      offCtx.fillStyle = '#000000';
      offCtx.fillRect(0, 0, offW, offH);

      const fontSize = Math.max(52, Math.min(74, Math.round(width * 0.082)));
      // Font: thin weight (300), Orbitron or clean modern sans-serif
      offCtx.font = `300 ${fontSize}px "Orbitron", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      offCtx.fillStyle = '#FFFFFF';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';

      // Draw characters individually with wide letter-spacing
      const chars = ['J', 'A', 'R', 'V', 'I', 'S'];
      const charWidths = chars.map((c) => offCtx.measureText(c).width);
      const spacing = fontSize * 0.40;
      const totalWidth = charWidths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);

      let currentX = (offW - totalWidth) / 2 + charWidths[0] / 2;
      const centerY = offH / 2;

      for (let i = 0; i < chars.length; i++) {
        offCtx.fillText(chars[i], currentX, centerY);
        if (i < chars.length - 1) {
          currentX += charWidths[i] / 2 + spacing + charWidths[i + 1] / 2;
        }
      }

      const imgData = offCtx.getImageData(0, 0, offW, offH);
      const data = imgData.data;
      const points: { x: number; y: number }[] = [];

      for (let y = 0; y < offH; y += 2) {
        const row = y * offW * 4;
        for (let x = 0; x < offW; x += 2) {
          if (data[row + x * 4] > 80) {
            points.push({
              x: width / 2 + (x - offW / 2),
              y: textCenterY + (y - offH / 2),
            });
          }
        }
      }

      // Shuffle points using Fisher-Yates
      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = points[i];
        points[i] = points[j];
        points[j] = tmp;
      }

      return points;
    };

    const textPoints = sampleWordmark();
    const bandWidth = Math.min(width * 0.70, 420);
    const bandHalfThickness = 12; // 24px thick visible band

    // ── Golden Spiral Fibonacci Sphere (Zero Moiré Lattice) ──────────────────
    const PHI = Math.PI * (3 - Math.sqrt(5)); // Golden angle in radians (~2.39996)
    const particles: Particle[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Dust position around orb center: wide radius 280px
      const dustDist = Math.pow(Math.random(), 0.60) * Math.min(width * 0.42, 280);
      const dustAngle = Math.random() * Math.PI * 2;
      const dustX = width / 2 + Math.cos(dustAngle) * dustDist;
      const dustY = textCenterY + Math.sin(dustAngle) * dustDist * 0.80;

      // Band position: compressed thick horizontal bar
      const bandX = width / 2 + (Math.random() - 0.5) * bandWidth;
      const bandY = textCenterY + (Math.random() + Math.random() - 1.0) * bandHalfThickness;

      // Text position: mapped to sampled letters
      let textX = width / 2;
      let textY = textCenterY;
      if (textPoints.length > 0) {
        const pt = textPoints[i % textPoints.length];
        textX = pt.x + (Math.random() - 0.5) * 1.5;
        textY = pt.y + (Math.random() - 0.5) * 1.5;
      }

      // Fibonacci sphere unit coordinates on surface of sphere
      const yNorm = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
      const rPlane = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const theta = PHI * i;
      const sphereX = Math.cos(theta) * rPlane;
      const sphereY = yNorm;
      const sphereZ = Math.sin(theta) * rPlane;

      // Outward curl vector for fluid arcing vortex between text and sphere
      const curlAng = Math.random() * Math.PI * 2;
      const curlDist = 40 + Math.random() * 80;

      particles.push({
        dustX,
        dustY,
        dustVx: (Math.random() - 0.5) * 14,
        dustVy: (Math.random() - 0.5) * 12,
        bandX,
        bandY,
        textX,
        textY,
        sphereX,
        sphereY,
        sphereZ,
        curlVx: Math.cos(curlAng) * curlDist,
        curlVy: Math.sin(curlAng) * curlDist,
        curlFactor: 0.8 + Math.random() * 0.4,
        baseSize: 1.4 + Math.random() * 0.8, // 1.4 - 2.2px (exact Three.js point size)
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 2.0 + Math.random() * 3.0,
        randZ: 0.65 + Math.random() * 0.7,
      });
    }

    startTimeRef.current = performance.now();

    // ── Directional Light Vector matching Three.js Shader (-0.5, 0.6, 0.8) ───
    const lightLen = Math.hypot(-0.5, 0.6, 0.8);
    const lx = -0.5 / lightLen;
    const ly = 0.6 / lightLen;
    const lz = 0.8 / lightLen;

    // ── Render Loop ──────────────────────────────────────────────────────────
    const render = () => {
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000; // seconds

      // Dynamically keep hero target in sync with viewport
      heroTarget = getHeroOrbTarget();

      // Clear frame
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Trigger handoff sync to Three.js live orb
      if (elapsed >= 4.8 && !swirlTriggeredRef.current) {
        swirlTriggeredRef.current = true;
        onSwirlToOrb?.();
      }

      if (elapsed >= 4.9 && !showHud) {
        setShowHud(true);
      }

      // Complete intro overlay at 5.5s (220ms crossfade handoff)
      if (elapsed >= 5.5) {
        setIsDone(true);
        onComplete();
        return;
      }

      // Soft ambient center glow
      const glowAlpha = Math.min(0.20, elapsed * 0.25);
      if (glowAlpha > 0.01) {
        const glowRad = ctx.createRadialGradient(heroTarget.cx, heroTarget.cy, 0, heroTarget.cx, heroTarget.cy, 260);
        glowRad.addColorStop(0, `rgba(34, 211, 238, ${glowAlpha})`);
        glowRad.addColorStop(0.5, `rgba(34, 211, 238, ${glowAlpha * 0.3})`);
        glowRad.addColorStop(1, 'rgba(5, 8, 14, 0)');
        ctx.fillStyle = glowRad;
        ctx.fillRect(heroTarget.cx - 260, heroTarget.cy - 260, 520, 520);
      }

      // Rotation around Y axis matching Three.js
      const rotY = (elapsed - 3.8) * 1.4;
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);

      // Render each particle
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        const twinkle = Math.sin(elapsed * p.twinkleSpeed + p.twinklePhase) * 0.12 + 0.88;

        let px = p.dustX;
        let py = p.dustY;
        let pAlpha = 0.85 * twinkle;
        let rCol = 255;
        let gCol = 255;
        let bCol = 255;
        let pRadius = p.baseSize;

        if (elapsed < 0.6) {
          // 0.0 - 0.6s: Faint soft glow, specks
          const tNorm = elapsed / 0.6;
          if (i % 6 !== 0) {
            pAlpha = tNorm * 0.08;
          } else {
            pAlpha = Math.min(0.70, tNorm * 0.70);
          }
          px = p.dustX + Math.sin(elapsed + p.twinklePhase) * 3;
          py = p.dustY + Math.cos(elapsed + p.twinklePhase) * 3;
          rCol = 186; gCol = 230; bCol = 253;
        } else if (elapsed < 1.6) {
          // 0.6 - 1.6s: DENSE dust (cyan-white at 0.7+ alpha)
          const tNorm = (elapsed - 0.6) / 1.0;
          pAlpha = Math.max(0.72, 0.85 * twinkle);
          px = p.dustX + Math.sin(elapsed * 1.2 + p.twinklePhase) * 8 + p.dustVx * tNorm;
          py = p.dustY + Math.cos(elapsed * 1.1 + p.twinklePhase) * 8 + p.dustVy * tNorm;
          if (i % 3 === 0) {
            rCol = 34; gCol = 211; bCol = 238; // cyan
          } else if (i % 3 === 1) {
            rCol = 224; gCol = 242; bCol = 254; // ice
          } else {
            rCol = 255; gCol = 255; bCol = 255; // white
          }
        } else if (elapsed < 2.4) {
          // 1.6 - 2.4s: Dust compresses into thick horizontal band
          const tNorm = (elapsed - 1.6) / 0.8;
          const k = tNorm < 0.5 ? 4 * tNorm * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 3) / 2;
          px = p.dustX + (p.bandX - p.dustX) * k;
          py = p.dustY + (p.bandY - p.dustY) * k;
          pAlpha = 0.85;
          rCol = 103; gCol = 232; bCol = 249;
        } else if (elapsed < 3.2) {
          // 2.4 - 3.2s: Band sharpens into "JARVIS" wordmark (pure white, full opacity)
          const tNorm = (elapsed - 2.4) / 0.8;
          const k = tNorm * tNorm * (3 - 2 * tNorm);
          px = p.bandX + (p.textX - p.bandX) * k;
          py = p.bandY + (p.textY - p.bandY) * k;
          pAlpha = Math.min(1.0, 0.85 + k * 0.15);
          rCol = 255; gCol = 255; bCol = 255;
        } else if (elapsed < 3.8) {
          // 3.2 - 3.8s: Hold wordmark with subtle shimmer
          px = p.textX;
          py = p.textY;
          pAlpha = Math.max(0.88, 0.94 + 0.06 * Math.sin(elapsed * 6 + p.twinklePhase));
          rCol = 255; gCol = 255; bCol = 255;
        } else {
          // 3.8 - 5.5s: OVERLAPPED disperse & gather directly into hero orb!
          // Zero black gap: particles peel off letters and swirl smoothly into the exact sphere!
          const prog = Math.min(1.0, (elapsed - 3.8) / 1.1); // 0 to 1 over 1.1s
          const k = prog < 0.5 ? 4 * prog * prog * prog : 1 - Math.pow(-2 * prog + 2, 3) / 2;

          // Projected 3D spherical point rotating around Y axis
          const curX = p.sphereX * cosR + p.sphereZ * sinR;
          const curY = p.sphereY;
          const curZ = -p.sphereX * sinR + p.sphereZ * cosR;

          // Sphere coordinates centered at exact hero orb location
          const sphereTargetX = heroTarget.cx + curX * heroTarget.radius;
          const sphereTargetY = heroTarget.cy + curY * heroTarget.radius;

          // Arcing vortex offset during transition
          const arc = Math.sin(prog * Math.PI) * p.curlFactor;
          px = p.textX + (sphereTargetX - p.textX) * k + p.curlVx * arc;
          py = p.textY + (sphereTargetY - p.textY) * k + p.curlVy * arc;

          // Three.js Shader Lighting Math:
          const diffuse = Math.max(0, curX * lx + curY * ly + curZ * lz) * 0.35 + 0.65;
          const depth = (curZ + 1.0) * 0.5; // 0 (back) to 1 (front)
          const backFade = smoothstep(0.12, 0.70, depth);

          // Depth-attenuated alpha & size matching Three.js shader
          const depthAlpha = 0.18 + backFade * (0.65 - 0.18);
          const depthSize = 0.72 + depth * (1.10 - 0.72);

          pAlpha = depthAlpha * twinkle;
          pRadius = p.baseSize * depthSize;

          // Shaded Color: mix base (#0284c7) and glow (#38bdf8) with depth
          const baseR = 2, baseG = 132, baseB = 199;
          const glowR = 56, glowG = 189, glowB = 248;
          const mixColR = baseR + depth * 0.4 * (glowR - baseR);
          const mixColG = baseG + depth * 0.4 * (glowG - baseG);
          const mixColB = baseB + depth * 0.4 * (glowB - baseB);

          const shadedR = Math.min(255, Math.round(mixColR * diffuse));
          const shadedG = Math.min(255, Math.round(mixColG * diffuse));
          const shadedB = Math.min(255, Math.round(mixColB * diffuse));

          // Color transition: white easing smoothly to exact shaded cyan
          rCol = Math.round(255 + (shadedR - 255) * k);
          gCol = Math.round(255 + (shadedG - 255) * k);
          bCol = Math.round(255 + (shadedB - 255) * k);
        }

        if (pAlpha <= 0.01) continue;

        // Draw crisp round particle dot
        ctx.beginPath();
        ctx.arc(px, py, pRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${pAlpha})`;
        ctx.fill();
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
      window.removeEventListener('resize', handleResize);
    };
  }, [onComplete, onSwirlToOrb]);

  // HUD text typing effect during 4.9s - 5.5s
  useEffect(() => {
    if (!showHud) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setHudText(HUD_FULL_TEXT.slice(0, idx));
      if (idx >= HUD_FULL_TEXT.length) {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [showHud]);

  // Global skip listener (click, any key, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleSkip();
    };
    const handlePointerDown = () => {
      handleSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [handleSkip]);

  if (isDone) return null;

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05080e] select-none cursor-pointer overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-label="JARVIS initialization sequence"
    >
      {/* 2D High-Density Cinematic Particle Simulation Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Ticking HUD line during hand-off (4.9s - 5.5s) */}
      <div className="absolute bottom-28 flex flex-col items-center text-center pointer-events-none">
        {showHud && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[var(--accent)] text-glow"
          >
            <span>{hudText}</span>
            <span className="inline-block w-2 h-3 ml-1 bg-[var(--accent)] animate-pulse" />
          </motion.div>
        )}
      </div>

      {/* Faint on-screen skip hint at bottom — NO native tooltip */}
      <div className="absolute bottom-8 text-[10px] font-mono tracking-widest text-slate-500 uppercase select-none opacity-60 pointer-events-none">
        PRESS ANY KEY OR CLICK TO SKIP [ESC]
      </div>
    </motion.div>
  );
}
