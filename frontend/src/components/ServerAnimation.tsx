import { motion } from 'framer-motion';

interface ServerAnimationProps {
  size?: number;
  label?: string;
  showLabel?: boolean;
}

/**
 * Isometric server-stack animation — a small blue 3D server icon with
 * a subtle floating effect and soft blue glow. Recreated as lightweight
 * SVG + CSS (no external image dependency).
 *
 * Used in two contexts:
 * 1. Full-screen loading screen ("Initializing JARVIS…")
 * 2. Inline thinking state inside the chat area ("Thinking…")
 */
export function ServerAnimation({ size = 64, label, showLabel = true }: ServerAnimationProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <motion.div
        className="relative"
        style={{ width: size, height: size }}
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Soft blue glow behind the icon */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%)',
            filter: 'blur(12px)',
            animation: 'server-glow 3s ease-in-out infinite',
          }}
        />

        {/* Isometric server stack SVG */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className="relative z-10"
        >
          <defs>
            <linearGradient id="server-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="server-top" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="server-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </linearGradient>
          </defs>

          {/* Isometric transform: rotate 30deg + skew — applied per group */}

          {/* Bottom unit — side face (right) */}
          <g transform="translate(40, 52)">
            <path
              d="M0,0 L18,-10 L18,6 L0,16 Z"
              fill="url(#server-side)"
              opacity={0.85}
            />
            {/* Bottom unit — top face */}
            <path
              d="M0,0 L-18,-10 L0,-20 L18,-10 Z"
              fill="url(#server-top)"
            />
            {/* Bottom unit — front face */}
            <path
              d="M0,0 L-18,-10 L-18,6 L0,16 Z"
              fill="url(#server-face)"
            />
            {/* LED indicators on front face */}
            <circle cx="-13" cy="-4" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="-9" cy="-6" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Middle unit */}
          <g transform="translate(40, 36)">
            <path
              d="M0,0 L18,-10 L18,6 L0,16 Z"
              fill="url(#server-side)"
              opacity={0.85}
            />
            <path
              d="M0,0 L-18,-10 L0,-20 L18,-10 Z"
              fill="url(#server-top)"
            />
            <path
              d="M0,0 L-18,-10 L-18,6 L0,16 Z"
              fill="url(#server-face)"
            />
            <circle cx="-13" cy="-4" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="-9" cy="-6" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.3s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Top unit */}
          <g transform="translate(40, 20)">
            <path
              d="M0,0 L18,-10 L18,6 L0,16 Z"
              fill="url(#server-side)"
              opacity={0.85}
            />
            <path
              d="M0,0 L-18,-10 L0,-20 L18,-10 Z"
              fill="url(#server-top)"
            />
            <path
              d="M0,0 L-18,-10 L-18,6 L0,16 Z"
              fill="url(#server-face)"
            />
            <circle cx="-13" cy="-4" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
            </circle>
            <circle cx="-9" cy="-6" r="1.2" fill="#67e8f9">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.1s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>
      </motion.div>

      {showLabel && label && (
        <p className="mt-4 font-display text-[11px] tracking-[0.3em] text-jarvis-cyan/70 uppercase whitespace-nowrap">
          {label}
        </p>
      )}
    </div>
  );
}
