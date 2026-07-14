/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage as OuiChatMessage } from '@object-ui/types';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { generateUniqueId } from './utils';
import { uiMessagesToChatMessages } from './mapMessages';

/**
 * Window event the AI usage indicator (ADR-0057 #8) listens for to refetch its
 * quota headroom. A completed turn consumes tokens and a rejected send (429) means
 * the wall was hit — both change what the usage ring should show. Emitting a window
 * event keeps the indicator (in `@object-ui/app-shell`) decoupled from this chat
 * engine: no callback has to be threaded through `ChatPane`.
 */
export const AI_USAGE_REFRESH_EVENT = 'objectui:ai-usage-refresh';

/** Fire-and-forget nudge for the usage indicator. SSR-safe; never throws. */
export function emitAiUsageRefresh(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(AI_USAGE_REFRESH_EVENT));
  } catch {
    /* CustomEvent unavailable (very old env) — the indicator just polls on its own cadence */
  }
}

/** An error from {@link sendAwareFetch}: a chat POST rejected before streaming. */
export interface SendFailure extends Error {
  /** HTTP status when a response was received (e.g. 429); absent on network errors. */
  status?: number;
  /** Always true — the request never produced a reply, so nothing was sent. */
  notSent?: boolean;
}

/**
 * `fetch` for the chat transport that turns a REJECTED request into a tagged
 * error. The Vercel AI SDK otherwise hands `onError` a bare Error whose message
 * is the response body and DROPS the HTTP status — so the UI can't tell a 429
 * rate-limit (nothing streamed: restore the input, say "slow down") apart from a
 * mid-stream transport drop (the turn may have completed server-side: reconcile
 * it, don't re-run). We tag:
 *   - `notSent: true` whenever the POST was rejected (non-2xx) or the network
 *     failed, i.e. no assistant tokens ever arrived;
 *   - `status` with the HTTP code when there was a response.
 * The body text is preserved as the Error message so `parseAiQuotaError` (the
 * cloud quota guardrail's friendly JSON) keeps working. Exported for tests.
 */
export async function sendAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    // Network failure: the request never reached the server (or no response came
    // back), so the message was not sent.
    const e: SendFailure = err instanceof Error ? err : new Error(String(err));
    e.notSent = true;
    throw e;
  }
  if (!response.ok) {
    // Non-2xx (429 rate-limit, 5xx, …): rejected before any reply streamed.
    let body = '';
    try {
      body = await response.text();
    } catch {
      /* body unavailable — fall back to status text */
    }
    const e: SendFailure = new Error(
      body || response.statusText || `Request failed with status ${response.status}`,
    );
    e.status = response.status;
    e.notSent = true;
    throw e;
  }
  return response;
}

/**
 * Stamp a stable per-turn idempotency key (ADR-0013 D1) onto the outgoing
 * request body, derived from the id of the user message that triggered the
 * turn. On Retry the AI SDK re-sends the SAME triggering user message
 * (regenerate-message keeps the trailing user turn), so its id — and thus the
 * turnId — is identical across the original send and the retry. The server
 * dedups the inbound user message by (conversationId, turnId) and
 * short-circuits a completed turn instead of re-running tools / replanning.
 *
 * Used as `DefaultChatTransport.prepareSendMessagesRequest`. IMPORTANT: when
 * that hook returns a `body`, the SDK sends it VERBATIM — the default body
 * (`id`/`messages`/`trigger`/`messageId`) is NOT merged in. So we must
 * reconstruct exactly what the default transport would send and only ADD
 * `turnId`; otherwise the server receives no `messages` array (400).
 *
 * Exported for unit testing.
 */
export function withTurnId(req: {
  id?: string;
  body?: Record<string, unknown>;
  messages: Array<{ id: string; role: string }>;
  trigger?: unknown;
  messageId?: string;
}): { body: Record<string, unknown> } {
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
  return {
    body: {
      // Replicate the transport's default body (see HttpChatTransport.sendMessages)…
      ...(req.body ?? {}),
      id: req.id,
      messages: req.messages,
      trigger: req.trigger,
      messageId: req.messageId,
      // …then add the per-turn idempotency key.
      ...(lastUser ? { turnId: lastUser.id } : {}),
    },
  };
}

/**
 * ADR-0057 P4 / cloud#817 — merge a handed-off `ask` conversation id into a
 * request body's `context` (the object the agent chat route reads as
 * `AgentChatContext`), returning a NEW body so the cached transport body is
 * never mutated. The build agent redeems `context.parentConversationId` on its
 * first turn to seed the ask thread as context. Exported for unit testing.
 */
export function withHandoffContext(
  body: Record<string, unknown>,
  parentConversationId: string,
): Record<string, unknown> {
  const ctx = (body.context ?? {}) as Record<string, unknown>;
  return { ...body, context: { ...ctx, parentConversationId } };
}

type InitialMessage = OuiChatMessage & {
  parts?: Array<Record<string, unknown>>;
  reasoning?: string;
};

/**
 * Configuration options for useObjectChat hook.
 */
export interface UseObjectChatOptions {
  /**
   * Backend API endpoint for streaming chat.
   * When provided, uses @ai-sdk/react useChat for SSE streaming.
   * When absent, operates in local/legacy mode.
   */
  api?: string;
  /**
   * Initial messages to populate the chat.
   */
  initialMessages?: InitialMessage[];
  /**
   * Conversation ID for multi-turn context.
   */
  conversationId?: string;
  /**
   * ADR-0057 P4 / cloud#817 — id of the source `ask` conversation handed off to
   * the Builder ("Open in Builder →"). Sent as `context.parentConversationId` on
   * the FIRST turn only (consumed once, then cleared), so the build agent starts
   * with the ask thread as context; the backend redeems it and never re-reads it
   * on later turns (client owns history from there).
   */
  parentConversationId?: string;
  /**
   * System prompt for the assistant.
   */
  systemPrompt?: string;
  /**
   * AI model identifier.
   */
  model?: string;
  /**
   * Whether streaming is enabled.
   * @default true
   */
  streamingEnabled?: boolean;
  /**
   * Additional headers to send with API requests.
   */
  headers?: Record<string, string>;
  /**
   * Additional body parameters for each API request.
   */
  body?: Record<string, unknown>;
  /**
   * Maximum tool-calling round-trips per message.
   * @default 5
   */
  maxToolRoundtrips?: number;
  /**
   * Error callback.
   */
  onError?: (error: Error) => void;
  /**
   * Show timestamps on messages.
   */
  showTimestamp?: boolean;

  // --- Legacy/demo mode options ---
  /**
   * Enable local auto-response (legacy/demo mode). Ignored when `api` is set.
   */
  autoResponse?: boolean;
  /**
   * Auto-response text for legacy/demo mode.
   */
  autoResponseText?: string;
  /**
   * Auto-response delay in ms for legacy/demo mode.
   * @default 1000
   */
  autoResponseDelay?: number;
  /**
   * External send callback (fires for both modes).
   */
  onSend?: (content: string, messages: OuiChatMessage[]) => void;
}

/**
 * Return type of useObjectChat.
 */
export interface UseObjectChatReturn {
  /** Current chat messages */
  messages: OuiChatMessage[];
  /** Whether the assistant is currently generating a response */
  isLoading: boolean;
  /** Current error, if any */
  error: Error | undefined;
  /** Send a new user message */
  sendMessage: (content: string, files?: File[]) => void;
  /** Stop the current streaming response */
  stop: () => void;
  /** Reload / retry the last assistant message */
  reload: () => void;
  /** Clear all messages */
  clear: () => void;
  /** ADR-0013 D2: re-hydrate the thread (API mode only); undefined in local mode. */
  setMessages?: (messages: unknown[]) => void;
  /** Whether the hook is operating in API (streaming) mode */
  isApiMode: boolean;
  /** Input value (controlled by the hook for API mode) */
  input: string;
  /** Set input value */
  setInput: (value: string) => void;
  /** Handle input change event */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Normalize an OUI ChatMessage[] from schema into internal format.
 */
function normalizeMessages(msgs?: OuiChatMessage[]): OuiChatMessage[] {
  return (msgs ?? []).map((msg, idx) => ({
    id: msg.id || `msg-${idx}`,
    role: msg.role || 'user',
    content: msg.content || '',
    timestamp: typeof msg.timestamp === 'string'
      ? msg.timestamp
      : (msg.timestamp instanceof Date ? msg.timestamp.toISOString() : undefined),
    metadata: msg.metadata,
    streaming: msg.streaming,
    toolInvocations: msg.toolInvocations,
  }));
}

/**
 * useObjectChat – Composable hook for ObjectUI Chatbot.
 *
 * When `api` is provided, delegates to @ai-sdk/react's useChat for
 * SSE streaming, tool-calling, and production-grade chat.
 *
 * When `api` is absent, operates in local/legacy mode with optional
 * auto-response for demos and playground use.
 *
 * The mode is locked on first render to satisfy the Rules of Hooks.
 * If `api` changes after mount, the mode will NOT switch dynamically.
 */
export function useObjectChat(options: UseObjectChatOptions = {}): UseObjectChatReturn {
  const {
    api,
    initialMessages,
    conversationId,
    parentConversationId,
    systemPrompt,
    model,
    streamingEnabled = true,
    headers,
    body,
    maxToolRoundtrips = 5,
    onError,
    showTimestamp,
    autoResponse,
    autoResponseText,
    autoResponseDelay = 1000,
    onSend,
  } = options;

  // Lock the mode on first render to satisfy the Rules of Hooks.
  // Conditional hook calls would crash if `api` toggled between renders.
  const modeRef = useRef<'api' | 'local'>(api ? 'api' : 'local');
  const isApiMode = modeRef.current === 'api';

  // Convert OUI messages to vercel/ai v3 UIMessage format for initialMessages
  const aiInitialMessages = useMemo(
    () =>
      (initialMessages ?? []).map((msg, idx) => {
        if (Array.isArray(msg.parts) && msg.parts.length > 0) {
          return {
            id: msg.id || `msg-${idx}`,
            role: (msg.role || 'user') as 'user' | 'assistant' | 'system',
            parts: msg.parts,
          };
        }
        const normalized = normalizeMessages([msg])[0];
        const parts: Array<Record<string, unknown>> = [];
        if (normalized.content) {
          parts.push({ type: 'text', text: normalized.content });
        }
        if (msg.reasoning) {
          parts.push({ type: 'reasoning', text: msg.reasoning });
        }
        for (const tool of normalized.toolInvocations ?? []) {
          parts.push({
            type: `tool-${tool.toolName}`,
            toolCallId: tool.toolCallId,
            toolName: tool.toolName,
            input: tool.args,
            output: tool.result,
            errorText: tool.errorText,
            state: tool.state,
          });
        }
        return {
          id: normalized.id || `msg-${idx}`,
          role: normalized.role as 'user' | 'assistant' | 'system',
          parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
        };
      }),
    // initialMessages is intentionally referenced once on first render only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ADR-0028: the AI SDK caches the transport from the first render, so a
  // mid-session model switch in the picker would never reach the static
  // `body.model` below. Keep the live model in a ref and inject it per-send in
  // prepareSendMessagesRequest (the hook closes over this stable ref).
  const modelRef = useRef(model);
  modelRef.current = model;

  // ADR-0057 P4 / cloud#817 — the handed-off `ask` conversation id, sent as
  // `context.parentConversationId` on the handoff turn: armed here, consumed once
  // in prepare below, then cleared so normal follow-ups don't re-carry it. The
  // backend redeems it into the build turn's context.
  //
  // Re-arm on every falsy→truthy transition of the prop (not on a new VALUE): a
  // SECOND "Open in Builder →" resumes the same singleton build conversation and
  // re-supplies the SAME ask id (the ask thread is a singleton too), so the
  // fresh-arrival signal is the transition, not a changed value. The URL-mirror
  // strips the param after each handoff send, giving the truthy→falsy edge — so
  // a later handoff arms again and its latest ask context re-carries (#2).
  const parentConvRef = useRef(parentConversationId);
  const prevParentConvPropRef = useRef(parentConversationId);
  useEffect(() => {
    const prev = prevParentConvPropRef.current;
    prevParentConvPropRef.current = parentConversationId;
    if (parentConversationId && !prev) parentConvRef.current = parentConversationId;
  }, [parentConversationId]);

  // Build a transport for API mode that posts to the configured endpoint and
  // forwards conversation/system/model metadata in the request body.
  // Note: conversationId is sent in the body (not a header) to avoid CORS
  // preflight issues with custom headers in cross-origin setups.
  const transport = useMemo(() => {
    if (!isApiMode) return undefined;
    return new DefaultChatTransport({
      api: api!,
      // Tag rejected requests (429 rate-limit / 5xx / network) with status +
      // `notSent` so the composer can restore the input and show a clear error
      // instead of silently dropping the message (see sendAwareFetch).
      fetch: sendAwareFetch,
      headers: { ...headers },
      body: {
        ...body,
        ...(conversationId ? { conversationId } : {}),
        ...(model ? { model } : {}),
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(streamingEnabled !== undefined ? { stream: streamingEnabled } : {}),
      },
      // Stamp a stable per-turn idempotency key (ADR-0013 D1). See withTurnId —
      // it reconstructs the full default body (incl. messages) + adds turnId.
      prepareSendMessagesRequest: ({ id, body: reqBody, messages, trigger, messageId }) => {
        const req = withTurnId({ id, body: reqBody, messages, trigger, messageId });
        // ADR-0028: always send the CURRENTLY selected model (see modelRef above)
        // so a mid-session picker switch routes, despite the cached transport.
        if (modelRef.current) (req.body as Record<string, unknown>).model = modelRef.current;
        // ADR-0057 P4 / cloud#817 — carry the handed-off ask conversation id on
        // the FIRST turn only, nested under `context` (where the agent route
        // reads it). Then clear the ref so later turns don't re-send it (the
        // client owns history from there; re-sending re-injects the same block).
        if (parentConvRef.current) {
          req.body = withHandoffContext(req.body as Record<string, unknown>, parentConvRef.current);
          parentConvRef.current = undefined;
        }
        return req;
      },
    });
  }, [isApiMode, api, headers, body, model, systemPrompt, streamingEnabled, conversationId]);

  // --- @ai-sdk/react useChat (always called to satisfy Rules of Hooks, but only active in API mode) ---
  // Ref so `onError` (fired later, async) can reach the live setMessages/messages
  // without re-creating useChat — needed to roll back the optimistic user bubble.
  const chatRef = useRef<any>(null);
  const chatResult = useChat({
    transport,
    messages: isApiMode && aiInitialMessages.length > 0 ? (aiInitialMessages as any) : undefined,
    onError: isApiMode
      ? (err: Error) => {
          // The POST was rejected before any reply streamed (see sendAwareFetch).
          // The AI SDK keeps the optimistic user message; drop it so a never-sent
          // turn isn't left looking "sent". The composer restores the text and
          // surfaces the error; reconcile-on-error leaves it unsuppressed.
          if ((err as { notSent?: boolean }).notSent) {
            const chat = chatRef.current;
            const cur = chat?.messages as Array<{ role?: string }> | undefined;
            if (
              chat?.setMessages &&
              cur &&
              cur.length > 0 &&
              cur[cur.length - 1]?.role === 'user'
            ) {
              chat.setMessages(cur.slice(0, -1));
            }
            // A rejected send (esp. a 429 quota block) means the usage picture
            // changed — refresh the indicator so it reflects the wall the user
            // just hit (ADR-0057 #8).
            emitAiUsageRefresh();
          }
          onError?.(err);
        }
      : undefined,
  } as any);
  chatRef.current = chatResult;

  // ADR-0057 #8 — refresh the AI usage indicator when a turn finishes. On the
  // loading→ready edge (submitted/streaming → ready) the server has recorded the
  // turn's tokens, so the quota headroom just moved. Declared at top level (before
  // the API-mode early return) to satisfy the Rules of Hooks; inert in local mode
  // (status stays 'ready'). The 429/rejected-send case is handled in onError above.
  const prevChatStatusRef = useRef<string | undefined>(undefined);
  const chatStatus = (chatResult as { status?: string } | undefined)?.status;
  useEffect(() => {
    const prev = prevChatStatusRef.current;
    prevChatStatusRef.current = chatStatus;
    if ((prev === 'streaming' || prev === 'submitted') && chatStatus === 'ready') {
      emitAiUsageRefresh();
    }
  }, [chatStatus]);

  // --- Local/legacy mode state ---
  const [localMessages, setLocalMessages] = useState<OuiChatMessage[]>(
    () => normalizeMessages(initialMessages)
  );
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localInput, setLocalInput] = useState('');
  // API-mode input state (v3 useChat no longer manages it). Declared at top
  // level to satisfy the Rules of Hooks regardless of which mode is active.
  const [apiInput, setApiInput] = useState('');
  const autoResponseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup auto-response timer on unmount
  useEffect(() => {
    return () => {
      if (autoResponseTimerRef.current) {
        clearTimeout(autoResponseTimerRef.current);
        autoResponseTimerRef.current = null;
      }
    };
  }, []);

  // ---- API mode return ----
  if (isApiMode) {
    const {
      messages: aiMessages,
      status,
      error,
      sendMessage: aiSendMessage,
      regenerate,
      stop,
      setMessages,
    } = chatResult as any;

    const isLoading = status === 'submitted' || status === 'streaming';

    // Vercel AI SDK v6 UIMessage → OUI ChatMessage. The shared mapper handles
    // parts (text, reasoning, tool-*, source-*), streaming-cursor flagging,
    // and legacy `msg.toolInvocations` fallback. We splice `metadata` back in
    // because `ChatbotEnhanced.ChatMessage` doesn't carry it but OUI's does.
    const messages: OuiChatMessage[] = uiMessagesToChatMessages(aiMessages, {
      isStreaming: isLoading,
    }).map((m, idx) => ({
      ...m,
      metadata: (aiMessages[idx] as any)?.metadata,
    })) as OuiChatMessage[];

    // Local input state (v3 useChat no longer manages it) — declared above
    // at the top of the hook to comply with the Rules of Hooks.

    const sendMessage = useCallback(
      (content: string) => {
        const trimmed = content.trim();
        if (!trimmed) return;
        const nextMessages: OuiChatMessage[] = [
          ...messages,
          { id: generateUniqueId('msg'), role: 'user', content: trimmed },
        ];
        aiSendMessage({ text: trimmed });
        setApiInput('');
        onSend?.(trimmed, nextMessages);
      },
      [aiSendMessage, onSend, messages],
    );

    const clear = useCallback(() => {
      setMessages([]);
    }, [setMessages]);

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setApiInput(e.target.value);
      },
      [],
    );

    return {
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      reload: regenerate,
      clear,
      // ADR-0013 D2: expose the underlying useChat setMessages so the host can
      // re-hydrate the thread from the server after a stream-transport failure
      // (the reply may already be persisted server-side — reconcile, don't re-run).
      setMessages,
      isApiMode: true,
      input: apiInput,
      setInput: setApiInput,
      handleInputChange,
    };
  }

  // ---- Local/legacy mode return ----
  const localStop = useCallback(() => {
    if (autoResponseTimerRef.current) {
      clearTimeout(autoResponseTimerRef.current);
      autoResponseTimerRef.current = null;
    }
    setLocalIsLoading(false);
  }, []);

  const localSendMessage = useCallback((content: string) => {
    if (!content.trim()) return;

    const userMessage: OuiChatMessage = {
      id: generateUniqueId('msg'),
      role: 'user',
      content: content.trim(),
      timestamp: showTimestamp ? new Date().toLocaleTimeString() : undefined,
    };

    setLocalMessages(prev => {
      const updated = [...prev, userMessage];
      onSend?.(content.trim(), updated);
      return updated;
    });
    setLocalInput('');

    // Auto-response for demo/playground
    if (autoResponse) {
      setLocalIsLoading(true);
      autoResponseTimerRef.current = setTimeout(() => {
        const assistantMessage: OuiChatMessage = {
          id: generateUniqueId('msg'),
          role: 'assistant',
          content: autoResponseText || 'Thank you for your message!',
          timestamp: showTimestamp ? new Date().toLocaleTimeString() : undefined,
        };
        setLocalMessages(prev => [...prev, assistantMessage]);
        setLocalIsLoading(false);
      }, autoResponseDelay);
    }
  }, [showTimestamp, autoResponse, autoResponseText, autoResponseDelay, onSend]);

  const localReload = useCallback(() => {
    // In local mode, there's no server to retry — no-op
  }, []);

  const localClear = useCallback(() => {
    localStop();
    setLocalMessages([]);
  }, [localStop]);

  const localHandleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalInput(e.target.value);
  }, []);

  return {
    messages: localMessages,
    isLoading: localIsLoading,
    error: undefined,
    sendMessage: localSendMessage,
    stop: localStop,
    reload: localReload,
    clear: localClear,
    isApiMode: false,
    input: localInput,
    setInput: setLocalInput,
    handleInputChange: localHandleInputChange,
  };
}
