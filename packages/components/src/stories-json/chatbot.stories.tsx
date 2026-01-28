import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Plugins/Chatbot',
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
