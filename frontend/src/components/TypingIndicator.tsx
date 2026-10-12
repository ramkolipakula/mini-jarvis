import { motion } from 'framer-motion';

/**
 * Typing indicator — three pulsing dots shown while the assistant "thinks".
 */
export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-jarvis-cyan/30 bg-jarvis-cyan/10">
        <span className="font-display text-[10px] font-bold text-jarvis-cyan-bright">J</span>
      </div>
      <div className="glass-panel px-4 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-jarvis-cyan"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
