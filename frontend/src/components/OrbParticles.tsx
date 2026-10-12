import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as THREE from 'three';

import type { OrbState } from '@/types';

// ─── Theme ──────────────────────────────────────────────────────────────────
export const ORB_THEME = {
  base: '#22d3ee',   // jarvis-cyan
  accent: '#67e8f9', // jarvis-cyan-bright
  glow: '#38bdf8',   // radiant glow blue
} as const;

export const ORB_THEME_LIGHT = {
  base: '#0284c7',   // lighter radiant teal
  accent: '#0891b2', // bright teal-cyan
  glow: '#0369a1',   // deep azure glow
} as const;

// ─── Public API ──────────────────────────────────────────────────────────────
export interface OrbParticlesHandle {
  burst: (scale?: number) => void;   // scale: 1.0 = full (12%), 0.33 = voice-end (4%)
  morphToText: (text: string) => void;
  playIntro: (onComplete?: () => void) => void;
}

export interface OrbParticlesProps {
  state: OrbState | 'ready';
  inputLevel?: number;  // 0-1, smoothed mic RMS
  outputLevel?: number; // 0-1, smoothed TTS energy
  size?: number;
  quality?: 'full' | 'balanced' | 'reduced';
}

// ─── Vertex Shader ───────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  attribute vec4  aRandom;     // [phase, twinkleRate, sizeScale, noiseSeed]
  attribute vec3  aTargetPos;  // morph-to-text target
  attribute vec3  aHomePos;    // resting Fibonacci-sphere position (invariant)

  uniform float uTime;
  uniform float uDt;
  uniform float uPixelRatio;
  uniform float uState;        // 0 idle | 1 listening | 2 thinking | 3 speaking
  uniform float uInputLevel;   // 0..1 smoothed mic RMS
  uniform float uOutputLevel;  // 0..1 smoothed TTS energy
  uniform float uReducedMotion;
  uniform float uIsLight;

  // Cross-fade between states (CPU sends interpolated values)
  uniform float uStateBlend;   // 0..1, fraction into new state over 500ms

  // Hover
  uniform vec3  uHitPoint3D;
  uniform vec3  uHitVelocity3D;
  uniform float uHoverStrength;

  // Imperative effects
  uniform float uBurst;        // 0..1 radial burst envelope
  uniform float uBurstScale;   // 0.04 (voice-end) or 0.12 (send)
  uniform float uIntro;        // 0..1 intro progression
  uniform float uMorph;

  // Thinking: tilted orbit band
  uniform float uThinkingBand; // 0..1, which particles belong to the band (per-particle via aRandom.w seed)
  uniform float uThinkAngle;   // slowly varying tilt angle

  // Speaking ripple
  uniform float uRipplePhase;  // uTime-based phase
  uniform float uRippleAmp;    // 0..1, scaled by outputLevel

  varying vec3  vNormal;
  varying float vTwinkle;
  varying float vInfluence;
  varying float vSpeed;
  varying float vDepth;
  varying vec4  vRandom;
  varying float vBandParticle; // 1 if in thinking band
  varying float vRippleBright; // speaking ripple brightness pulse
  varying float vIntroProgress;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  // Divergence-free tangent curl
  vec3 curlSphere(vec3 p, float t) {
    float s = 4.8;
    float a = sin(p.y * s + t) * cos(p.z * s + t * 0.73);
    float b = sin(p.z * s + t * 0.84) * cos(p.x * s + t * 0.61);
    float c = sin(p.x * s + t * 0.55) * cos(p.y * s + t * 0.91);
    vec3 raw = vec3(b - a, c - b, a - c);
    return normalize(raw - dot(raw, p) * p);
  }

  void main() {
    vRandom = aRandom;
    vIntroProgress = uIntro;

    // ── 1. Resting animation ─────────────────────────────────────────────────
    float rotSpeed = (0.14 + uState * 0.16) * (1.0 - uReducedMotion * 0.6);
    float ay = uTime * rotSpeed;
    float cy = cos(ay), sy = sin(ay);
    vec3 pos = vec3(
      aHomePos.x * cy - aHomePos.z * sy,
      aHomePos.y,
      aHomePos.x * sy + aHomePos.z * cy
    );

    float drift = sin(uTime * 1.1 + aRandom.w * 6.28318) * 0.008 * (1.0 - uReducedMotion);
    pos += normalize(pos) * drift;

    // ── 2. LISTENING: 2% breathing + subtle audio-driven displacement ─────────
    if (uState > 0.5 && uState < 1.5) {
      float breath = 1.0 + uInputLevel * 0.02;
      pos *= breath;
      vec3 shimDir = curlSphere(pos, uTime * 2.0);
      pos += shimDir * (uInputLevel * 0.012);
    }

    // ── 3. THINKING: contract 7%, fast tilted-axis spin, orbit band ──────────
    vBandParticle = 0.0;
    if (uState > 1.5 && uState < 2.5) {
      pos *= 0.93;

      float tSpeed = uTime * 2.8;
      float ta = uThinkAngle;
      vec3 axis = normalize(vec3(sin(ta), cos(ta) * 0.4, 0.0));
      float cA = cos(tSpeed * 0.6), sA = sin(tSpeed * 0.6);
      pos = pos * cA + cross(axis, pos) * sA + axis * dot(axis, pos) * (1.0 - cA);

      float bandSeed = hash(aRandom.w * 37.1 + 0.5);
      vBandParticle = step(0.88, bandSeed);
    }

    // ── 4. SPEAKING: slow surface ripple tangentially displaced ─────────────
    vRippleBright = 0.0;
    if (uState > 2.5 && uRippleAmp > 0.001) {
      float ripplePh = pos.y * 6.0 - uRipplePhase;
      float ripple = sin(ripplePh) * uRippleAmp * 0.025 * (1.0 - uReducedMotion);
      vec3 tangLatDir = normalize(vec3(-pos.z, 0.0, pos.x));
      pos += tangLatDir * ripple;
      float waveFront = max(0.0, sin(ripplePh));
      vRippleBright = waveFront * uRippleAmp * 0.20;
    }

    // ── 5. Hover interaction ──────────────────────────────────────────────────
    float cosAngle = clamp(dot(normalize(pos), uHitPoint3D), -1.0, 1.0);
    float angDist  = acos(cosAngle);
    float gaussian = exp(-angDist * angDist / (2.0 * 0.35 * 0.35));
    float influence = gaussian * uHoverStrength;
    vInfluence = influence;

    float speed = length(uHitVelocity3D);
    vSpeed = speed;

    if (influence > 0.0005) {
      vec3 n = normalize(pos);
      float t = uTime * (1.0 - uReducedMotion * 0.5);
      vec3 curlDir = curlSphere(pos, t);
      vec3 velDir  = vec3(0.0);
      if (speed > 0.001) {
        vec3 rawVel = uHitVelocity3D;
        velDir = normalize(rawVel - dot(rawVel, n) * n);
      }
      float velBlend = clamp(speed * 4.0, 0.0, 0.85);
      vec3 swirlDir  = normalize(mix(curlDir, velDir, velBlend));
      float dispMag  = influence * (0.055 + clamp(speed * 0.12, 0.0, 0.04))
                     * (1.0 - uReducedMotion * 0.6);
      float pDelay   = sin(uTime * 4.0 + aRandom.x * 6.28318) * 0.25 + 0.75;
      pos += swirlDir * dispMag * pDelay + n * (influence * 0.04);
    }

    // ── 6. Burst: radial outward impulse ──────────────────────────────────────
    if (uBurst > 0.001) {
      float eOut   = 1.0 - pow(1.0 - uBurst, 2.0);
      vec3 bDir    = normalize(aHomePos);
      pos += bDir * (eOut * uBurstScale * (0.85 + aRandom.y * 0.3)) * (1.0 - uReducedMotion);
    }

    // ── 7. Intro: Dispersed -> Assembled Title -> Spherical Orb ───────────────
    if (uIntro > 0.0001) {
      // Wide, ethereal dispersed cloud from 3D space
      vec3 dispersed = aHomePos * (3.5 + aRandom.w * 1.2)
                     + vec3(sin(aRandom.x * 6.28318), cos(aRandom.y * 6.28318), sin(aRandom.z * 6.28318)) * 0.8;
      
      // Stage 1: Deliberate organic assembly into the title (0.0 -> 0.30)
      float stagger = aRandom.x * 0.06;
      float tAssemble = smoothstep(stagger, 0.28 + stagger, uIntro);
      vec3 titlePos = mix(dispersed, aTargetPos, tAssemble);
      
      // Stage 2: Hold completed title (0.30 -> 0.60) with subtle holographic float
      float holdPhase = smoothstep(0.28, 0.34, uIntro) * (1.0 - smoothstep(0.56, 0.64, uIntro));
      titlePos.z += sin(uTime * 1.6 + aRandom.x * 6.28318) * (0.010 * holdPhase);

      // Stage 3: Smooth transition from title into spherical orb (0.60 -> 0.88)
      float tSphere = smoothstep(0.60, 0.88, uIntro);
      pos = mix(titlePos, pos, tSphere);
    }

    // Morph (standalone API)
    if (uMorph > 0.001) {
      pos = mix(pos, aTargetPos, smoothstep(0.0, 1.0, uMorph));
    }

    // ── 8. Outputs ───────────────────────────────────────────────────────────
    vNormal  = normalize(pos);
    vDepth   = clamp((pos.z + 1.0) * 0.5, 0.0, 1.0);
    vTwinkle = sin(uTime * (1.8 + aRandom.y) + aRandom.x * 6.28318) * 0.12 + 0.88;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Cohesive depth size scaling: front particles crisper, back particles softer
    float depthSize = mix(0.72, 1.10, vDepth);
    float baseSize = 2.1 * aRandom.z * uPixelRatio * depthSize;
    if (uIsLight > 0.5) {
      baseSize *= 0.82; // Smaller points in light mode so it reads as a clean dotted sphere
    }
    float sizeGrowth = 1.0 + vInfluence * 0.5;
    sizeGrowth += vBandParticle * 0.25;

    if (uIntro > 0.0001) {
      float titlePhase = 1.0 - smoothstep(0.56, 0.80, uIntro);
      float uniformSize = mix(1.0, 0.85 + aRandom.z * 0.15, titlePhase);
      baseSize *= uniformSize;
      float assemblyBoost = smoothstep(0.0, 0.25, uIntro) * titlePhase * 0.2;
      sizeGrowth += assemblyBoost;
    }
    gl_PointSize = baseSize * sizeGrowth;
  }
`;

// ─── Fragment Shader ─────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
  uniform vec3  uBaseColor;
  uniform vec3  uAccentColor;
  uniform vec3  uGlowColor;
  uniform float uHoverStrength;
  uniform float uState;
  uniform float uInputLevel;
  uniform float uBurst;
  uniform float uBurstScale;
  uniform float uIntro;
  uniform float uIsLight;

  varying vec3  vNormal;
  varying float vTwinkle;
  varying float vInfluence;
  varying float vSpeed;
  varying float vDepth;
  varying vec4  vRandom;
  varying float vBandParticle;
  varying float vRippleBright;
  varying float vIntroProgress;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    // Razor-sharp round points: discard outside 0.48 and very narrow smoothstep edge (per requirement)
    if (r > 0.48) discard;
    float spriteA = smoothstep(0.48, 0.43, r);

    vec3 lightDir = normalize(vec3(-0.5, 0.6, 0.8));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.35 + 0.65;

    vec3 col = mix(uBaseColor, uGlowColor, vDepth * 0.4);
    col *= diffuse * vTwinkle;

    // Hover
    float accentBlend = clamp(vInfluence * vInfluence * 0.35, 0.0, 0.35);
    col = mix(col, uAccentColor, accentBlend);
    col *= 1.0 + vInfluence * 0.25;

    // Listening (+15% brightness boost, clamped)
    if (uState > 0.5 && uState < 1.5) {
      float rim = smoothstep(0.4, 0.0, abs(vNormal.z));
      col += col * (rim * uInputLevel * 0.12);
      col *= 1.0 + clamp(uInputLevel * 0.18, 0.0, 0.18);
      float acShift = step(vRandom.x, 0.30) * uInputLevel * 0.25;
      col = mix(col, uAccentColor, acShift);
    }

    // Thinking band (+15% brightness, clamped)
    if (vBandParticle > 0.5) {
      col = mix(col, uAccentColor, 0.45);
      col *= 1.15;
    }

    // Speaking ripple (clamped boost)
    col *= 1.0 + clamp(vRippleBright, 0.0, 0.20);

    // Burst
    if (uBurst > 0.001) {
      float frontParticle = smoothstep(0.0, 0.5, uBurst) * (0.6 + vRandom.y * 0.4);
      col = mix(col, uAccentColor, uBurst * frontParticle * 0.30);
      col *= 1.0 + uBurst * frontParticle * 0.15;
    }

    // Clamp brightness boost so it NEVER over-saturates into a fuzzy glow
    col = clamp(col, 0.0, 1.20);

    // ── Alpha & Depth Cohesion ────────────────────────────────────────────────
    // Depth-fade back particles so the front surface stays sharply defined
    float backFade = smoothstep(0.12, 0.70, vDepth);
    float depthAlpha = mix(0.18, 0.65, backFade);

    // Lower per-particle alpha to reduce additive overdraw fuzziness
    float restA = depthAlpha * vTwinkle;
    float alpha = clamp(mix(restA, 0.65, vInfluence * 0.6), 0.0, 0.75);
    if (uBurst > 0.001) alpha = clamp(mix(alpha, 0.75, uBurst * 0.4), 0.0, 0.85);

    // In light theme: lighter teal at 0.6-0.85 alpha so it reads as a clean dotted sphere
    if (uIsLight > 0.5) {
      alpha = clamp(alpha * 0.88, 0.20, 0.65);
    }

    // Higher alpha during intro title phase for strong legibility
    if (vIntroProgress > 0.0001) {
      float titleAlpha = 1.0 - smoothstep(0.56, 0.82, vIntroProgress);
      alpha = mix(alpha, 0.85, titleAlpha * 0.7);
      alpha *= smoothstep(0.0, 0.08, vIntroProgress);
    }

    float a = alpha * spriteA;
    gl_FragColor = vec4(col * a, a); // premultiplied
  }
`;

// ─── Text sampler ─────────────────────────────────────────────────────────────
function sampleTextPoints(text: string, count: number): Float32Array {
  const result = new Float32Array(count * 3);
  if (typeof document === 'undefined' || !text) return result;

  // Offscreen canvas for sampling readable letter silhouettes
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return result;

  // Helper to render text and extract hit pixels
  const renderAndCollectHits = (fontFamily: string, baseFontSize: number): [number, number][] => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Measure and ensure text fits within canvas width with safe margins
    let fontSize = baseFontSize;
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const maxAllowedWidth = canvas.width * 0.85;
    if (metrics.width > maxAllowedWidth && metrics.width > 0) {
      fontSize = Math.floor(fontSize * (maxAllowedWidth / metrics.width));
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
    }

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const pts: [number, number][] = [];

    // Sample pixels with threshold for clean glyph boundaries
    for (let y = 0; y < canvas.height; y++) {
      const rowOffset = y * canvas.width * 4;
      for (let x = 0; x < canvas.width; x++) {
        if (data[rowOffset + x * 4] > 70) {
          pts.push([x, y]);
        }
      }
    }
    return pts;
  };

  // Primary: Orbitron (weight 700 is loaded in index.html) with sans-serif fallback
  let hits = renderAndCollectHits('"Orbitron", sans-serif', 82);

  // Fallback: If primary font failed to render any pixels, retry with guaranteed system font
  if (!hits.length) {
    hits = renderAndCollectHits('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', 82);
  }

  // If sampling still failed, report error rather than generating an artificial random box
  if (!hits.length) {
    console.error(`[OrbParticles] Text sampling failed for "${text}". No readable glyph points found.`);
    return result;
  }

  // Measure actual pixel bounding box of the rendered glyphs
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < hits.length; i++) {
    const [hx, hy] = hits[i];
    if (hx < minX) minX = hx;
    if (hx > maxX) maxX = hx;
    if (hy < minY) minY = hy;
    if (hy > maxY) maxY = hy;
  }

  const bboxW = Math.max(1, maxX - minX);
  const bboxH = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // OrthographicCamera visible bounds are [-1.4, 1.4] (span 2.8 in X and Y).
  // Target max horizontal span = 2.34 (half-span = 1.17, well within the 1.4 camera bound).
  // Target max vertical span = 0.65.
  // Using the SAME scale factor for both axes strictly preserves the text's aspect ratio.
  const scale = Math.min(2.34 / bboxW, 0.65 / bboxH);

  // Shuffle hits using Fisher-Yates for uniform particle distribution across letters
  for (let i = hits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = hits[i];
    hits[i] = hits[j];
    hits[j] = tmp;
  }

  // Populate particle targets centered at (0, 0) in Three.js world coordinates
  for (let i = 0; i < count; i++) {
    const pt = hits[i % hits.length];
    const dx = pt[0] - centerX;
    const dy = pt[1] - centerY;

    result[i * 3]     = dx * scale + (Math.random() - 0.5) * 0.006;
    result[i * 3 + 1] = -dy * scale + (Math.random() - 0.5) * 0.006;
    result[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const OrbParticles = forwardRef<OrbParticlesHandle, OrbParticlesProps>(
  function OrbParticles({ state, inputLevel = 0, outputLevel = 0, size = 180, quality = 'full' }, ref) {
    const canvasRef    = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Three.js
    const sceneRef    = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef   = useRef<THREE.OrthographicCamera | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const geometryRef = useRef<THREE.BufferGeometry | null>(null);
    const animIdRef   = useRef<number | null>(null);

    // Cursor physics
    const hitPointRef    = useRef(new THREE.Vector3(0, 0, 1));
    const hitTargetRef   = useRef(new THREE.Vector3(0, 0, 1));
    const hitVelRef      = useRef(new THREE.Vector3());
    const isHoveredRef   = useRef(false);
    const hoverStrRef    = useRef(0);
    const lastTimeRef    = useRef(performance.now());
    const startTimeRef   = useRef(performance.now());
    const particleCountRef = useRef(7000);

    // Refs updated each render so the rAF loop never reads stale closure values
    const stateIndexRef  = useRef(0);
    const inputLevelRef  = useRef(0);
    const outputLevelRef = useRef(0);

    // Imperative state
    const burstStartRef  = useRef<number | null>(null);
    const burstScaleRef  = useRef(0.12);
    const introStartRef  = useRef<number | null>(null);
    const introCallbackRef = useRef<(() => void) | null>(null);
    const morphStartRef  = useRef<number | null>(null);

    // State cross-fade
    const prevStateRef   = useRef(0);
    const stateBlendRef  = useRef(1);
    const thinkAngleRef  = useRef(0);

    // Audio simulation: smoothed levels (CPU, read in rAF loop)
    const smoothInputRef  = useRef(0); // smoothed mic RMS
    const smoothOutputRef = useRef(0); // smoothed TTS energy
    // Simulated envelope for speaking (varies softly when real level is 0)
    const simPhaseRef     = useRef(Math.random() * 6.28);

    const resolvedState: OrbState = state === 'ready' ? 'idle' : state;
    const stateIndex = resolvedState === 'idle' ? 0
                     : resolvedState === 'listening'  ? 1
                     : resolvedState === 'thinking'   ? 2 : 3;

    // Keep refs fresh every render
    stateIndexRef.current  = stateIndex;
    inputLevelRef.current  = inputLevel;
    outputLevelRef.current = outputLevel;

    const reducedMotionRef = useRef(false);
    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionRef.current = mq.matches;
      const h = (e: MediaQueryListEvent) => {
        reducedMotionRef.current = e.matches;
        if (materialRef.current)
          materialRef.current.uniforms.uReducedMotion.value = e.matches ? 1 : 0;
      };
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }, []);

    // Imperative API
    useImperativeHandle(ref, () => ({
      burst: (scale = 1.0) => {
        if (reducedMotionRef.current) return;
        burstScaleRef.current = scale * 0.12; // full = 0.12, voice-end 0.33 → 0.04
        burstStartRef.current = performance.now();
      },
      morphToText: (text) => {
        if (!geometryRef.current) return;
        const tgt = sampleTextPoints(text, particleCountRef.current);
        const attr = geometryRef.current.getAttribute('aTargetPos') as THREE.BufferAttribute;
        if (attr) { attr.copyArray(tgt); attr.needsUpdate = true; }
        morphStartRef.current = performance.now();
      },
      playIntro: (onComplete) => {
        if (onComplete) introCallbackRef.current = onComplete;
        if (geometryRef.current) {
          const tgt = sampleTextPoints('J.A.R.V.I.S.', particleCountRef.current);
          const attr = geometryRef.current.getAttribute('aTargetPos') as THREE.BufferAttribute;
          if (attr) { attr.copyArray(tgt); attr.needsUpdate = true; }
        }
        introStartRef.current = performance.now();
      },
    }), []);

    // Propagate state index changes (triggers cross-fade)
    useEffect(() => {
      // Start a new cross-fade when stateIndex changes
      prevStateRef.current = materialRef.current
        ? materialRef.current.uniforms.uState.value
        : stateIndex;
      stateBlendRef.current = 0;
    }, [stateIndex]);

    // Propagate audio levels from props
    useEffect(() => {
      // Props-driven: App.tsx will pass real levels; we smooth them here
      // in the animation loop so nothing stale gets set.
    }, [inputLevel, outputLevel]);

    // WebGL lifecycle
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
      let N = isMobile ? 3500 : 7000;
      if (quality === 'reduced') {
        N = Math.round(N * 0.5); // About half the particles in reduced mode
      }
      particleCountRef.current = N;

      const extent = size * 1.4;
      const dpr    = quality === 'reduced' || reducedMotionRef.current
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 2);

      const scene  = new THREE.Scene();
      sceneRef.current = scene;

      const bound = 1.4;
      const camera = new THREE.OrthographicCamera(-bound, bound, bound, -bound, 0.1, 10);
      camera.position.set(0, 0, 3);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(extent, extent);
      renderer.setPixelRatio(dpr);
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      // Particle buffers
      const positions  = new Float32Array(N * 3);
      const homePosArr = new Float32Array(N * 3);
      const randoms    = new Float32Array(N * 4);
      const targets    = new Float32Array(N * 3);
      const PHI = Math.PI * (3 - Math.sqrt(5));

      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const t = PHI * i;
        const x = Math.cos(t) * r;
        const z = Math.sin(t) * r;
        positions[i * 3]     = homePosArr[i * 3]     = targets[i * 3]     = x;
        positions[i * 3 + 1] = homePosArr[i * 3 + 1] = targets[i * 3 + 1] = y;
        positions[i * 3 + 2] = homePosArr[i * 3 + 2] = targets[i * 3 + 2] = z;
        randoms[i * 4]     = Math.random();
        randoms[i * 4 + 1] = 0.6 + Math.random() * 1.4;
        randoms[i * 4 + 2] = 0.65 + Math.random() * 0.7;
        randoms[i * 4 + 3] = Math.random() * 100;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aHomePos',   new THREE.BufferAttribute(homePosArr, 3));
      geometry.setAttribute('aRandom',    new THREE.BufferAttribute(randoms, 4));
      geometry.setAttribute('aTargetPos', new THREE.BufferAttribute(targets, 3));
      geometryRef.current = geometry;

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime:          { value: 0 },
          uDt:            { value: 0.016 },
          uPixelRatio:    { value: dpr },
          uState:         { value: stateIndex },
          uStateBlend:    { value: 1 },
          uInputLevel:    { value: 0 },
          uOutputLevel:   { value: 0 },
          uReducedMotion: { value: reducedMotionRef.current ? 1 : 0 },
          uHitPoint3D:    { value: new THREE.Vector3(0, 0, 1) },
          uHitVelocity3D: { value: new THREE.Vector3() },
          uHoverStrength: { value: 0 },
          uBaseColor:     { value: new THREE.Color(ORB_THEME.base) },
          uAccentColor:   { value: new THREE.Color(ORB_THEME.accent) },
          uGlowColor:     { value: new THREE.Color(ORB_THEME.glow) },
          uBurst:         { value: 0 },
          uBurstScale:    { value: 0.12 },
          uIntro:         { value: 0 },
          uMorph:         { value: 0 },
          uThinkingBand:  { value: 0 },
          uThinkAngle:    { value: 0 },
          uRipplePhase:   { value: 0 },
          uRippleAmp:     { value: 0 },
          uIsLight:       { value: 0 },
        },
        transparent: true,
        blending: THREE.NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
      });
      materialRef.current = material;
      scene.add(new THREE.Points(geometry, material));

      // ── Animation loop ──────────────────────────────────────────────────────
      let paused = false;

      const animate = () => {
        if (paused) return;

        const now = performance.now();
        const dt  = Math.min((now - lastTimeRef.current) / 1000, 1 / 30);
        lastTimeRef.current = now;

        const elapsed = (now - startTimeRef.current) / 1000;
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uDt.value   = dt;

        // ── Dynamic Theme Colors ──────────────────────────────────────────────
        const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
        material.uniforms.uIsLight.value = isLight ? 1 : 0;
        material.uniforms.uBaseColor.value.set(isLight ? ORB_THEME_LIGHT.base : ORB_THEME.base);
        material.uniforms.uAccentColor.value.set(isLight ? ORB_THEME_LIGHT.accent : ORB_THEME.accent);
        material.uniforms.uGlowColor.value.set(isLight ? ORB_THEME_LIGHT.glow : ORB_THEME.glow);

        // ── State cross-fade over 500ms ───────────────────────────────────────
        stateBlendRef.current = Math.min(1, stateBlendRef.current + dt / 0.5);
        material.uniforms.uState.value = stateIndexRef.current; // read from ref, never stale
        material.uniforms.uStateBlend.value = stateBlendRef.current;

        // ── Thinking angle drift ──────────────────────────────────────────────
        thinkAngleRef.current += dt * 0.4;
        material.uniforms.uThinkAngle.value = thinkAngleRef.current;

        // ── Smooth audio levels ───────────────────────────────────────────────
        // Fast attack (τ≈80ms), slow release (τ≈400ms) for inputLevel
        const rawIn  = inputLevelRef.current;
        const rawOut = outputLevelRef.current;
        const kInAtt = 1 - Math.exp(-dt / 0.08);   // attack 80ms
        const kInRel = 1 - Math.exp(-dt / 0.40);   // release 400ms
        const kIn    = rawIn > smoothInputRef.current ? kInAtt : kInRel;
        smoothInputRef.current  += (rawIn  - smoothInputRef.current)  * kIn;

        const kOut = 1 - Math.exp(-dt / 0.12);
        smoothOutputRef.current += (rawOut - smoothOutputRef.current) * kOut;

        // Simulated mic level when listening with no real data
        let effectiveInput  = smoothInputRef.current;
        let effectiveOutput = smoothOutputRef.current;

        if (stateIndexRef.current === 1 && effectiveInput < 0.02) {
          // Soft varying simulation: gentle random breath
          simPhaseRef.current += dt * 2.3;
          effectiveInput = 0.12 + Math.sin(simPhaseRef.current) * 0.08
                         + Math.sin(simPhaseRef.current * 2.7) * 0.04;
        }
        if (stateIndexRef.current === 3 && effectiveOutput < 0.02) {
          // Soft TTS simulation envelope
          simPhaseRef.current += dt * 4.1;
          effectiveOutput = 0.15 + Math.sin(simPhaseRef.current) * 0.10
                          + Math.sin(simPhaseRef.current * 1.9) * 0.05;
        }

        material.uniforms.uInputLevel.value  = effectiveInput;
        material.uniforms.uOutputLevel.value = effectiveOutput;

        // ── Speaking ripple ───────────────────────────────────────────────────
        material.uniforms.uRipplePhase.value = elapsed * 2.8; // slow travel
        material.uniforms.uRippleAmp.value   = effectiveOutput;

        // ── Hover ──────────────────────────────────────────────────────────────
        const targetStr = isHoveredRef.current ? 1.0 : 0.0;
        const fadeK = isHoveredRef.current ? 12.0 : 1.0 / 0.6;
        hoverStrRef.current += (targetStr - hoverStrRef.current) * Math.min(1, dt * fadeK);
        material.uniforms.uHoverStrength.value = hoverStrRef.current;

        const kSmooth = 8.0;
        const alpha   = 1 - Math.exp(-kSmooth * dt);
        const prevHit = hitPointRef.current.clone();
        hitPointRef.current.lerp(hitTargetRef.current, alpha);
        if (isHoveredRef.current) {
          const rawVel = hitPointRef.current.clone().sub(prevHit).divideScalar(Math.max(dt, 0.001));
          hitVelRef.current.lerp(rawVel, alpha * 1.5);
        } else {
          hitVelRef.current.multiplyScalar(Math.exp(-dt * 4.0));
        }
        material.uniforms.uHitPoint3D.value.copy(hitPointRef.current);
        material.uniforms.uHitVelocity3D.value.copy(hitVelRef.current);

        // ── Burst ──────────────────────────────────────────────────────────────
        if (burstStartRef.current !== null) {
          const age = (now - burstStartRef.current) / 1000;
          // 0→peak in 180ms (ease-out), then spring back with slight overshoot over 500ms
          let env = 0;
          if (age < 0.18) {
            env = 1 - Math.pow(1 - age / 0.18, 2); // ease-out rise
          } else {
            const t2 = (age - 0.18) / 0.50;
            if (t2 < 1) {
              // Damped oscillation: one small overshoot
              env = Math.exp(-t2 * 4.0) * Math.cos(t2 * Math.PI * 1.4);
              env = Math.max(0, env); // only outward
            } else {
              burstStartRef.current = null;
              env = 0;
            }
          }
          material.uniforms.uBurst.value = env;
          material.uniforms.uBurstScale.value = burstScaleRef.current;
        }

        // ── Intro progression (3.8s duration for cinematic pacing) ────────────
        if (introStartRef.current !== null) {
          const INTRO_DURATION = 3.8;
          const age = (now - introStartRef.current) / 1000;
          const progress = Math.min(1.0, age / INTRO_DURATION);
          material.uniforms.uIntro.value = progress;

          // When particles have completed their transition into the spherical orb (progress >= 0.88),
          // notify the app to initiate the smooth dashboard reveal.
          if (progress >= 0.88 && introCallbackRef.current) {
            introCallbackRef.current();
            introCallbackRef.current = null;
          }

          if (progress >= 1.0) {
            introStartRef.current = null;
            material.uniforms.uIntro.value = 0;
          }
        }

        if (morphStartRef.current !== null) {
          const age = (now - morphStartRef.current) / 1000;
          if (age < 0.6)       material.uniforms.uMorph.value = age / 0.6;
          else if (age < 2.6)  material.uniforms.uMorph.value = 1.0;
          else if (age < 3.2)  material.uniforms.uMorph.value = 1 - (age - 2.6) / 0.6;
          else { morphStartRef.current = null; material.uniforms.uMorph.value = 0; }
        }

        renderer.render(scene, camera);
        animIdRef.current = requestAnimationFrame(animate);
      };

      animIdRef.current = requestAnimationFrame(animate);

      const onVisibility = () => {
        if (document.hidden) {
          paused = true;
          if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        } else {
          paused = false;
          lastTimeRef.current = performance.now();
          animIdRef.current = requestAnimationFrame(animate);
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        renderer.dispose();
        geometry.dispose();
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Smooth DPR-aware resize without re-creating the Three.js scene
    useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const extent = size * 1.4;
      renderer.setSize(extent, extent);
    }, [size]);

    // Sync state into uniform outside the rAF loop for immediate response
    useEffect(() => {
      if (!materialRef.current) return;
      prevStateRef.current = materialRef.current.uniforms.uState.value;
      stateBlendRef.current = 0;
      materialRef.current.uniforms.uState.value = stateIndex;
    }, [stateIndex]);

    // ── Pointer → ray-sphere ─────────────────────────────────────────────────
    const raySphereTest = (nx: number, ny: number) => {
      const d = 1 - nx * nx - ny * ny;
      if (d < 0) return null;
      return new THREE.Vector3(nx, ny, Math.sqrt(d)).normalize();
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2);
      const ny = -(e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2);
      const hit = raySphereTest(nx, ny);
      if (hit) {
        isHoveredRef.current = true;
        hitTargetRef.current.copy(hit);
        if (hitPointRef.current.z > 0.999 && hitPointRef.current.x === 0)
          hitPointRef.current.copy(hit);
      } else {
        isHoveredRef.current = false;
      }
    };

    const handlePointerLeave = () => { isHoveredRef.current = false; };

    const canvasExtent = size * 1.4;
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 rounded-full select-none"
        style={{ width: size, height: size, pointerEvents: 'auto' }}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerMove}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          className="absolute pointer-events-none"
          style={{
            width:     canvasExtent,
            height:    canvasExtent,
            left:      '50%',
            top:       '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    );
  }
);
