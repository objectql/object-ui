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
import { useState } from 'react';

/**
 * Chatbot component for Object UI
 * 
 * @remarks
 * This component supports an optional `onSend` callback in the schema:
 * - Signature: `onSend(content: string, messages: ChatMessage[]): void`
 * - Parameters:
 *   - content: The message text that was sent
 *   - messages: Array of all messages including the newly added message
 * - Called when: User sends a message via the input field
 * - Use case: Connect to backend API or trigger custom actions on message send
 */
ComponentRegistry.register('chatbot', 
  ({ schema, className, ...props }: { schema: ChatbotSchema; className?: string; [key: string]: any }) => {
    // Initialize messages from schema or use empty array
    const [messages, setMessages] = useState<ChatMessage[]>(
      schema.messages?.map((msg: any, idx: number) => ({
        id: msg.id || `msg-${idx}`,
        role: msg.role || 'user',
        content: msg.content || '',
        timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : (msg.timestamp instanceof Date ? msg.timestamp.toISOString() : undefined),
        avatar: msg.avatar,
        avatarFallback: msg.avatarFallback,
      })) || []
    );

    // Handle sending new messages
    const handleSendMessage = (content: string) => {
      // Create user message with robust ID generation
      const userMessage: ChatMessage = {
        id: crypto?.randomUUID?.() || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content,
        timestamp: schema.showTimestamp ? new Date().toLocaleTimeString() : undefined,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // If onSend callback is provided in schema, call it with updated messages
      if (schema.onSend) {
        schema.onSend(content, updatedMessages);
      }

      // Auto-response feature for demo purposes
      if (schema.autoResponse) {
        setTimeout(() => {
          const assistantMessage: ChatMessage = {
            id: crypto?.randomUUID?.() || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            content: schema.autoResponseText || 'Thank you for your message!',
            timestamp: schema.showTimestamp ? new Date().toLocaleTimeString() : undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }, schema.autoResponseDelay || 1000);
      }
    };

    return (
      <Chatbot 
        messages={messages as any}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        disabled={schema.disabled}
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
        name: 'autoResponse', 
        type: 'boolean', 
        label: 'Enable Auto Response (Demo)',
        defaultValue: false,
        description: 'Automatically send a response after user message (for demo purposes)'
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
