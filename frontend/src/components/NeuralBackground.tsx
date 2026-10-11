import { useEffect, useRef } from 'react';

interface NeuralBackgroundProps {
  /** Boosts signal activity while JARVIS is speaking / thinking. */
  active?: boolean;
}

type IconKind = 'cpu' | 'hex' | 'ring' | 'bolt' | 'db' | 'atom' | 'diamond';

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Depth 0.55–1: smaller / dimmer / slower when far away. */
  z: number;
  phase: number;
  icon: IconKind | null;
}

interface Pulse {
  a: number;
  b: number;
  t: number;
  speed: number;
}

const ICONS: IconKind[] = ['cpu', 'hex', 'ring', 'bolt', 'db', 'atom', 'diamond'];
const CYAN = '103, 232, 249';
const BLUE = '96, 165, 250';

/** Draws a tiny stroke-only icon centred on (0,0). */
function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, s: number) {
  ctx.beginPath();
  switch (kind) {
    case 'cpu': {
      const h = s * 0.5;
      ctx.rect(-h, -h, s, s);
      ctx.rect(-h * 0.45, -h * 0.45, h * 0.9, h * 0.9);
      for (const p of [-0.45, 0.45]) {
        ctx.moveTo(p * s, -h);
        ctx.lineTo(p * s, -h - s * 0.22);
        ctx.moveTo(p * s, h);
        ctx.lineTo(p * s, h + s * 0.22);
        ctx.moveTo(-h, p * s);
        ctx.lineTo(-h - s * 0.22, p * s);
        ctx.moveTo(h, p * s);
        ctx.lineTo(h + s * 0.22, p * s);
      }
      break;
    }
    case 'hex': {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * s * 0.62;
        const py = Math.sin(a) * s * 0.62;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'ring': {
      ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
      ctx.moveTo(s * 0.12, 0);
      ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
      break;
    }
    case 'bolt': {
      ctx.moveTo(s * 0.12, -s * 0.65);
      ctx.lineTo(-s * 0.4, s * 0.1);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(-s * 0.12, s * 0.65);
      ctx.lineTo(s * 0.4, -s * 0.1);
      ctx.lineTo(0, -s * 0.1);
      ctx.closePath();
      break;
    }
    case 'db': {
      const rx = s * 0.5;
      const ry = s * 0.18;
      ctx.ellipse(0, -s * 0.38, rx, ry, 0, 0, Math.PI * 2);
      ctx.moveTo(-rx, -s * 0.38);
      ctx.lineTo(-rx, s * 0.38);
      ctx.moveTo(rx, -s * 0.38);
      ctx.lineTo(rx, s * 0.38);
      ctx.moveTo(rx, 0);
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
      ctx.moveTo(rx, s * 0.38);
      ctx.ellipse(0, s * 0.38, rx, ry, 0, 0, Math.PI);
      break;
    }
    case 'atom': {
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(s * 0.62, 0);
        ctx.ellipse(0, 0, s * 0.62, s * 0.23, (Math.PI / 3) * i, 0, Math.PI * 2);
      }
      break;
    }
    case 'diamond': {
      ctx.moveTo(0, -s * 0.62);
      ctx.lineTo(s * 0.62, 0);
      ctx.lineTo(0, s * 0.62);
      ctx.lineTo(-s * 0.62, 0);
      ctx.closePath();
      break;
    }
  }
  ctx.stroke();
}

/**
 * Full-screen neural-network backdrop: drifting nodes, fading synapse links,
 * signal pulses travelling along the links, and small tech icons on some nodes.
 * Subtle by default; signal activity ramps up while `active` is true.
 */
export function NeuralBackground({ active = false }: NeuralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let nodes: NeuralNode[] = [];
    let pulses: Pulse[] = [];
    let links: Array<[number, number, number]> = [];
    let raf = 0;
    let last = performance.now();
    let boost = 0; // smoothed 0..1 activity level
    const mouse = { x: -9999, y: -9999 };

    const buildNodes = () => {
      const target = Math.max(28, Math.min(95, Math.round((w * h) / 16000)));
      nodes = Array.from({ length: target }, (_, i) => {
        const z = 0.55 + Math.random() * 0.45;
        const angle = Math.random() * Math.PI * 2;
        const speed = (6 + Math.random() * 10) * z;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          z,
          phase: Math.random() * Math.PI * 2,
          icon: i % 6 === 0 ? ICONS[Math.floor(Math.random() * ICONS.length)] : null,
        };
      });
      pulses = [];
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
      if (reduceMotion) frame(performance.now(), true);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const frame = (now: number, staticFrame = false) => {
      const dt = staticFrame ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;

      boost += ((activeRef.current ? 1 : 0) - boost) * Math.min(1, dt * 3);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const maxDist = Math.max(110, Math.min(170, Math.min(w, h) * 0.2));
      const speedMul = 1 + boost * 0.8;

      // Update positions
      for (const n of nodes) {
        n.x += n.vx * dt * speedMul;
        n.y += n.vy * dt * speedMul;
        n.phase += dt * (0.8 + boost);
        if (n.x < -20) n.x = w + 20;
        else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        else if (n.y > h + 20) n.y = -20;
      }

      // Synapse links
      links = [];
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            const k = Math.pow(1 - d / maxDist, 1.4);
            const alpha = k * (0.2 + boost * 0.12) * Math.min(a.z, b.z);
            ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            links.push([i, j, d]);
          }
        }
      }

      // Cursor attraction: faint links from the pointer to nearby nodes
      if (mouse.x > -1000) {
        for (const n of nodes) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d < 170) {
            ctx.strokeStyle = `rgba(${BLUE}, ${(1 - d / 170) * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // Signal pulses
      if (!staticFrame && links.length > 0) {
        const spawnRate = 0.9 + boost * 5; // pulses per second
        if (Math.random() < spawnRate * dt && pulses.length < 40) {
          const [a, b] = links[Math.floor(Math.random() * links.length)];
          const forward = Math.random() > 0.5;
          pulses.push({
            a: forward ? a : b,
            b: forward ? b : a,
            t: 0,
            speed: 0.5 + Math.random() * 0.6 + boost * 0.5,
          });
        }
      }
      pulses = pulses.filter((p) => p.t < 1);
      for (const p of pulses) {
        p.t += dt * p.speed;
        const a = nodes[p.a];
        const b = nodes[p.b];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(Math.min(p.t, 1) * Math.PI);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
        glow.addColorStop(0, `rgba(${CYAN}, ${0.55 * fade})`);
        glow.addColorStop(1, `rgba(${CYAN}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes & icons
      ctx.lineWidth = 1;
      for (const n of nodes) {
        const breathe = 0.65 + 0.35 * Math.sin(n.phase);
        const near = Math.max(0, 1 - Math.hypot(n.x - mouse.x, n.y - mouse.y) / 170);
        const a = (0.35 + boost * 0.2) * n.z * breathe + near * 0.4;

        if (n.icon) {
          const s = 8 * n.z + near * 2;
          // soft halo
          const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, s * 2.4);
          halo.addColorStop(0, `rgba(${CYAN}, ${0.12 * breathe + near * 0.12})`);
          halo.addColorStop(1, `rgba(${CYAN}, 0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, s * 2.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.strokeStyle = `rgba(${CYAN}, ${Math.min(0.85, a + 0.15)})`;
          drawIcon(ctx, n.icon, s);
          ctx.restore();
        } else {
          const r = 1.2 + n.z * 1.1 + near * 1.2;
          ctx.fillStyle = `rgba(${CYAN}, ${Math.min(0.9, a)})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      if (!staticFrame && !reduceMotion) raf = requestAnimationFrame(frame);
    };

    resize();
    if (!reduceMotion) raf = requestAnimationFrame(frame);

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}
