import { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Send, AudioLines, Square, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionTooltip } from './ui/tooltip';

// Editable suggestion chips constant at top of file per requirement
export const DEFAULT_SUGGESTION_CHIPS = [
  'Analyze system telemetry & diagnostics',
  'What are your primary neural protocols?',
  'Initiate simulated threat assessment',
  'Explain quantum cognitive architecture',
] as const;

interface CommandBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  disabled: boolean;
  micSupported: boolean;
  isListening: boolean;
  onToggleMic: () => void;
  onSwitchToVoice: () => void;
  showSuggestions?: boolean;
  backendStatus?: 'online' | 'offline' | 'mock';
}

export function CommandBar({
  value,
  onChange,
  onSend,
  disabled,
  micSupported,
  isListening,
  onToggleMic,
  onSwitchToVoice,
  showSuggestions = false,
  backendStatus = 'online',
}: CommandBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Global "/" keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 pb-4 pt-2">
      {/* Idle state suggestion chips */}
      <AnimatePresence>
        {showSuggestions && !hasText && (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-2 mb-3 px-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {DEFAULT_SUGGESTION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => onSend(chip)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--user-tint)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label={`Suggestion: ${chip}`}
              >
                <span>{chip}</span>
                <CornerDownLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating glass command bar */}
      {/* Floating glass command bar */}
      <div
        className={`relative rounded-2xl transition-all duration-300 ${
          isFocused ? 'shadow-2xl' : 'shadow-panel'
        }`}
      >
        {/* Border beam: clipped strictly to border-radius via overflow-hidden wrapper */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden pointer-events-none transition-opacity duration-300 z-0 ${
            isFocused ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          <div
            className="absolute -top-[150%] -left-[150%] w-[400%] h-[400%]"
            style={{
              background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 290deg, var(--accent) 345deg, var(--accent-bright) 360deg)',
              animation: 'border-beam-spin 4s linear infinite',
            }}
          />
          {/* Inner cutout surface leaves only 1px glowing perimeter */}
          <div className="absolute inset-[1px] rounded-[15px] bg-[var(--bg-glass-strong)] backdrop-blur-2xl" />
        </div>

        {/* Bar content surface */}
        <div
          className={`relative z-10 glass-surface-strong rounded-2xl flex items-end gap-2 p-2.5 border transition-colors duration-200 ${
            isFocused ? 'border-transparent' : 'border-[var(--hairline)]'
          }`}
        >
          {/* Microphone button */}
          {micSupported ? (
            <ActionTooltip label={isListening ? 'Stop listening' : 'Start voice input'} side="top">
              <button
                type="button"
                onMouseDown={(e) => {
                  // Prevent stealing focus from textarea / causing blur race condition
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleMic();
                }}
                disabled={disabled}
                className={`relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isListening
                    ? 'border-[var(--accent)] bg-[var(--user-tint)] text-[var(--accent)]'
                    : 'border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--hairline-bright)] hover:bg-[var(--bg-elevated)]'
                }`}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                aria-pressed={isListening}
              >
                {isListening ? (
                  <>
                    {/* Live recording ring */}
                    <span className="absolute inset-0 rounded-xl border-2 border-[var(--accent)] animate-ping opacity-60 pointer-events-none" />
                    <Square className="w-4 h-4 relative z-10 fill-current pointer-events-none" />
                  </>
                ) : (
                  <Mic className="w-4 h-4 pointer-events-none" />
                )}
              </button>
            </ActionTooltip>
          ) : (
            <ActionTooltip label="Microphone not supported" side="top">
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--hairline)] text-[var(--text-muted)]"
                aria-label="Microphone not supported"
              >
                <MicOff className="w-4 h-4" />
              </div>
            </ActionTooltip>
          )}

          {/* Text input */}
          <div className="relative flex-1 flex flex-col justify-center">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              rows={1}
              placeholder="Command or query JARVIS… (press '/' to focus)"
              className="w-full bg-transparent resize-none px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none max-h-40 leading-relaxed font-sans"
              aria-label="Command bar input"
              disabled={disabled}
            />
          </div>

          {/* Action button: Voice Mode */}
          <ActionTooltip label="Switch to Voice mode" side="top">
            <button
              onClick={onSwitchToVoice}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--hairline-bright)] hover:bg-[var(--bg-elevated)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Switch to Voice mode"
            >
              <AudioLines className="w-4 h-4" />
            </button>
          </ActionTooltip>

          {/* Send button: visibly activates when input has text */}
          <ActionTooltip label="Send command" side="top">
            <button
              onClick={() => onSend()}
              disabled={!hasText || disabled}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                hasText && !disabled
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_14px_var(--accent-glow)] hover:opacity-90 active:scale-95'
                  : 'border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-60 cursor-not-allowed'
              }`}
              aria-label="Send command"
            >
              <Send className="w-4 h-4" />
            </button>
          </ActionTooltip>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 mt-2 text-[11px] font-mono text-[var(--text-muted)] select-none">
        <span>
          {backendStatus === 'online'
            ? 'Connected to JARVIS core'
            : backendStatus === 'offline'
            ? 'Backend unreachable. Retrying…'
            : 'Mock Mode active — no API key needed'}
        </span>
        <span className="hidden sm:inline">Press '/' to focus input · Enter to send</span>
      </div>
    </div>
  );
}
