import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';

const chatbotSchema = {
  type: 'div',
  className: 'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8',
  body: [
    {
      type: 'div',
      className: 'max-w-4xl mx-auto space-y-8',
      body: [
        // Header
        {
          type: 'div',
          className: 'text-center space-y-4',
          body: [
            {
              type: 'div',
              className: 'text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent',
              body: {
                type: 'text',
                content: 'Object UI Chatbot Component'
              }
            },
            {
              type: 'div',
              className: 'text-lg text-muted-foreground',
              body: {
                type: 'text',
                content: 'A fully functional, schema-driven chatbot component'
              }
            }
          ]
        },

        // Chatbot Demo Card
        {
          type: 'card',
          className: 'shadow-2xl',
          body: [
            {
              type: 'div',
              className: 'p-6 border-b',
              body: {
                type: 'div',
                className: 'text-xl font-semibold',
                body: {
                  type: 'text',
                  content: 'Interactive Demo'
                }
              }
            },
            {
              type: 'div',
              className: 'p-6',
              body: {
                type: 'chatbot',
                messages: [
                  {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Hello! 👋 Welcome to Object UI Chatbot. I\'m here to help you explore this component. Try sending me a message!',
                  },
                  {
                    id: 'info',
                    role: 'assistant',
                    content: 'This chatbot is built entirely from JSON schema. No React components needed!',
                  }
                ],
                placeholder: 'Type your message here...',
                showTimestamp: true,
                userAvatarFallback: 'You',
                assistantAvatarFallback: 'AI',
                maxHeight: '600px',
                autoResponse: true,
                autoResponseText: 'Thanks for your message! This is an automated response demonstrating the chatbot functionality. In a real application, you would connect this to your backend API or AI service.',
                autoResponseDelay: 1500,
                className: 'w-full'
              }
            }
          ]
        },

        // Features Section
        {
          type: 'div',
          className: 'grid md:grid-cols-2 gap-6',
          body: [
            {
              type: 'card',
              className: 'p-6 shadow-lg',
              body: [
                {
                  type: 'div',
                  className: 'text-lg font-semibold mb-3',
                  body: {
                    type: 'text',
                    content: '✨ Key Features'
                  }
                },
                {
                  type: 'list',
                  items: [
                    'Message bubbles with user/assistant roles',
                    'Avatar support for participants',
                    'Scrollable message history',
                    'Input field with send button',
                    'Timestamp display (optional)',
                    'Auto-response for demos',
                    'Fully customizable styling'
                  ],
                  className: 'text-sm'
                }
              ]
            },
            {
              type: 'card',
              className: 'p-6 shadow-lg',
              body: [
                {
                  type: 'div',
                  className: 'text-lg font-semibold mb-3',
                  body: {
                    type: 'text',
                    content: '🎨 Schema-Driven'
                  }
                },
                {
                  type: 'div',
                  className: 'text-sm space-y-2',
                  body: [
                    {
                      type: 'text',
                      content: 'This entire chatbot is defined using pure JSON schema. Configure messages, styling, behavior, and more without writing any React code.'
                    },
                    {
                      type: 'div',
                      className: 'mt-4 p-3 bg-muted rounded-lg font-mono text-xs',
                      body: {
                        type: 'text',
                        content: '{ type: "chatbot", messages: [...] }'
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },

        // Usage Example
        {
          type: 'card',
          className: 'p-6 shadow-lg',
          body: [
            {
              type: 'div',
              className: 'text-lg font-semibold mb-3',
              body: {
                type: 'text',
                content: '📝 Usage Example'
              }
            },
            {
              type: 'div',
              className: 'bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto',
              body: {
                type: 'text',
                content: `{
  "type": "chatbot",
  "messages": [
    {
      "id": "msg-1",
      "role": "assistant",
      "content": "Hello! How can I help?"
    }
  ],
  "placeholder": "Type your message...",
  "showTimestamp": true,
  "autoResponse": true,
  "className": "w-full"
}`
              }
            }
          ]
        }
      ]
    }
  ]
};

function ChatbotDemo() {
  return <SchemaRenderer schema={chatbotSchema} />;
}

export default ChatbotDemo;
