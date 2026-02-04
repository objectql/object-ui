/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatbotEnhanced, type ChatMessage } from '../ChatbotEnhanced';

describe('ChatbotEnhanced', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello!',
      timestamp: '10:00 AM',
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Hi there! How can I help you?',
      timestamp: '10:01 AM',
    },
  ];

  it('should render without crashing', () => {
    const { container } = render(<ChatbotEnhanced />);
    expect(container).toBeTruthy();
  });

  it('should render messages', () => {
    render(<ChatbotEnhanced messages={mockMessages} />);
    
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Hi there! How can I help you?')).toBeInTheDocument();
  });

  it('should render placeholder in input', () => {
    const placeholder = 'Type your message...';
    render(<ChatbotEnhanced placeholder={placeholder} />);
    
    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('should call onSendMessage when send button is clicked', async () => {
    const onSendMessage = vi.fn();
    render(<ChatbotEnhanced onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith('Test message', undefined);
    });
  });

  it('should call onSendMessage when Enter is pressed', async () => {
    const onSendMessage = vi.fn();
    render(<ChatbotEnhanced onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith('Test message', undefined);
    });
  });

  it('should not send empty messages', async () => {
    const onSendMessage = vi.fn();
    render(<ChatbotEnhanced onSendMessage={onSendMessage} />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  it('should call onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<ChatbotEnhanced messages={mockMessages} onClear={onClear} />);
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    
    expect(onClear).toHaveBeenCalled();
  });

  it('should render markdown content when enabled', () => {
    const markdownMessage: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: '**Bold text** and *italic text*',
      },
    ];
    
    render(<ChatbotEnhanced messages={markdownMessage} enableMarkdown={true} />);
    
    // Check that markdown is rendered (will create strong and em tags)
    const { container } = render(<ChatbotEnhanced messages={markdownMessage} enableMarkdown={true} />);
    expect(container.querySelector('strong')).toBeTruthy();
  });

  it('should render plain text when markdown is disabled', () => {
    const textMessage: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: '**Bold text** and *italic text*',
      },
    ];
    
    render(<ChatbotEnhanced messages={textMessage} enableMarkdown={false} />);
    
    // Should render as plain text
    expect(screen.getByText('**Bold text** and *italic text*')).toBeInTheDocument();
  });

  it('should show timestamps when enabled', () => {
    render(<ChatbotEnhanced messages={mockMessages} showTimestamp={true} />);
    
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('10:01 AM')).toBeInTheDocument();
  });

  it('should disable input when disabled prop is true', () => {
    render(<ChatbotEnhanced disabled={true} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    expect(input).toBeDisabled();
  });

  it('should render file upload button when enabled', () => {
    render(<ChatbotEnhanced enableFileUpload={true} />);
    
    const fileButton = screen.getByRole('button', { name: /attach/i });
    expect(fileButton).toBeInTheDocument();
  });

  it('should handle streaming messages', () => {
    const streamingMessage: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Streaming content...',
        streaming: true,
      },
    ];
    
    const { container } = render(<ChatbotEnhanced messages={streamingMessage} />);
    
    expect(screen.getByText('Streaming content...')).toBeInTheDocument();
    // Streaming messages typically have a visual indicator (cursor/animation)
  });

  it('should render user and assistant avatars', () => {
    render(
      <ChatbotEnhanced
        messages={mockMessages}
        userAvatarFallback="U"
        assistantAvatarFallback="A"
      />
    );
    
    // Avatars should be rendered
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should clear input after sending message', async () => {
    const onSendMessage = vi.fn();
    render(<ChatbotEnhanced onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText(/message/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    expect(input.value).toBe('Test message');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
