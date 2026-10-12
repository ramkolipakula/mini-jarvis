import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';

import type { OrbState } from '@/types';
import { OrbParticles, type OrbParticlesHandle } from './OrbParticles';

interface AIOrbProps {
  state: OrbState;
  size?: number;
  /** Optional content rendered inside the orb core (e.g. a voice visualizer). */
  children?: ReactNode;
  inputLevel?: number;
  outputLevel?: number;
  particlesRef?: React.Ref<OrbParticlesHandle>;
  showHousing?: boolean;
  brighten?: boolean;
  idleGlow?: boolean;
  quality?: 'full' | 'balanced' | 'reduced';
}

interface StateConfig {
  /** CSS class that drives the rotating-ring box-shadow animation. */
  circleClass: string;
  /** Animation duration for the dashed inner ring (seconds). */
  dashDuration: number;
  /** Whether to show expanding pulse rings (listening state). */
  showPulseRings: boolean;
  /** Outer glow color and intensity. */
  glowColor: string;
  glowOpacity: number;
  /** Core pulse animation key. */
  corePulseKey: string;
  /** ARIA label fragment. */
  ariaLabel: string;
}

const STATE_CONFIGS: Record<OrbState, StateConfig> = {
  idle: {
    circleClass: 'orb-circle-idle',
    dashDuration: 30,
    showPulseRings: false,
    glowColor: '#38bdf8',
    glowOpacity: 0.40,
    corePulseKey: 'orb-core-pulse',
    ariaLabel: 'idle',
  },
  listening: {
    circleClass: 'orb-circle-listening',
    dashDuration: 15,
    showPulseRings: true,
    glowColor: '#67e8f9',
    glowOpacity: 0.48, // +20% over idle
    corePulseKey: 'orb-core-pulse',
    ariaLabel: 'listening',
  },
  thinking: {
    circleClass: 'orb-circle-thinking',
    dashDuration: 6,
    showPulseRings: false,
    glowColor: '#60a5fa',
    glowOpacity: 0.48, // +20% over idle
    corePulseKey: 'orb-core-pulse',
    ariaLabel: 'processing',
  },
  speaking: {
    circleClass: 'orb-circle-speaking',
    dashDuration: 4,
    showPulseRings: false,
    glowColor: '#67e8f9',
    glowOpacity: 0.70,
    corePulseKey: 'orb-core-pulse-speaking',
    ariaLabel: 'speaking',
  },
};

const STATUS_LABELS: Record<OrbState, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

/**
 * Animated AI orb — visual centerpiece adapted from the 21st.dev loader.
 *
 * Uses CSS keyframe animations (not styled-jsx) for the rotating layered
 * inset-shadow ring, plus Framer Motion for the outer glow and hover.
 * The status label is rendered separately (not inside the orb).
 *
 * Pass `children` to embed a voice visualizer inside the orb core.
 */
export function AIOrb({
  state,
  size = 180,
  children,
  inputLevel = 0,
  outputLevel = 0,
  particlesRef,
  showHousing = true,
  brighten = false,
  idleGlow = false,
  quality = 'full',
}: AIOrbProps) {
  const config = useMemo(() => STATE_CONFIGS[state], [state]);
  const statusLabel = STATUS_LABELS[state];
  const effectiveGlow = useMemo(() => {
    return Math.min(1.0, config.glowOpacity * (brighten ? 1.35 : 1.0));
  }, [config.glowOpacity, brighten]);

  return (
    <div
      className="flex flex-col items-center justify-center"
      role="img"
      aria-label={`JARVIS orb — ${config.ariaLabel}`}
    >
      <div
        className="relative flex items-center justify-center cursor-pointer select-none"
        style={{ width: size, height: size }}
      >
        {/* CSS Orb Housing (outer glow, rotating rings, core) — fades in when dashboard is revealed */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={false}
          animate={{ opacity: showHousing ? 1 : 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Outer ambient glow — radial gradient without CSS blur filter or scaling */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: size * 1.15,
              height: size * 1.15,
              background: `radial-gradient(circle, ${config.glowColor}18 0%, transparent 68%)`,
              opacity: effectiveGlow,
              transition: 'opacity 0.4s ease-out',
            }}
            animate={{
              opacity: idleGlow
                ? [effectiveGlow * 0.45, effectiveGlow * 1.15, effectiveGlow * 0.45]
                : [effectiveGlow * 0.75, effectiveGlow, effectiveGlow * 0.75],
            }}
            transition={{
              duration: idleGlow
                ? 6.0
                : state === 'speaking'
                ? 1.4
                : state === 'thinking'
                ? 2.2
                : 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Expanding pulse rings — listening only */}
          {config.showPulseRings &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute rounded-full border-2 pointer-events-none"
                style={{
                  width: size,
                  height: size,
                  borderColor: config.glowColor,
                  animation: `orb-ring-expand 1.8s ease-out infinite`,
                  animationDelay: `${i * 0.6}s`,
                }}
              />
            ))}

          {/* Counter-rotating dashed ring */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: size * 0.88,
              height: size * 0.88,
              border: '1px dashed rgba(56, 189, 248, 0.2)',
              animation: `orb-dash-rotate ${config.dashDuration}s linear infinite reverse`,
            }}
          />

          {/* Main rotating circle with layered inset shadows (from 21st.dev) */}
          <div
            className={`absolute inset-0 rounded-full ${config.circleClass}`}
          />

          {/* Inner glow ring */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: size * 0.65,
              height: size * 0.65,
              border: '1px solid rgba(56, 189, 248, 0.15)',
              boxShadow: `inset 0 0 ${size * 0.1}px rgba(56, 189, 248, 0.1)`,
            }}
          />

          {/* Core orb */}
          <div
            className="relative rounded-full flex items-center justify-center overflow-hidden"
            style={{
              width: size * 0.45,
              height: size * 0.45,
              background: `radial-gradient(circle at 35% 35%, ${config.glowColor}dd 0%, ${config.glowColor}77 35%, #0e749055 75%, #03060d 100%)`,
              boxShadow: `0 0 ${size * 0.15}px ${config.glowColor}80, 0 0 ${size * 0.3}px ${config.glowColor}40, inset 0 0 ${size * 0.1}px rgba(3, 6, 13, 0.5)`,
              animation: `${config.corePulseKey} ${state === 'speaking' ? '0.8s' : state === 'thinking' ? '1.5s' : '3s'} ease-in-out infinite`,
            }}
          >
            {/* Inner shimmer */}
            <div
              className="absolute inset-2 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${config.glowColor}00 30%, ${config.glowColor}25 60%, ${config.glowColor}00 100%)`,
                animation: 'orb-core-pulse 2s ease-in-out infinite',
              }}
            />

            {/* Children render inside the core — voice visualizer slot */}
            {children && (
              <div className="relative z-10 flex items-center justify-center w-full h-full">
                {children}
              </div>
            )}
          </div>
        </motion.div>

        {/* Layered WebGL particles overlay — always active & visible */}
        <OrbParticles
          ref={particlesRef}
          state={state}
          size={size}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          quality={quality}
        />
      </div>

      {/* Status label — rendered below the orb, fades in with housing */}
      <motion.div
        className="mt-4 flex items-center gap-2"
        initial={false}
        animate={{ opacity: showHousing ? 1 : 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: config.glowColor,
            boxShadow: `0 0 6px ${config.glowColor}`,
            animation: 'orb-core-pulse 2s ease-in-out infinite',
          }}
        />
        <span className="font-display text-[11px] tracking-[0.3em] text-jarvis-cyan/80 uppercase whitespace-nowrap">
          {statusLabel}
        </span>
      </motion.div>
    </div>
  );
}
