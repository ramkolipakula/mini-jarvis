import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  PanelLeft,
  Moon,
  Sun,
  AudioLines,
  MessageSquare,
  Sliders,
  Maximize2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Conversation } from '@/types';
import { isMac } from '@/lib/utils';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  category: 'Actions' | 'Navigation' | 'Conversations';
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  currentMode: 'chat' | 'voice';
  onToggleMode: (mode: 'chat' | 'voice') => void;
  onOpenSettings: () => void;
  onReplayIntro: () => void;
  onToggleFullscreen: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onToggleSidebar,
  onToggleTheme,
  currentMode,
  onToggleMode,
  onOpenSettings,
  onReplayIntro,
  onToggleFullscreen,
  conversations,
  onSelectConversation,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct command list
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: 'new-chat',
        title: 'New Conversation',
        subtitle: 'Start a fresh dialogue with JARVIS',
        icon: Plus,
        category: 'Actions',
        shortcut: isMac ? '⌘N' : 'Ctrl+N',
        run: () => onNewChat(),
      },
      {
        id: 'toggle-mode',
        title: currentMode === 'chat' ? 'Switch to Voice Mode' : 'Switch to Chat Mode',
        subtitle: currentMode === 'chat' ? 'Open immersive audio visualizer' : 'Return to text dialogue',
        icon: currentMode === 'chat' ? AudioLines : MessageSquare,
        category: 'Actions',
        run: () => onToggleMode(currentMode === 'chat' ? 'voice' : 'chat'),
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        subtitle: 'Show or hide conversation history',
        icon: PanelLeft,
        category: 'Navigation',
        shortcut: isMac ? '⌘\\' : 'Ctrl+\\',
        run: () => onToggleSidebar(),
      },
      {
        id: 'toggle-theme',
        title: 'Toggle Color Theme',
        subtitle: 'Switch between Dark and Light mode',
        icon: Sun,
        category: 'Navigation',
        shortcut: isMac ? '⌘T' : 'Ctrl+T',
        run: () => onToggleTheme(),
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        subtitle: 'Configure visual engine, audio, and quality',
        icon: Sliders,
        category: 'Navigation',
        shortcut: isMac ? '⌘,' : 'Ctrl+,',
        run: () => onOpenSettings(),
      },
      {
        id: 'toggle-fullscreen',
        title: 'Toggle Fullscreen',
        subtitle: 'Present interface in true fullscreen display',
        icon: Maximize2,
        category: 'Actions',
        shortcut: 'F',
        run: () => onToggleFullscreen(),
      },
      {
        id: 'replay-intro',
        title: 'Replay Cinematic Intro',
        subtitle: 'Run particle dust and wordmark startup sequence',
        icon: RotateCcw,
        category: 'Actions',
        run: () => onReplayIntro(),
      },
    ];

    // Add recent non-empty conversations
    conversations.forEach((conv) => {
      if (conv.messages.length > 0) {
        list.push({
          id: `conv-${conv.id}`,
          title: conv.title || 'Untitled Session',
          subtitle: `${conv.messages.length} messages · ${new Date(conv.updatedAt).toLocaleDateString()}`,
          icon: MessageSquare,
          category: 'Conversations',
          run: () => onSelectConversation(conv.id),
        });
      }
    });

    return list;
  }, [
    currentMode,
    conversations,
    onNewChat,
    onToggleSidebar,
    onToggleTheme,
    onToggleMode,
    onOpenSettings,
    onReplayIntro,
    onToggleFullscreen,
    onSelectConversation,
  ]);

  // Filter commands by fuzzy match
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].run();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Auto-scroll selected item into view so it never clips under header or footer
  useEffect(() => {
    if (listRef.current && listRef.current.children) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Palette Container */}
        <motion.div
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--hairline-bright)] bg-[var(--bg-panel)] shadow-2xl backdrop-blur-2xl z-10 text-[var(--text-main)]"
          initial={{ opacity: 0, scale: 0.96, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--hairline)]">
            <Search className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search actions, settings, or conversations…"
              className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
              aria-label="Command search input"
            />
            <kbd className="hidden sm:inline-block px-2 py-0.5 rounded border border-[var(--hairline)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-muted)]">
              ESC
            </kbd>
          </div>

          {/* Results list with comfortable top and bottom padding */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto px-2.5 py-3 space-y-1 scroll-py-2"
            role="listbox"
          >
            {filteredCommands.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full border border-[var(--hairline)] bg-[var(--user-tint)] flex items-center justify-center mb-3">
                  <Sparkles className="w-4 h-4 text-[var(--accent)] animate-pulse" />
                </div>
                <p className="text-xs font-mono text-[var(--text-main)] font-medium">
                  No commands found
                </p>
                <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                  Try a different search term or check spelling
                </p>
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.run();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--user-tint)] text-[var(--accent)] border border-[var(--accent)]/30'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-elevated)] border border-transparent'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isSelected
                            ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{cmd.title}</div>
                        {cmd.subtitle && (
                          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                            {cmd.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] opacity-60">
                        {cmd.category}
                      </span>
                      {cmd.shortcut && (
                        <kbd className="px-1.5 py-0.5 rounded border border-[var(--hairline)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-muted)]">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 border-t border-[var(--hairline)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)]/40">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to dismiss</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
