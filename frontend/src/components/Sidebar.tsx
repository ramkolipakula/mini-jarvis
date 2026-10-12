import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Pencil,
  Trash2,
  X,
  Settings,
  Sparkles,
  Check,
} from 'lucide-react';
import type { Conversation } from '@/types';
import { ActionTooltip } from './ui/tooltip';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onTogglePin?: (id: string) => void;
  onOpenSettings?: () => void;
  backendStatus?: 'online' | 'offline' | 'mock';
}

export function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  onOpenSettings,
  backendStatus = 'online',
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Group non-empty conversations by Today, Yesterday, and Earlier
  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => Array.isArray(c.messages) && c.messages.some((m) => m.role === 'user'))
      .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery]);

  const groups = useMemo(() => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const earlier: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    filteredConversations.forEach((conv) => {
      const time = conv.updatedAt || conv.createdAt;
      if (time >= todayStart) {
        today.push(conv);
      } else if (time >= yesterdayStart) {
        yesterday.push(conv);
      } else {
        earlier.push(conv);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Earlier', items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [filteredConversations]);

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim() && onRename) {
      onRename(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Click-outside backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Slide-over panel */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 w-[300px] h-full flex flex-col border-r border-[var(--hairline)] bg-[var(--bg-panel)] backdrop-blur-2xl transition-colors duration-300 ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        initial={false}
        animate={{
          x: open ? 0 : -300,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden={!open}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--hairline)]">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-[0.25em] text-[var(--accent)] font-bold text-glow">
              JARVIS
            </span>
            <span className="font-mono text-[9px] tracking-widest text-[var(--text-dim)] uppercase">
              ARCHIVES
            </span>
          </div>
        <ActionTooltip label="Close sidebar" side="bottom">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </ActionTooltip>
        </div>

        {/* Action: New Chat button */}
        <div className="px-3 pt-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl border border-[var(--hairline)] hover:border-[var(--hairline-bright)] bg-[var(--bg-elevated)] hover:bg-[var(--user-tint)] text-[var(--text-main)] hover:text-[var(--accent)] font-medium text-xs transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Start new conversation"
          >
            <Plus className="w-4 h-4 text-[var(--accent)]" />
            <span>New conversation</span>
          </button>
        </div>

        {/* Action: Search input */}
        <div className="px-3 pt-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--text-dim)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history…"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--hairline-bright)] font-sans"
              aria-label="Search conversations"
            />
          </div>
        </div>

        {/* Grouped History List */}
        <div className="flex-1 overflow-y-auto px-3 mt-3 pb-3 space-y-4">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="relative w-12 h-12 rounded-full border border-[var(--hairline-bright)] bg-[var(--user-tint)] flex items-center justify-center mb-3 shadow-[0_0_16px_var(--user-tint)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent-glow)]" />
                <div
                  className="absolute inset-1 rounded-full border border-[var(--accent)]/30 border-dashed animate-spin"
                  style={{ animationDuration: '12s' }}
                />
              </div>
              <p className="text-xs font-mono font-medium text-[var(--text-main)]">
                No archived dialogues
              </p>
              <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                Completed conversations will appear here
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--text-dim)] px-2 mb-1.5 font-semibold">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isActive = conv.id === activeId;
                    const isEditing = editingId === conv.id;
                    const isConfirmingDelete = confirmDeleteId === conv.id;

                    return (
                      <li key={conv.id}>
                        {isEditing ? (
                          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--accent)] bg-[var(--user-tint)]">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(conv.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
                            />
                            <button
                              onClick={() => handleSaveRename(conv.id)}
                              className="p-1 text-[var(--accent)]"
                              aria-label="Save title"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : isConfirmingDelete ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[var(--accent)] bg-[var(--user-tint)] text-xs">
                            <span className="text-[11px] text-[var(--text-main)] font-mono">Confirm delete?</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onDelete(conv.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 rounded bg-[var(--accent)] text-white text-[10px] font-mono"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 rounded border border-[var(--hairline)] text-[10px] font-mono"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                              isActive
                                ? 'bg-[var(--user-tint)] border border-[var(--hairline-bright)] text-[var(--accent)] font-medium shadow-sm'
                                : 'border border-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                            onClick={() => onSelect(conv.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(conv.id);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Select conversation: ${conv.title}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {conv.pinned ? (
                                <Pin className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[var(--text-dim)] group-hover:text-[var(--accent)] transition-colors" />
                              )}
                              <span className="text-xs truncate">{conv.title}</span>
                            </div>

                            {/* Hover Actions: Pin, Rename, Delete */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                              {onTogglePin && (
                                <ActionTooltip label={conv.pinned ? 'Unpin' : 'Pin conversation'} side="top">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onTogglePin(conv.id);
                                    }}
                                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                    aria-label="Pin conversation"
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                </ActionTooltip>
                              )}
                              {onRename && (
                                <ActionTooltip label="Rename" side="top">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRename(conv);
                                    }}
                                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                    aria-label="Rename conversation"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </ActionTooltip>
                              )}
                              <ActionTooltip label="Delete" side="top">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(conv.id);
                                  }}
                                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                  aria-label="Delete conversation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </ActionTooltip>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--hairline)] flex items-center justify-between text-xs text-[var(--text-dim)] font-mono">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <div className="flex items-center gap-1.5 text-[10px]">
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            <span>
              {backendStatus === 'online'
                ? 'Live'
                : backendStatus === 'offline'
                ? 'Offline'
                : 'Mock mode'}
            </span>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
