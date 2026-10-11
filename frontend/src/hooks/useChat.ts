import { useCallback, useState } from 'react';

import type { ChatMessage } from '@/types';
import { getMockResponse } from '@/lib/mockAssistant';
import { chatWithJarvis, isMockMode, formatFriendlyError, type FormattedError } from '@/lib/api';

interface UseChatOptions {
  backendConversationId?: string | null;
  onBackendIdReceived?: (id: string) => void;
  onAssistantReply?: (reply: { text: string; audio: string | null; messageId: string }) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isThinking: boolean;
  error: FormattedError | null;
  lastFailedMessage: string | null;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  clearError: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(
  initialMessages: ChatMessage[] = [],
  options?: UseChatOptions
): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<FormattedError | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError({ friendly: 'Please enter a message before sending.' });
        return;
      }

      setError(null);
      setLastFailedMessage(null);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsThinking(true);

      try {
        let responseText = '';
        let audio: string | null = null;
        let backendId: string | null = null;

        if (isMockMode()) {
          responseText = await getMockResponse(trimmed);
        } else {
          const res = await chatWithJarvis(trimmed, options?.backendConversationId);
          responseText = res.response;
          audio = res.audio;
          backendId = res.conversation_id;

          if (backendId && options?.onBackendIdReceived) {
            options.onBackendIdReceived(backendId);
          }
        }

        const assistantMsgId = generateId();
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          audio: audio,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Notify callback about new assistant reply for audio playback
        if (options?.onAssistantReply) {
          options.onAssistantReply({
            text: responseText,
            audio: audio,
            messageId: assistantMsgId,
          });
        }
      } catch (err: any) {
        setLastFailedMessage(trimmed);
        const formatted = formatFriendlyError(err);
        setError(formatted);
      } finally {
        setIsThinking(false);
      }
    },
    [options]
  );

  const retry = useCallback(async () => {
    if (lastFailedMessage) {
      await sendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, sendMessage]);

  const clearError = useCallback(() => {
    setError(null);
    setLastFailedMessage(null);
  }, []);

  return {
    messages,
    isThinking,
    error,
    lastFailedMessage,
    sendMessage,
    retry,
    clearError,
    setMessages,
  };
}
