import { useCallback, useEffect, useState } from 'react';

import type { ChatMessage, Conversation } from '@/types';
import { GREETING_MESSAGE } from '@/lib/mockAssistant';
import { deleteBackendConversation } from '@/lib/api';

/**
 * Hook for managing conversation history persisted to localStorage.
 */

const STORAGE_KEY = 'jarvis-conversations';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title: 'New Conversation',
    messages: [
      {
        id: generateId(),
        role: 'assistant',
        content: GREETING_MESSAGE,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
}

export function hasUserMessage(conversation: Conversation): boolean {
  return Array.isArray(conversation.messages) && conversation.messages.some((m) => m.role === 'user');
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    // Discard empty conversations on load & sanitize greeting
    const valid = parsed.filter(hasUserMessage).map((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.role === 'assistant' && m.content.includes("I'm currently running in mock mode")
          ? { ...m, content: GREETING_MESSAGE }
          : m
      ),
    }));
    // Purge existing empty-conversation entries from storage immediately
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    return valid;
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]): void {
  try {
    // Do not persist a conversation until it contains at least one user message
    const toSave = conversations.filter(hasUserMessage);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // storage full or unavailable — ignore
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? '…' : '');
  }
  return 'New Conversation';
}

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeId: string | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  togglePinConversation: (id: string) => void;
  updateMessages: (id: string, messages: ChatMessage[]) => void;
  setBackendConversationId: (id: string, backendId: string) => void;
  clearAllConversations: () => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Requirement 3: On every full page load, start a NEW empty conversation in the hero state.
  // Saved conversations stay in the sidebar history. Empty ones are purged on load.
  useEffect(() => {
    const loaded = loadConversations();
    const fresh = createConversation();
    setConversations([fresh, ...loaded]);
    setActiveId(fresh.id);
  }, []);

  // Persist only non-empty conversations whenever conversations change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  const newConversation = useCallback(() => {
    setConversations((prev) => {
      // If current active conversation is already empty, just keep it as the active one
      const currentActive = prev.find((c) => c.id === activeId);
      if (currentActive && !hasUserMessage(currentActive)) {
        return prev;
      }
      const fresh = createConversation();
      setActiveId(fresh.id);
      return [fresh, ...prev.filter((c) => hasUserMessage(c))];
    });
  }, [activeId]);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const toDelete = prev.find((c) => c.id === id);
        if (toDelete?.backendId) {
          deleteBackendConversation(toDelete.backendId);
        }
        const filtered = prev.filter((c) => c.id !== id);
        if (filtered.length === 0) {
          const conv = createConversation();
          setActiveId(conv.id);
          return [conv];
        }
        if (id === activeId) {
          setActiveId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeId]
  );

  const renameConversation = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c))
    );
  }, []);

  const togglePinConversation = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const updateMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              messages,
              title: deriveTitle(messages),
              updatedAt: Date.now(),
            }
          : c
      )
    );
  }, []);

  const setBackendConversationId = useCallback((id: string, backendId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, backendId, updatedAt: Date.now() } : c))
    );
  }, []);

  const clearAllConversations = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    const fresh = createConversation();
    setConversations([fresh]);
    setActiveId(fresh.id);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeConversation,
    activeId,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation,
    updateMessages,
    setBackendConversationId,
    clearAllConversations,
  };
}
