import { motion } from 'framer-motion';
import { Mic, MicOff, Square, X, VolumeX } from 'lucide-react';
import type { OrbState } from '@/types';
import type { FormattedError } from '@/lib/api';
import { SiriWave } from './SiriWave';
import { ActionTooltip } from './ui/tooltip';

export interface VoiceModeProps {
  orbElement: React.ReactNode;
  state: OrbState;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  lastAssistantMessage: string;
  energyRef?: React.MutableRefObject<number>;
  onToggleMic: () => void;
  onCancelSpeech: () => void;
  onExit: () => void;
  micSupported: boolean;
  errorMessage?: FormattedError | string | null;
  onRetry?: () => void;
}

export function VoiceMode({
  orbElement,
  state,
  isListening,
  isSpeaking,
  transcript,
  lastAssistantMessage,
  energyRef,
  onToggleMic,
  onCancelSpeech,
  onExit,
  micSupported,
  errorMessage,
  onRetry,
}: VoiceModeProps) {
  const handleMicClick = () => {
    if (isSpeaking) {
      // Tap while speaking interrupts JARVIS immediately per requirement
      onCancelSpeech();
    } else {
      onToggleMic();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-30 flex flex-col justify-between items-center px-4 pt-3 pb-6 pointer-events-auto select-none bg-[var(--bg)]/95 backdrop-blur-2xl"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top minimal status bar */}
      <div className="w-full max-w-[800px] flex items-center justify-between px-4 pt-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-xs tracking-[0.3em] font-medium text-[var(--accent)] text-glow">
            J.A.R.V.I.S
          </span>
          <span className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase px-2 py-0.5 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)]">
            VOICE MODE
          </span>
        </div>

        <ActionTooltip label="Exit voice mode (Esc)" side="bottom">
          <button
            onClick={onExit}
            className="p-2 rounded-full border border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--hairline-bright)] hover:bg-[var(--bg-elevated)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Exit voice mode"
          >
            <X className="w-4 h-4" />
          </button>
        </ActionTooltip>
      </div>

      {/* Center Stage: Hero Orb + Siri Wave (positioned slightly above vertical middle) */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[900px] -mt-4 sm:-mt-8 min-h-0">
        {/* Scaled-up hero orb canvas */}
        <div className="relative flex items-center justify-center shrink-0">
          {orbElement}
        </div>

        {/* Waveform under orb */}
        <div className="w-full max-w-[440px] mt-3 flex justify-center shrink-0">
          <SiriWave
            state={state}
            active={isSpeaking}
            energyRef={energyRef}
            height={56}
            className="w-full"
          />
        </div>

        {/* Large live captions region */}
        <div className="w-full max-w-[760px] min-h-[120px] px-6 mt-4 flex flex-col items-center justify-center text-center space-y-2.5">
          {transcript && (
            <motion.p
              key="user-transcript"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-light text-[var(--text-main)] leading-relaxed tracking-tight"
            >
              "{transcript}"
            </motion.p>
          )}

          {lastAssistantMessage && state !== 'listening' && (
            <motion.p
              key="assistant-speaking"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl sm:text-2xl font-light text-[var(--accent)] leading-relaxed tracking-tight"
            >
              {lastAssistantMessage}
            </motion.p>
          )}

          {errorMessage && (
            <div className="flex flex-col items-center gap-2 my-2">
              <p className="text-rose-400 font-mono text-xs sm:text-sm max-w-[480px]">
                {typeof errorMessage === 'string' ? errorMessage : errorMessage.friendly}
              </p>
              {typeof errorMessage !== 'string' && errorMessage.details && (
                <details className="text-[10px] text-rose-400/80 font-mono cursor-pointer max-w-[480px]">
                  <summary className="hover:underline select-none">Details</summary>
                  <div className="mt-1 p-1.5 rounded bg-black/50 font-mono break-all text-[9px] text-rose-200/90 max-h-20 overflow-y-auto">
                    {errorMessage.details}
                  </div>
                </details>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1 rounded-full border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono transition-all duration-200 mt-0.5"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!transcript && !errorMessage && !(lastAssistantMessage && state !== 'listening') && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-base sm:text-lg font-mono text-[var(--text-muted)] tracking-wide"
            >
              {isListening
                ? 'Listening… Speak your command (auto-stops at 20s)'
                : state === 'thinking'
                ? 'Processing response…'
                : 'Tap microphone or speak to begin'}
            </motion.p>
          )}
        </div>
      </div>

      {/* Bottom controls: anchored at bottom center with larger buttons */}
      <div className="flex items-center justify-center gap-6 pb-6 pt-2 shrink-0">
        {/* Large round mic button */}
        {micSupported ? (
          <div className="relative flex items-center justify-center">
            {/* Ambient pulse ring while recording */}
            {isListening && (
              <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] animate-ping opacity-60" />
            )}

            <ActionTooltip
              label={
                isSpeaking
                  ? 'Interrupt speech'
                  : isListening
                  ? 'Stop listening'
                  : 'Start voice command'
              }
              side="top"
            >
              <button
                type="button"
                onClick={handleMicClick}
                className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-2xl focus-visible:ring-4 focus-visible:ring-[var(--accent)]/50 active:scale-95 ${
                  isSpeaking
                    ? 'border-[var(--accent-glow)] bg-[var(--accent-dim)]/40 text-[var(--accent-bright)] animate-pulse'
                    : isListening
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_28px_var(--accent-glow)]'
                    : 'border-[var(--hairline-bright)] glass-surface-strong text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow-xl'
                }`}
                aria-label={
                  isSpeaking
                    ? 'Stop speaking'
                    : isListening
                    ? 'Stop listening'
                    : 'Start voice command'
                }
              >
                {isSpeaking ? (
                  <VolumeX className="w-8 h-8 pointer-events-none" />
                ) : isListening ? (
                  <Square className="w-7 h-7 fill-current pointer-events-none" />
                ) : (
                  <Mic className="w-8 h-8 pointer-events-none" />
                )}
              </button>
            </ActionTooltip>
          </div>
        ) : (
          <ActionTooltip label="Microphone not supported" side="top">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border border-[var(--hairline)] text-[var(--text-muted)] glass-surface"
              aria-label="Microphone not supported"
            >
              <MicOff className="w-8 h-8" />
            </div>
          </ActionTooltip>
        )}

        {/* Larger End button */}
        <ActionTooltip label="Return to chat" side="top">
          <button
            onClick={onExit}
            className="w-14 h-14 rounded-full flex items-center justify-center border border-[var(--hairline)] glass-surface-strong text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--hairline-bright)] hover:bg-[var(--user-tint)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-95 shadow-lg"
            aria-label="Exit voice mode"
          >
            <X className="w-6 h-6" />
          </button>
        </ActionTooltip>
      </div>
    </motion.div>
  );
}
