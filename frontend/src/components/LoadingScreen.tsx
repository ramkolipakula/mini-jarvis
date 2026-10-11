import { AnimatePresence, motion } from 'framer-motion';

interface LoadingScreenProps {
  visible: boolean;
}

/**
 * Full-screen cinematic dark veil shown only during initial app startup.
 * Fades out smoothly as the particle orb forms and reveals the main interface.
 */
export function LoadingScreen({ visible }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none bg-[#03060d]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  );
}
