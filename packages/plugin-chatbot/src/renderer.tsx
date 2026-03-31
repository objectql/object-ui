/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ChatbotSchema, ChatMessage } from '@object-ui/types';
import { Chatbot } from './index';
import { ChatbotEnhanced } from './ChatbotEnhanced';
import { useObjectChat } from './useObjectChat';

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
 * - Signature: `onSend(content: string, messages: ChatMessage[]): void`
 */
ComponentRegistry.register('chatbot', 
  ({ schema, className, ...props }: { schema: ChatbotSchema & {
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
    onSend?: (content: string, messages: ChatMessage[]) => void;
  }; className?: string; [key: string]: any }) => {
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

    return (
      <Chatbot 
        messages={messages as any}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        disabled={schema.disabled || isLoading}
        showTimestamp={schema.showTimestamp}
        userAvatarUrl={schema.userAvatarUrl}
        userAvatarFallback={schema.userAvatarFallback}
        assistantAvatarUrl={schema.assistantAvatarUrl}
        assistantAvatarFallback={schema.assistantAvatarFallback}
        maxHeight={schema.maxHeight}
        className={className}
        {...props}
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
  ({ schema, className, ...props }: { schema: ChatbotSchema & { 
    enableMarkdown?: boolean; 
    enableFileUpload?: boolean;
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
    onSend?: (content: string, messages: ChatMessage[]) => void;
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

    return (
      <ChatbotEnhanced
        messages={messages as any}
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
        maxHeight={schema.maxHeight}
        enableMarkdown={schema.enableMarkdown ?? true}
        enableFileUpload={schema.enableFileUpload ?? false}
        className={className}
        {...props}
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
