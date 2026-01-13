import { ComponentRegistry } from '@object-ui/core';
import { Chatbot, ChatbotMessage } from '@/ui';
import { useState } from 'react';

ComponentRegistry.register('chatbot', 
  ({ schema, className, ...props }) => {
    // Initialize messages from schema or use empty array
    const [messages, setMessages] = useState<ChatbotMessage[]>(
      schema.messages?.map((msg: any, idx: number) => ({
        id: msg.id || `msg-${idx}`,
        role: msg.role || 'user',
        content: msg.content || '',
        timestamp: msg.timestamp,
        avatar: msg.avatar,
        avatarFallback: msg.avatarFallback,
      })) || []
    );

    // Handle sending new messages
    const handleSendMessage = (content: string) => {
      // Create user message
      const userMessage: ChatbotMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: schema.showTimestamp ? new Date().toLocaleTimeString() : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);

      // If onSend callback is provided in schema, call it
      if (schema.onSend) {
        schema.onSend(content, messages);
      }

      // Auto-response feature for demo purposes
      if (schema.autoResponse) {
        setTimeout(() => {
          const assistantMessage: ChatbotMessage = {
            id: `msg-${Date.now()}-response`,
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
        messages={messages}
        placeholder={schema.placeholder}
        onSendMessage={handleSendMessage}
        disabled={schema.disabled}
        showTimestamp={schema.showTimestamp}
        userAvatar={schema.userAvatar}
        userAvatarFallback={schema.userAvatarFallback}
        assistantAvatar={schema.assistantAvatar}
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
        name: 'userAvatar', 
        type: 'string', 
        label: 'User Avatar URL'
      },
      { 
        name: 'userAvatarFallback', 
        type: 'string', 
        label: 'User Avatar Fallback',
        defaultValue: 'You'
      },
      { 
        name: 'assistantAvatar', 
        type: 'string', 
        label: 'Assistant Avatar URL'
      },
      { 
        name: 'assistantAvatarFallback', 
        type: 'string', 
        label: 'Assistant Avatar Fallback',
        defaultValue: 'AI'
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
