import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Chatbot',
  component: SchemaRenderer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
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
  } as any,
};

export const WithTimestamps: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m here to assist you.',
        timestamp: '10:00 AM'
      },
      {
        id: '2',
        role: 'user',
        content: 'Hi! I need help with my account.',
        timestamp: '10:01 AM'
      },
      {
        id: '3',
        role: 'assistant',
        content: 'I\'d be happy to help! What specific issue are you experiencing?',
        timestamp: '10:01 AM'
      }
    ],
    placeholder: 'Type your message...',
    showTimestamp: true,
    autoResponse: true,
    autoResponseText: 'I understand your concern. Let me help you with that.',
    className: 'w-full max-w-2xl'
  } as any,
};

export const CustomerSupport: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'system',
        content: 'Support session started'
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Welcome to customer support! How may I assist you today?',
      },
      {
        id: '3',
        role: 'user',
        content: 'I\'m having trouble accessing my dashboard.',
      },
      {
        id: '4',
        role: 'assistant',
        content: 'I\'m sorry to hear that. Let me help you troubleshoot. First, can you tell me what error message you\'re seeing?',
      }
    ],
    placeholder: 'Describe your issue...',
    assistantAvatarFallback: 'CS',
    autoResponse: true,
    autoResponseText: 'Thank you for that information. Let me check our system.',
    autoResponseDelay: 1500,
    className: 'w-full max-w-2xl'
  } as any,
};

export const WithMarkdown: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Can you show me how to use markdown?',
      },
      {
        id: '2',
        role: 'assistant',
        content: `Sure! Here are some markdown examples:

**Bold text** and *italic text*

# Heading 1
## Heading 2

- List item 1
- List item 2
- List item 3

\`inline code\` and code blocks:

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

> This is a blockquote
`,
      }
    ],
    placeholder: 'Type your message...',
    enableMarkdown: true,
    showTimestamp: false,
    autoResponse: true,
    autoResponseText: 'Markdown is great for formatting!',
    className: 'w-full max-w-2xl'
  } as any,
};

export const WithCodeHighlighting: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Can you help me with a React component?',
      },
      {
        id: '2',
        role: 'assistant',
        content: `Of course! Here's a simple React component example:

\`\`\`tsx
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {label}
    </button>
  );
};
\`\`\`

This component accepts a \`label\` and \`onClick\` handler as props.`,
      }
    ],
    placeholder: 'Ask me anything...',
    enableMarkdown: true,
    showTimestamp: false,
    autoResponse: true,
    autoResponseText: 'I can help with code examples!',
    className: 'w-full max-w-2xl'
  } as any,
};

export const WithFileUpload: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'You can upload files by clicking the attachment button below.',
      }
    ],
    placeholder: 'Type your message or upload a file...',
    enableFileUpload: true,
    acceptedFileTypes: 'image/*,.pdf,.doc,.docx',
    maxFileSize: 5242880, // 5MB
    showTimestamp: false,
    autoResponse: true,
    autoResponseText: 'File received! Processing...',
    className: 'w-full max-w-2xl'
  } as any,
};

export const StreamingResponse: Story = {
  render: renderStory,
  args: {
    type: 'chatbot',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Tell me a story',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Once upon a time in a digital world...',
        streaming: true,
      }
    ],
    placeholder: 'Type your message...',
    enableMarkdown: true,
    showTimestamp: false,
    className: 'w-full max-w-2xl'
  } as any,
};
