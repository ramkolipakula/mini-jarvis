import { motion } from 'framer-motion';

export function ThinkingIndicator() {
  return (
    <motion.div
      className="relative pl-5 py-2.5 my-2 flex items-center gap-3 border-l-2 border-[var(--accent)]"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25 }}
    >
      {/* Micro-orb with orbiting concentric rings */}
      <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
        {/* Core pulsing orb */}
        <div
          className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
          style={{ animation: 'micro-orb-pulse 1.4s ease-in-out infinite' }}
        />
        {/* Outer orbital ring 1 */}
        <div
          className="absolute inset-0 rounded-full border border-[var(--accent)] opacity-40"
          style={{
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            animation: 'micro-orb-spin 2s linear infinite',
          }}
        />
        {/* Outer orbital ring 2 (reverse) */}
        <div
          className="absolute inset-[-2px] rounded-full border border-[var(--accent-bright)] opacity-30"
          style={{
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            animation: 'micro-orb-spin 3s linear infinite reverse',
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--accent)]">
          THINKING
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </motion.div>
  );
}
