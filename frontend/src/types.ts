export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  audio?: string | null;
}

export interface Conversation {
  id: string;
  backendId?: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}
