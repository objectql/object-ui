/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage as OuiChatMessage } from '@object-ui/types';
import { useChat } from '@ai-sdk/react';
import { generateUniqueId } from './utils';

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
  initialMessages?: OuiChatMessage[];
  /**
   * Conversation ID for multi-turn context.
   */
  conversationId?: string;
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

  // Convert OUI messages to vercel/ai format for initialMessages
  const aiInitialMessages = normalizeMessages(initialMessages).map(msg => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
    content: msg.content,
  }));

  // --- @ai-sdk/react useChat (always called, but only active in API mode) ---
  const chatResult = useChat({
    api: isApiMode ? api! : '/noop',
    initialMessages: isApiMode && aiInitialMessages.length > 0 ? aiInitialMessages : undefined,
    headers: isApiMode ? {
      ...headers,
      ...(conversationId ? { 'x-conversation-id': conversationId } : {}),
    } : undefined,
    body: isApiMode ? {
      ...body,
      ...(model ? { model } : {}),
      ...(systemPrompt ? { systemPrompt } : {}),
      ...(streamingEnabled !== undefined ? { stream: streamingEnabled } : {}),
    } : undefined,
    maxToolRoundtrips: isApiMode ? maxToolRoundtrips : undefined,
    onError: isApiMode ? (err: Error) => { onError?.(err); } : undefined,
  });

  // --- Local/legacy mode state ---
  const [localMessages, setLocalMessages] = useState<OuiChatMessage[]>(
    () => normalizeMessages(initialMessages)
  );
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localInput, setLocalInput] = useState('');
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
      isLoading,
      error,
      input,
      setInput,
      handleInputChange,
      append,
      stop,
      reload,
      setMessages,
    } = chatResult;

    // Convert vercel/ai messages back to OUI ChatMessage format
    const messages: OuiChatMessage[] = aiMessages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      toolInvocations: msg.toolInvocations,
      streaming: isLoading && msg.id === aiMessages[aiMessages.length - 1]?.id && msg.role === 'assistant',
    }));

    const sendMessage = (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const newMsg = { role: 'user' as const, content: trimmed };

      // Construct the next messages list for the onSend callback,
      // ensuring it includes the newly sent user message.
      const nextMessages: OuiChatMessage[] = [
        ...messages,
        {
          id: generateUniqueId('msg'),
          role: 'user',
          content: trimmed,
        },
      ];

      append(newMsg);
      onSend?.(trimmed, nextMessages);
    };

    const clear = () => {
      setMessages([]);
    };

    return {
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      reload,
      clear,
      isApiMode: true,
      input,
      setInput,
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
