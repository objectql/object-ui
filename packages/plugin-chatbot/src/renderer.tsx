/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { ComponentRegistry, toDomProps } from '@object-ui/core';
import type { ChatbotSchema } from '@object-ui/types';
import { Chatbot } from './index';
import { ChatbotEnhanced } from './ChatbotEnhanced';
import type { ChatbotSurface } from './ChatbotEnhanced';
import { FloatingChatbot } from './FloatingChatbot';
import { useObjectChat } from './useObjectChat';
import type { ObjectChatMessage } from './useObjectChat';
import { toRuntimeMessages } from './chatMessageAdapter';

/**
 * Chatbot component for Object UI
 * 
 * @remarks
 * This component supports two modes:
 * 
 * **API Mode** (when `api` is set):
 * - Uses @ai-sdk/react for SSE streaming, tool-calling, and production-grade chat
 * - Connects to service-ai backend (e.g., /api/v1/ai/chat)
 * - Supports streaming, stop, reload, clear actions
 * - Schema fields: api, conversationId, systemPrompt, model, streamingEnabled, headers, requestBody, maxToolRoundtrips
 * 
 * **Legacy Mode** (when `api` is not set):
 * - Local auto-response for demo/playground use
 * - Schema fields: autoResponse, autoResponseText, autoResponseDelay
 * 
 * Both modes support the `onSend` callback:
 * - Signature: `onSend(content: string, messages: ObjectChatMessage[]): void`
 *   — the hook's own message shape (objectui#4424). A host callback that
 *   declares `@object-ui/types`' `ChatMessage[]` still type-checks; naming
 *   `ObjectChatMessage` is what lets it read the render-only keys.
 *
 * ## What reaches the host element (objectui#4431)
 *
 * These registrations receive far more than they author: `SchemaRenderer` hands
 * a registered component the node's own keys, the contents of its `props`
 * container, the ARIA it resolved, the evaluated `disabled` verdict, and the
 * host's trailing props — including the injected data-source ADAPTER. Both
 * registrations below used to destructure `schema` and `className` and forward
 * ALL of the rest into `<Chatbot>` / `<ChatbotEnhanced>`, whose props extend
 * `HTMLAttributes<HTMLDivElement>` and spread the leftovers onto their root
 * `<div>`. Measured: 14 non-DOM attributes each, `datasource="[object Object]"`
 * and a meaningless camelCase `arialabel` among them.
 *
 * Per objectui#4425 phase 2, the fix is the whitelist, not another deny-list:
 * everything is CONSUMED (read by name — the config off `schema`, the evaluated
 * `disabled` off the injected props) or WHITELISTED (`toDomProps`, which keeps
 * `id` / `className` / `role` / `tabIndex` / `aria-*` / `data-*` and drops the
 * rest, including the adapter). `chatbot-floating` below is untouched: its
 * content mounts through a portal and its root does not spread onto a host
 * element, which the sweep gate measured as clean.
 */
ComponentRegistry.register('chatbot',
  // The eleven keys this destructure's parameter type used to carry as an
  // anonymous inline intersection now live on `ChatbotSchema` itself
  // (objectui#6169, the #6172 family ruling: every component node has
  // exactly one named, importable authoring-face type) — each was
  // read-site-censused first; none were dead, so none took the ADR-0049
  // route. `schema` is that one type, referenceable and documentable from
  // outside this file for the first time. `disabled` here is the sibling,
  // host-EVALUATED prop (`SchemaRenderer`'s verdict on `schema.disabled` /
  // `schema.disabledOn`, forwarded as `hostDisabled`) — a different carrier
  // from the authored `schema.disabled` it is derived from; see the comment
  // on `disabled={hostDisabled || isLoading}` below.
  ({ schema, className, disabled: hostDisabled, ...props }: { schema: ChatbotSchema; className?: string; disabled?: boolean; [key: string]: any }) => {
    const {
      messages,
      isLoading,
      sendMessage,
    } = useObjectChat({
      api: schema.api,
      initialMessages: schema.messages,
      conversationId: schema.conversationId,
      systemPrompt: schema.systemPrompt,
      model: schema.model,
      streamingEnabled: schema.streamingEnabled,
      headers: schema.headers,
      body: schema.requestBody,
      maxToolRoundtrips: schema.maxToolRoundtrips,
      onError: schema.onError,
      showTimestamp: schema.showTimestamp,
      autoResponse: schema.autoResponse,
      autoResponseText: schema.autoResponseText,
      autoResponseDelay: schema.autoResponseDelay,
      onSend: schema.onSend,
    });

    const handleSendMessage = (content: string) => {
      sendMessage(content);
    };

    // The authoring -> runtime message seam (objectui#4399). `useObjectChat`
    // speaks the `@object-ui/types` (authoring) contract; `<Chatbot>` renders
    // the plugin's own. `toRuntimeMessages` names every narrowing decision
    // between them — see `chatMessageAdapter.ts`. This used to be `as any`,
    // which erased the intentional drift and the accidental drift alike.
    // Memoized so the runtime array's identity is exactly as stable as the
    // hook's own output (local mode holds `messages` in state).
    const runtimeMessages = useMemo(() => toRuntimeMessages(messages), [messages]);

    return (
      <Chatbot
        {...toDomProps(props)}
        messages={runtimeMessages}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        // `hostDisabled` is `SchemaRenderer`'s EVALUATED verdict on the node's
        // `disabled` / `disabledOn` (its `_disabled` flag, forwarded as a real
        // `disabled` prop). Consuming it — rather than re-reading the raw
        // `schema.disabled` beside it — keeps one carrier for one question
        // (AGENTS.md #0.1): the raw value may be an expression STRING, which is
        // truthy however it evaluates.
        disabled={hostDisabled || isLoading}
        showTimestamp={schema.showTimestamp}
        userAvatarUrl={schema.userAvatarUrl}
        userAvatarFallback={schema.userAvatarFallback}
        assistantAvatarUrl={schema.assistantAvatarUrl}
        assistantAvatarFallback={schema.assistantAvatarFallback}
        maxHeight={schema.maxHeight}
        className={className}
      />
    );
  },
  {
    namespace: 'plugin-chatbot',
    label: 'Chatbot',
    inputs: [
      { 
        name: 'messages', 
        type: 'array', 
        label: 'Initial Messages',
        description: 'Array of message objects with id, role, content, and optional timestamp'
      },
      { 
        name: 'placeholder', 
        type: 'string', 
        label: 'Input Placeholder',
        defaultValue: 'Type your message...'
      },
      { 
        name: 'showTimestamp', 
        type: 'boolean', 
        label: 'Show Timestamps',
        defaultValue: false
      },
      { 
        name: 'disabled', 
        type: 'boolean', 
        label: 'Disabled',
        defaultValue: false
      },
      { 
        name: 'userAvatarUrl', 
        type: 'string', 
        label: 'User Avatar URL',
        description: 'URL of the user avatar image'
      },
      { 
        name: 'userAvatarFallback', 
        type: 'string', 
        label: 'User Avatar Fallback',
        defaultValue: 'You',
        description: 'Fallback text shown when user avatar image is not available'
      },
      { 
        name: 'assistantAvatarUrl', 
        type: 'string', 
        label: 'Assistant Avatar URL',
        description: 'URL of the assistant avatar image'
      },
      { 
        name: 'assistantAvatarFallback', 
        type: 'string', 
        label: 'Assistant Avatar Fallback',
        defaultValue: 'AI',
        description: 'Fallback text shown when assistant avatar image is not available'
      },
      { 
        name: 'maxHeight', 
        type: 'string', 
        label: 'Max Height',
        defaultValue: '500px'
      },
      {
        name: 'api',
        type: 'string',
        label: 'API Endpoint',
        description: 'Backend SSE endpoint (e.g., /api/v1/ai/chat). When set, enables streaming AI mode.'
      },
      {
        name: 'conversationId',
        type: 'string',
        label: 'Conversation ID',
        description: 'Multi-turn conversation identifier'
      },
      {
        name: 'systemPrompt',
        type: 'string',
        label: 'System Prompt',
        description: 'System prompt to configure assistant behavior'
      },
      {
        name: 'model',
        type: 'string',
        label: 'AI Model',
        description: 'AI model identifier (e.g., gpt-4o)'
      },
      {
        name: 'streamingEnabled',
        type: 'boolean',
        label: 'Enable Streaming',
        defaultValue: true
      },
      { 
        name: 'autoResponse', 
        type: 'boolean', 
        label: 'Enable Auto Response (Demo)',
        defaultValue: false,
        description: 'Automatically send a response after user message (for demo purposes, ignored when API is set)'
      },
      { 
        name: 'autoResponseText', 
        type: 'string', 
        label: 'Auto Response Text',
        defaultValue: 'Thank you for your message!'
      },
      { 
        name: 'autoResponseDelay', 
        type: 'number', 
        label: 'Auto Response Delay (ms)',
        defaultValue: 1000
      },
      { 
        name: 'className', 
        type: 'string', 
        label: 'CSS Class'
      }
    ],
    defaultProps: {
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        }
      ],
      placeholder: 'Type your message...',
      showTimestamp: false,
      disabled: false,
      userAvatarFallback: 'You',
      assistantAvatarFallback: 'AI',
      maxHeight: '500px',
      autoResponse: true,
      autoResponseText: 'Thank you for your message! This is an automated response.',
      autoResponseDelay: 1000,
      className: 'w-full max-w-2xl'
    }
  }
);

// Register Enhanced Chatbot
ComponentRegistry.register('chatbot-enhanced',
  ({ schema, className, disabled: hostDisabled, ...props }: { schema: ChatbotSchema & {
    enableMarkdown?: boolean; 
    enableFileUpload?: boolean;
    /**
     * Visual chrome for the chat surface (objectui#6687, maintainer ruling
     * 2026-08-29). `card` keeps the embeddable bordered panel; `plain` removes
     * the panel chrome for a full-page chat workspace. Declared here, on the
     * registration that actually renders `<ChatbotEnhanced>`, because that is
     * the only one with a `surface` prop to forward it to — `chatbot` and
     * `chatbot-floating` render different components and do not gain the key.
     * Typed by importing `ChatbotSurface` rather than re-spelling the union:
     * one contract, not two dialects (AGENTS.md #0.1).
     */
    surface?: ChatbotSurface;
    showTimestamp?: boolean;
    disabled?: boolean;
    userAvatarUrl?: string;
    userAvatarFallback?: string;
    assistantAvatarUrl?: string;
    assistantAvatarFallback?: string;
    maxHeight?: string;
    autoResponse?: boolean;
    autoResponseText?: string;
    autoResponseDelay?: number;
    onSend?: (content: string, messages: ObjectChatMessage[]) => void;
    onClear?: () => void;
  }; className?: string; disabled?: boolean; [key: string]: any }) => {
    const {
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      reload,
      clear,
      isApiMode,
    } = useObjectChat({
      api: schema.api,
      initialMessages: schema.messages,
      conversationId: schema.conversationId,
      systemPrompt: schema.systemPrompt,
      model: schema.model,
      streamingEnabled: schema.streamingEnabled,
      headers: schema.headers,
      body: schema.requestBody,
      maxToolRoundtrips: schema.maxToolRoundtrips,
      onError: schema.onError,
      showTimestamp: schema.showTimestamp,
      autoResponse: schema.autoResponse,
      autoResponseText: schema.autoResponseText,
      autoResponseDelay: schema.autoResponseDelay,
      onSend: schema.onSend,
    });

    const handleSendMessage = (content: string, files?: File[]) => {
      sendMessage(content, files);
    };

    const handleClear = () => {
      clear();
      schema.onClear?.();
    };

    // See the `chatbot` renderer above — one seam, one adapter (objectui#4399).
    const runtimeMessages = useMemo(() => toRuntimeMessages(messages), [messages]);

    return (
      <ChatbotEnhanced
        {...toDomProps(props)}
        messages={runtimeMessages}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        onClear={handleClear}
        onStop={isApiMode && isLoading ? stop : undefined}
        onReload={isApiMode ? reload : undefined}
        // The evaluated verdict, not the raw schema value — see the `chatbot`
        // registration above. `isLoading` travels on its own prop here.
        disabled={hostDisabled}
        isLoading={isLoading}
        error={error}
        showTimestamp={schema.showTimestamp}
        userAvatarUrl={schema.userAvatarUrl}
        userAvatarFallback={schema.userAvatarFallback}
        assistantAvatarUrl={schema.assistantAvatarUrl}
        assistantAvatarFallback={schema.assistantAvatarFallback}
        maxHeight={schema.maxHeight}
        enableMarkdown={schema.enableMarkdown ?? true}
        enableFileUpload={schema.enableFileUpload ?? false}
        processVisibility={schema.processVisibility}
        // Passed through undefined when unauthored, so `<ChatbotEnhanced>`'s own
        // `surface = 'card'` default keeps applying — the absent case is
        // unchanged by this wiring (objectui#6687).
        surface={schema.surface}
        className={className}
      />
    );
  },
  {
    namespace: 'plugin-chatbot',
    label: 'Chatbot (Enhanced)',
    inputs: [
      { name: 'messages', type: 'array', label: 'Initial Messages' },
      { name: 'placeholder', type: 'string', label: 'Input Placeholder', defaultValue: 'Type your message...' },
      { name: 'showTimestamp', type: 'boolean', label: 'Show Timestamps', defaultValue: false },
      { name: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false },
      { name: 'enableMarkdown', type: 'boolean', label: 'Enable Markdown', defaultValue: true },
      { name: 'enableFileUpload', type: 'boolean', label: 'Enable File Upload', defaultValue: false },
      { name: 'processVisibility', type: 'enum', label: 'Agent Process Visibility', defaultValue: 'summary' },
      { name: 'surface', type: 'enum', label: 'Surface Chrome', defaultValue: 'card', description: "'card' bordered panel, or 'plain' frameless full-page workspace" },
      { name: 'userAvatarUrl', type: 'string', label: 'User Avatar URL' },
      { name: 'userAvatarFallback', type: 'string', label: 'User Avatar Fallback', defaultValue: 'You' },
      { name: 'assistantAvatarUrl', type: 'string', label: 'Assistant Avatar URL' },
      { name: 'assistantAvatarFallback', type: 'string', label: 'Assistant Avatar Fallback', defaultValue: 'AI' },
      { name: 'maxHeight', type: 'string', label: 'Max Height', defaultValue: '500px' },
      { name: 'api', type: 'string', label: 'API Endpoint', description: 'Backend SSE endpoint for streaming AI mode' },
      { name: 'conversationId', type: 'string', label: 'Conversation ID' },
      { name: 'systemPrompt', type: 'string', label: 'System Prompt' },
      { name: 'model', type: 'string', label: 'AI Model' },
      { name: 'streamingEnabled', type: 'boolean', label: 'Enable Streaming', defaultValue: true },
      { name: 'autoResponse', type: 'boolean', label: 'Enable Auto Response (Demo)', defaultValue: false },
      { name: 'autoResponseText', type: 'string', label: 'Auto Response Text', defaultValue: 'Thank you for your message!' },
      { name: 'autoResponseDelay', type: 'number', label: 'Auto Response Delay (ms)', defaultValue: 1000 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        }
      ],
      placeholder: 'Type your message...',
      showTimestamp: false,
      disabled: false,
      enableMarkdown: true,
      enableFileUpload: false,
      userAvatarFallback: 'You',
      assistantAvatarFallback: 'AI',
      maxHeight: '500px',
      autoResponse: true,
      autoResponseText: 'Thank you for your message! This is an automated response.',
      autoResponseDelay: 1000,
      className: 'w-full max-w-2xl'
    }
  }
);

// Register Floating Chatbot (FAB widget)
ComponentRegistry.register('chatbot-floating',
  ({ schema, className, ...props }: { schema: ChatbotSchema & {
    enableMarkdown?: boolean;
    enableFileUpload?: boolean;
    showTimestamp?: boolean;
    disabled?: boolean;
    userAvatarUrl?: string;
    userAvatarFallback?: string;
    assistantAvatarUrl?: string;
    assistantAvatarFallback?: string;
    autoResponse?: boolean;
    autoResponseText?: string;
    autoResponseDelay?: number;
    onSend?: (content: string, messages: ObjectChatMessage[]) => void;
    onClear?: () => void;
  }; className?: string; [key: string]: any }) => {
    const {
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      reload,
      clear,
      isApiMode,
    } = useObjectChat({
      api: schema.api,
      initialMessages: schema.messages,
      conversationId: schema.conversationId,
      systemPrompt: schema.systemPrompt,
      model: schema.model,
      streamingEnabled: schema.streamingEnabled,
      headers: schema.headers,
      body: schema.requestBody,
      maxToolRoundtrips: schema.maxToolRoundtrips,
      onError: schema.onError,
      showTimestamp: schema.showTimestamp,
      autoResponse: schema.autoResponse,
      autoResponseText: schema.autoResponseText,
      autoResponseDelay: schema.autoResponseDelay,
      onSend: schema.onSend,
    });

    const handleSendMessage = (content: string, files?: File[]) => {
      sendMessage(content, files);
    };

    const handleClear = () => {
      clear();
      schema.onClear?.();
    };

    // See the `chatbot` renderer above — one seam, one adapter (objectui#4399).
    const runtimeMessages = useMemo(() => toRuntimeMessages(messages), [messages]);

    return (
      <FloatingChatbot
        floatingConfig={schema.floatingConfig}
        messages={runtimeMessages}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        onClear={handleClear}
        onStop={isApiMode && isLoading ? stop : undefined}
        onReload={isApiMode ? reload : undefined}
        disabled={schema.disabled}
        isLoading={isLoading}
        error={error}
        showTimestamp={schema.showTimestamp}
        userAvatarUrl={schema.userAvatarUrl}
        userAvatarFallback={schema.userAvatarFallback}
        assistantAvatarUrl={schema.assistantAvatarUrl}
        assistantAvatarFallback={schema.assistantAvatarFallback}
        enableMarkdown={schema.enableMarkdown ?? true}
        enableFileUpload={schema.enableFileUpload ?? false}
        className={className}
        {...props}
      />
    );
  },
  {
    namespace: 'plugin-chatbot',
    label: 'Chatbot (Floating)',
    inputs: [
      { name: 'displayMode', type: 'string', label: 'Display Mode', defaultValue: 'floating', description: 'Set to "floating" for FAB widget' },
      { name: 'floatingConfig.position', type: 'string', label: 'FAB Position', defaultValue: 'bottom-right', description: 'bottom-right or bottom-left' },
      { name: 'floatingConfig.defaultOpen', type: 'boolean', label: 'Default Open', defaultValue: false },
      { name: 'floatingConfig.panelWidth', type: 'number', label: 'Panel Width', defaultValue: 400 },
      { name: 'floatingConfig.panelHeight', type: 'number', label: 'Panel Height', defaultValue: 520 },
      { name: 'floatingConfig.title', type: 'string', label: 'Panel Title', defaultValue: 'Chat' },
      { name: 'floatingConfig.triggerSize', type: 'number', label: 'Trigger Size', defaultValue: 56 },
      { name: 'messages', type: 'array', label: 'Initial Messages' },
      { name: 'placeholder', type: 'string', label: 'Input Placeholder', defaultValue: 'Type your message...' },
      { name: 'enableMarkdown', type: 'boolean', label: 'Enable Markdown', defaultValue: true },
      { name: 'enableFileUpload', type: 'boolean', label: 'Enable File Upload', defaultValue: false },
      { name: 'api', type: 'string', label: 'API Endpoint', description: 'Backend SSE endpoint for streaming AI mode' },
      { name: 'conversationId', type: 'string', label: 'Conversation ID' },
      { name: 'systemPrompt', type: 'string', label: 'System Prompt' },
      { name: 'model', type: 'string', label: 'AI Model' },
      { name: 'streamingEnabled', type: 'boolean', label: 'Enable Streaming', defaultValue: true },
      { name: 'autoResponse', type: 'boolean', label: 'Enable Auto Response (Demo)', defaultValue: false },
      { name: 'autoResponseText', type: 'string', label: 'Auto Response Text', defaultValue: 'Thank you for your message!' },
      { name: 'autoResponseDelay', type: 'number', label: 'Auto Response Delay (ms)', defaultValue: 1000 },
      { name: 'className', type: 'string', label: 'CSS Class' },
    ],
    defaultProps: {
      displayMode: 'floating',
      floatingConfig: {
        position: 'bottom-right',
        defaultOpen: false,
        panelWidth: 400,
        panelHeight: 520,
        title: 'Chat',
        triggerSize: 56,
      },
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        }
      ],
      placeholder: 'Type your message...',
      enableMarkdown: true,
      enableFileUpload: false,
      autoResponse: true,
      autoResponseText: 'Thank you for your message! This is an automated response.',
      autoResponseDelay: 1000,
    }
  }
);
