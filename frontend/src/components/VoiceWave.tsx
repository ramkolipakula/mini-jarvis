import { motion } from 'framer-motion';

interface VoiceWaveProps {
  active: boolean;
  bars?: number;
  color?: string;
  height?: number;
}

/**
 * Voice visualizer component — animates a row of bars while speech is active.
 *
 * This is the integration point for a future, more sophisticated voice-wave
 * component. For now it provides a clean, self-contained bar visualizer that
 * pulses rhythmically when `active` is true and resets (flattens) when false.
 *
 * Usage:
 *   <VoiceWave active={isSpeaking} />
 *
 * Or embed inside the AIOrb:
 *   <AIOrb state={orbState}>
 *     <VoiceWave active={isSpeaking} />
 *   </AIOrb>
 */
export function VoiceWave({
  active,
  bars = 7,
  color = '#67e8f9',
  height = 28,
}: VoiceWaveProps) {
  return (
    <div
      className="flex items-center justify-center gap-[3px]"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}80`,
          }}
          animate={
            active
              ? {
                  height: [
                    `${height * 0.2}px`,
                    `${height * (0.5 + Math.random() * 0.5)}px`,
                    `${height * 0.2}px`,
                  ],
                  opacity: [0.5, 1, 0.5],
                }
              : {
                  height: `${height * 0.15}px`,
                  opacity: 0.3,
                }
          }
          transition={
            active
              ? {
                  duration: 0.4 + (i % 3) * 0.1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.05,
                }
              : {
                  duration: 0.3,
                  ease: 'easeOut',
                }
          }
        />
      ))}
    </div>
  );
}
