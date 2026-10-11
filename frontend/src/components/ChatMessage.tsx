import { motion } from 'framer-motion';
import { Copy, Check, Volume2, User } from 'lucide-react';
import { forwardRef, useState } from 'react';

import type { ChatMessage as ChatMessageType } from '@/types';

export interface ChatMessageProps {
  message: ChatMessageType;
  onSpeak: (text: string) => void;
}

export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  function ChatMessage({ message, onSpeak }, ref) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';

    const handleCopy = () => {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <motion.div
        ref={ref}
        className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 ${
          isUser
            ? 'border-jarvis-blue/30 bg-jarvis-blue/10'
            : 'border-jarvis-cyan/30 bg-jarvis-cyan/10'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-jarvis-blue" />
        ) : (
          <span className="font-display text-[10px] font-bold text-jarvis-cyan-bright">J</span>
        )}
      </div>

      {/* Message bubble */}
      <div className={`flex flex-col gap-1.5 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-300 ${
            isUser
              ? 'bg-jarvis-blue-deep/40 border border-jarvis-blue/25 text-slate-100 rounded-tr-sm'
              : 'glass-panel text-slate-200 rounded-tl-sm glass-panel-hover'
          }`}
        >
          {message.content}
        </div>

        {/* Action controls — appear on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[11px] text-slate-300 font-medium px-1.5">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-slate-300 hover:text-jarvis-cyan-bright hover:bg-jarvis-cyan/15 transition-all duration-200"
            aria-label="Copy message"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-jarvis-cyan-bright" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {!isUser && (
            <button
              onClick={() => onSpeak(message.content)}
              className="p-1.5 rounded-md text-slate-300 hover:text-jarvis-cyan-bright hover:bg-jarvis-cyan/15 transition-all duration-200"
              aria-label="Read message aloud"
            >
              <Volume2 className="w-3.5 h-3.5 icon-scale-hover" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
