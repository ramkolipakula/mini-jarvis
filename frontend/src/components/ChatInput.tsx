import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  micSupported: boolean;
  isListening: boolean;
  onToggleMic: () => void;
  micError: string | null;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  micSupported,
  isListening,
  onToggleMic,
  micError,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      {micError && (
        <div className="mb-2 px-4 py-2 rounded-lg bg-jarvis-cyan/10 border border-jarvis-cyan/30 text-jarvis-cyan-bright text-xs">
          {micError}
        </div>
      )}

      <div
        className={`glass-panel hud-frame flex items-end gap-2 p-2 transition-all duration-300 rounded-2xl ${
          isFocused ? '!border-jarvis-cyan/50 !shadow-[0_0_24px_rgba(34,211,238,0.15)]' : ''
        }`}
      >
        {/* Microphone button */}
        {micSupported && (
          <button
            onClick={onToggleMic}
            className={`relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
              isListening
                ? 'border-jarvis-cyan/50 bg-jarvis-cyan/15 text-jarvis-cyan-bright'
                : 'border-jarvis-border text-jarvis-slate hover:text-jarvis-cyan hover:border-jarvis-cyan/30 hover:bg-jarvis-cyan/5'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={isListening}
          >
            {isListening ? (
              <>
                {/* Pulsing ring while listening */}
                <motion.span
                  className="absolute inset-0 rounded-xl border-2 border-jarvis-cyan"
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                />
                <Square className="w-4 h-4 relative z-10" />
              </>
            ) : (
              <Mic className="w-4 h-4 icon-scale-hover" />
            )}
          </button>
        )}

        {!micSupported && (
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-jarvis-slate-dim/30 text-jarvis-slate-dim/50"
            aria-label="Microphone not supported in this browser"
          >
            <MicOff className="w-4 h-4" />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={1}
          placeholder="Type your message to JARVIS…"
          className="flex-1 bg-transparent resize-none px-2 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none max-h-40"
          aria-label="Message input"
          disabled={disabled}
        />

        {/* Send button & status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className={`btn-glow w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 focus-visible:ring-2 focus-visible:ring-jarvis-cyan ${
              value.trim() && !disabled
                ? 'border-jarvis-cyan/40 bg-jarvis-cyan/15 text-jarvis-cyan-bright hover:bg-jarvis-cyan/25 hover:border-jarvis-cyan/60'
                : 'border-slate-700/70 bg-slate-800/40 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
          <span
            className="w-1.5 h-1.5 rounded-full bg-jarvis-cyan-bright shadow-[0_0_6px_#22d3ee] shrink-0"
            aria-label="System status: Ready"
          />
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-2 tracking-wide font-mono">
        Connected to JARVIS core
      </p>
    </div>
  );
}
