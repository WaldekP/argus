/**
 * Klient Edge Function `argus-assistant` (asystent AI polityka, zakładka
 * Asystent). Rozmowy są trwałe: wątki i wiadomości żyją w bazie
 * (assistant_conversations, assistant_messages), a odpowiedź na `ask`
 * przychodzi strumieniem SSE.
 *
 * Streaming idzie przez `expo/fetch`, bo wbudowany fetch React Native nie
 * daje `response.body` na iOS i Androidzie (na webie oba działają tak samo).
 *
 * Projekt: docs/superpowers/specs/2026-07-27-asystent-argus-design.md
 */

import { fetch as expoFetch } from 'expo/fetch';

import {
  edgeClient,
  edgeEndpoint,
  GENERIC_ERROR,
  LONG_TIMEOUT_MS,
  TIMEOUT_ERROR,
} from '@/lib/api/client';

export type AssistantRole = 'user' | 'assistant';

/** Jeden wpis rozmowy. */
export type AssistantMessage = {
  role: AssistantRole;
  content: string;
};

/** Wątek na liście historii rozmów. */
export type AssistantConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type AssistantOperation = 'list_conversations' | 'get_conversation';

const call = edgeClient<AssistantOperation>('argus-assistant');

/** Historia rozmów tenanta, od ostatnio aktywnej. */
export function listConversations(): Promise<{ conversations: AssistantConversation[] }> {
  return call('list_conversations');
}

/** Jedna rozmowa z kompletem wiadomości, do wczytania z historii. */
export function getConversation(conversationId: string): Promise<{
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}> {
  return call('get_conversation', { conversation_id: conversationId });
}

export type AssistantStreamHandlers = {
  /** Id wątku (nowego albo kontynuowanego), przychodzi przed pierwszym tekstem. */
  onMeta: (conversationId: string) => void;
  /** Kolejny fragment odpowiedzi. */
  onDelta: (text: string) => void;
};

type SseEvent = {
  type?: string;
  conversation_id?: string;
  text?: string;
  used_brief?: boolean;
  message?: string;
};

/**
 * Zadaj pytanie i strumieniuj odpowiedź. `conversationId` null zakłada nową
 * rozmowę (serwer zwraca jej id przez `onMeta`). Historię wątku dokleja
 * serwer z bazy, klient nic nie wysyła poza pytaniem.
 */
export async function streamAssistantAnswer(
  question: string,
  conversationId: string | null,
  handlers: AssistantStreamHandlers
): Promise<{ usedBrief: boolean }> {
  const { url, headers } = await edgeEndpoint('argus-assistant');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LONG_TIMEOUT_MS);

  try {
    const response = await expoFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation: 'ask',
        question,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
      signal: controller.signal,
    });

    // Błąd przed startem strumienia przychodzi zwykłą kopertą JSON.
    if (!response.ok || !response.body) {
      let message = GENERIC_ERROR;
      try {
        const body = (await response.json()) as { error?: string };
        if (typeof body?.error === 'string' && body.error) {
          message = body.error;
        }
      } catch {
        // zostaje komunikat ogólny
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    let usedBrief = false;

    const handleEvent = (event: SseEvent) => {
      if (event.type === 'meta' && typeof event.conversation_id === 'string') {
        handlers.onMeta(event.conversation_id);
      } else if (event.type === 'delta' && typeof event.text === 'string') {
        handlers.onDelta(event.text);
      } else if (event.type === 'done') {
        finished = true;
        usedBrief = Boolean(event.used_brief);
      } else if (event.type === 'error') {
        throw new Error(
          typeof event.message === 'string' && event.message ? event.message : GENERIC_ERROR
        );
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator >= 0) {
        const raw = buffer.slice(0, separator).trim();
        buffer = buffer.slice(separator + 2);
        if (raw.startsWith('data:')) {
          handleEvent(JSON.parse(raw.slice(5).trim()) as SseEvent);
        }
        separator = buffer.indexOf('\n\n');
      }
    }

    // Strumień urwany bez zdarzenia `done` to błąd, nie pełna odpowiedź.
    if (!finished) {
      throw new Error(GENERIC_ERROR);
    }
    return { usedBrief };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
