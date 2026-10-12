/**
 * API client for the JARVIS backend.
 * Connects to Python FastAPI on port 8000 via Vite proxy (/api) or full URL.
 */

export interface FormattedError {
  friendly: string;
  details?: string;
}

export class ApiError extends Error {
  status?: number;
  isTimeout?: boolean;
  isOffline?: boolean;
  rawDetails?: string;

  constructor(
    message: string,
    options?: { status?: number; isTimeout?: boolean; isOffline?: boolean; rawDetails?: string }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.isTimeout = options?.isTimeout;
    this.isOffline = options?.isOffline;
    this.rawDetails = options?.rawDetails || message;
  }
}

/**
 * Maps raw or technical error details into clean, friendly user-facing messages.
 * Logs raw details to console and preserves raw details for the collapsible UI element.
 */
export function formatFriendlyError(error: any): FormattedError {
  if (!error) {
    return { friendly: 'Something went wrong.' };
  }

  let raw = '';
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof ApiError && error.rawDetails) {
    raw = error.rawDetails;
  } else if (error?.rawDetails) {
    raw = error.rawDetails;
  } else if (error?.message) {
    raw = error.message;
  } else {
    try {
      raw = JSON.stringify(error);
    } catch {
      raw = String(error);
    }
  }

  // Always log unformatted raw message to developer console
  console.error('[JARVIS Error]:', raw);

  const status = error?.status;
  const isOffline = error?.isOffline;
  const lower = raw.toLowerCase();

  // 1) 401 / Invalid API Key
  if (
    status === 401 ||
    lower.includes('401') ||
    lower.includes('api key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('groq_api_key')
  ) {
    return {
      friendly: "Voice service isn't configured (check the server's API key)",
      details: raw !== "Voice service isn't configured (check the server's API key)" ? raw : undefined,
    };
  }

  // 2) 429 / Quota / Rate limit
  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('busy')
  ) {
    return {
      friendly: 'The service is busy or out of quota. Try again shortly',
      details: raw !== 'The service is busy or out of quota. Try again shortly' ? raw : undefined,
    };
  }

  // 3) 503 / Database offline
  if (
    status === 503 ||
    lower.includes('503') ||
    lower.includes('database offline') ||
    lower.includes('database error')
  ) {
    return {
      friendly: 'The database is offline',
      details: raw !== 'The database is offline' ? raw : undefined,
    };
  }

  // 4) Network failure / Can't reach JARVIS core
  if (
    isOffline ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('unable to connect') ||
    lower.includes('network') ||
    lower.includes("can't reach jarvis core")
  ) {
    return {
      friendly: "Can't reach JARVIS core",
      details: raw !== "Can't reach JARVIS core" ? raw : undefined,
    };
  }

  // 5) Empty transcript
  if (
    lower.includes("didn't catch that") ||
    lower.includes('empty transcript') ||
    lower.includes('no speech detected')
  ) {
    return {
      friendly: "I didn't catch that. Try again?",
      details: raw !== "I didn't catch that. Try again?" ? raw : undefined,
    };
  }

  // Default clean message for other errors
  return {
    friendly: 'Something went wrong while processing your request.',
    details: raw,
  };
}

export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

export function getApiUrl(path: string): string {
  const rawBase = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
  let endpoint = path.replace(/^\/+/, '');

  if (!rawBase.endsWith('/api') && !endpoint.startsWith('api/')) {
    endpoint = `api/${endpoint}`;
  } else if (rawBase.endsWith('/api') && endpoint.startsWith('api/')) {
    endpoint = endpoint.replace(/^api\//, '');
  }

  return `${rawBase}/${endpoint}`;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('The service is busy or out of quota. Try again shortly', {
        isTimeout: true,
        rawDetails: `Request timed out after ${timeoutMs / 1000}s`,
      });
    }
    throw new ApiError("Can't reach JARVIS core", {
      isOffline: true,
      rawDetails: err.message || 'Network connection failed',
    });
  }
}

/**
 * Health check endpoint.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const url = getApiUrl('health');
    const res = await fetchWithTimeout(url, { method: 'GET' }, 5000);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.status === 'ONLINE';
  } catch {
    return false;
  }
}

export interface ChatResponse {
  conversation_id: string | null;
  response: string;
  audio: string | null;
}

/**
 * Send chat message to /api/jarvis/chat
 * Always sends web_mode: true
 */
export async function chatWithJarvis(
  message: string,
  conversationId?: string | null
): Promise<ChatResponse> {
  const url = getApiUrl('jarvis/chat');

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
        web_mode: true,
      }),
    },
    30000
  );

  if (!response.ok) {
    let rawDetail = `Backend returned status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (typeof errorJson?.detail === 'string') {
        rawDetail = errorJson.detail;
      } else if (Array.isArray(errorJson?.detail) && errorJson.detail[0]?.msg) {
        rawDetail = errorJson.detail[0].msg;
      } else {
        rawDetail = JSON.stringify(errorJson);
      }
    } catch {
      // ignore json parse error
    }
    const { friendly, details } = formatFriendlyError({
      status: response.status,
      rawDetails: rawDetail,
      message: rawDetail,
    });
    throw new ApiError(friendly, { status: response.status, rawDetails: details || rawDetail });
  }

  const data = await response.json();
  return {
    conversation_id: data.conversation_id || null,
    response: data.response || '',
    audio: data.audio || null,
  };
}

export interface TranscribeResponse {
  text: string;
}

/**
 * Upload voice audio to /api/jarvis/transcribe
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
  const url = getApiUrl('jarvis/transcribe');
  const formData = new FormData();
  formData.append('file', audioBlob, 'web_recording.webm');

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      body: formData,
    },
    30000
  );

  if (!response.ok) {
    let rawDetail = 'Speech recognition failed on backend';
    try {
      const errorJson = await response.json();
      if (typeof errorJson?.detail === 'string') {
        rawDetail = errorJson.detail;
      } else {
        rawDetail = JSON.stringify(errorJson);
      }
    } catch {
      // ignore
    }
    const { friendly, details } = formatFriendlyError({
      status: response.status,
      rawDetails: rawDetail,
      message: rawDetail,
    });
    throw new ApiError(friendly, { status: response.status, rawDetails: details || rawDetail });
  }

  const data = await response.json();
  return {
    text: (data.text || '').trim(),
  };
}

/**
 * Delete conversation on the backend
 */
export async function deleteBackendConversation(conversationId: string): Promise<void> {
  if (!conversationId) return;
  try {
    const url = getApiUrl(`conversations/${conversationId}`);
    await fetch(url, { method: 'DELETE' });
  } catch (e) {
    console.warn(`Failed to delete conversation ${conversationId} on backend:`, e);
  }
}
