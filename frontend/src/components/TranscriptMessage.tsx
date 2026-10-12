import { useState, useEffect } from 'react';
import { Copy, Check, Volume2, RotateCcw } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { ActionTooltip } from './ui/tooltip';

interface TranscriptMessageProps {
  message: ChatMessage;
  isLatestAssistant?: boolean;
  onSpeak: (text: string, audio?: string | null) => void;
  onRegenerate?: () => void;
  onCopyToast?: (text: string) => void;
}

export function TranscriptMessage({
  message,
  isLatestAssistant = false,
  onSpeak,
  onRegenerate,
  onCopyToast,
}: TranscriptMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [displayedWords, setDisplayedWords] = useState<number>(() =>
    isLatestAssistant ? 0 : message.content.split(' ').length
  );

  const words = message.content.split(' ');

  // Word-by-word streaming animation for fresh assistant messages
  useEffect(() => {
    if (!isLatestAssistant) {
      setDisplayedWords(words.length);
      return;
    }
    setDisplayedWords(1);
    const interval = setInterval(() => {
      setDisplayedWords((prev) => {
        if (prev >= words.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 28); // ~35 words per second streaming rate
    return () => clearInterval(interval);
  }, [message.content, isLatestAssistant, words.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopyToast?.('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isStreaming = isLatestAssistant && displayedWords < words.length;
  const contentToDisplay = isStreaming
    ? words.slice(0, displayedWords).join(' ')
    : message.content;

  // Format code blocks if present
  const renderFormattedText = (text: string) => {
    if (text.includes('```')) {
      const parts = text.split(/(```[\s\S]*?```)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeContent = part.slice(3, -3).replace(/^[a-z]+\n/, '');
          return (
            <div
              key={idx}
              className="my-3 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3 font-mono text-xs overflow-x-auto text-[var(--text-main)]"
            >
              <pre>{codeContent}</pre>
            </div>
          );
        }
        return <span key={idx}>{part}</span>;
      });
    }
    return text;
  };

  return (
    <article
      className={`group relative pl-4 md:pl-5 py-3 transition-colors duration-200 border-l-2 ${
        isUser
          ? 'border-[var(--user-border)] bg-[var(--user-tint)] rounded-r-xl my-2'
          : 'border-[var(--hairline-bright)] hover:border-[var(--accent)] my-3'
      }`}
      aria-label={`${isUser ? 'Your message' : 'JARVIS message'}`}
    >
      {/* Header meta: micro mono label + timestamp */}
      <div className="flex items-center justify-between mb-1.5 select-none">
        <div className="flex items-center gap-2.5">
          <span
            className={`font-mono text-[10px] tracking-[0.2em] uppercase font-semibold ${
              isUser ? 'text-[var(--text-dim)]' : 'text-[var(--accent)]'
            }`}
          >
            {isUser ? 'YOU' : 'JARVIS'}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Hover action bar */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
          <ActionTooltip label="Copy message" side="top">
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:opacity-100"
              aria-label="Copy message text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </ActionTooltip>
          {!isUser && (
            <>
              <ActionTooltip label="Speak again" side="top">
                <button
                  onClick={() => onSpeak(message.content, message.audio)}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:opacity-100"
                  aria-label="Read message aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </ActionTooltip>
              {onRegenerate && (
                <ActionTooltip label="Regenerate response" side="top">
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:opacity-100"
                    aria-label="Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </ActionTooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Message content */}
      <div className="font-sans text-sm md:text-[15px] leading-relaxed text-[var(--text-main)] whitespace-pre-wrap">
        {renderFormattedText(contentToDisplay)}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-[var(--caret-color)] animate-pulse align-middle" />
        )}
      </div>
    </article>
  );
}
