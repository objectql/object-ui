/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock @ai-sdk/react so the static import in useObjectChat doesn't break tests
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    error: undefined,
    input: '',
    setInput: vi.fn(),
    handleInputChange: vi.fn(),
    append: vi.fn(),
    stop: vi.fn(),
    reload: vi.fn(),
    setMessages: vi.fn(),
  })),
}));

import { useObjectChat } from '../useObjectChat';

describe('useObjectChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('local/legacy mode (no api)', () => {
    it('should initialize with empty messages when no initialMessages provided', () => {
      const { result } = renderHook(() => useObjectChat());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.isApiMode).toBe(false);
      expect(result.current.input).toBe('');
    });

    it('should initialize with provided messages', () => {
      const initialMessages = [
        { id: '1', role: 'assistant' as const, content: 'Hello!' },
        { id: '2', role: 'user' as const, content: 'Hi!' },
      ];

      const { result } = renderHook(() =>
        useObjectChat({ initialMessages })
      );

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Hello!');
      expect(result.current.messages[1].content).toBe('Hi!');
    });

    it('should add a user message when sendMessage is called', () => {
      const { result } = renderHook(() => useObjectChat());

      act(() => {
        result.current.sendMessage('Hello world');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello world');
      expect(result.current.messages[0].id).toBeTruthy();
    });

    it('should not send empty messages', () => {
      const { result } = renderHook(() => useObjectChat());

      act(() => {
        result.current.sendMessage('');
      });

      expect(result.current.messages).toHaveLength(0);

      act(() => {
        result.current.sendMessage('   ');
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should trim whitespace from messages', () => {
      const { result } = renderHook(() => useObjectChat());

      act(() => {
        result.current.sendMessage('  Hello  ');
      });

      expect(result.current.messages[0].content).toBe('Hello');
    });

    it('should call onSend callback when message is sent', () => {
      const onSend = vi.fn();
      const { result } = renderHook(() => useObjectChat({ onSend }));

      act(() => {
        result.current.sendMessage('Test message');
      });

      expect(onSend).toHaveBeenCalledWith(
        'Test message',
        expect.arrayContaining([
          expect.objectContaining({ content: 'Test message', role: 'user' }),
        ])
      );
    });

    it('should add auto-response after delay when autoResponse is enabled', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          autoResponse: true,
          autoResponseText: 'Auto reply!',
          autoResponseDelay: 500,
        })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.isLoading).toBe(true);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].role).toBe('assistant');
      expect(result.current.messages[1].content).toBe('Auto reply!');
      expect(result.current.isLoading).toBe(false);
    });

    it('should use default auto-response text when none provided', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          autoResponse: true,
          autoResponseDelay: 500,
        })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.messages[1].content).toBe('Thank you for your message!');
    });

    it('should add timestamps when showTimestamp is enabled', () => {
      const { result } = renderHook(() =>
        useObjectChat({ showTimestamp: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages[0].timestamp).toBeTruthy();
    });

    it('should not add timestamps when showTimestamp is disabled', () => {
      const { result } = renderHook(() =>
        useObjectChat({ showTimestamp: false })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages[0].timestamp).toBeUndefined();
    });

    it('should clear all messages when clear is called', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          initialMessages: [
            { id: '1', role: 'assistant', content: 'Hello!' },
          ],
        })
      );

      expect(result.current.messages).toHaveLength(1);

      act(() => {
        result.current.clear();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should stop auto-response timer when stop is called', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          autoResponse: true,
          autoResponseDelay: 1000,
        })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isLoading).toBe(false);

      // Advance time - no auto-response should appear
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.messages).toHaveLength(1); // Only user message
    });

    it('reload should be a no-op in local mode', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          initialMessages: [
            { id: '1', role: 'user', content: 'Hello' },
          ],
        })
      );

      act(() => {
        result.current.reload();
      });

      expect(result.current.messages).toHaveLength(1);
    });

    it('should handle input state management', () => {
      const { result } = renderHook(() => useObjectChat());

      expect(result.current.input).toBe('');

      act(() => {
        result.current.setInput('Hello');
      });

      expect(result.current.input).toBe('Hello');
    });

    it('should handle input change events', () => {
      const { result } = renderHook(() => useObjectChat());

      act(() => {
        result.current.handleInputChange({
          target: { value: 'Hello world' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.input).toBe('Hello world');
    });

    it('should clear input after sending message', () => {
      const { result } = renderHook(() => useObjectChat());

      act(() => {
        result.current.setInput('Hello');
      });

      expect(result.current.input).toBe('Hello');

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.input).toBe('');
    });

    it('should normalize initial messages with missing fields', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          initialMessages: [
            { id: '', role: 'user' as const, content: '' },
          ],
        })
      );

      expect(result.current.messages[0].id).toBe('msg-0');
      expect(result.current.messages[0].content).toBe('');
    });

    it('should report isApiMode as false in local mode', () => {
      const { result } = renderHook(() => useObjectChat());
      expect(result.current.isApiMode).toBe(false);
    });

    it('should report isApiMode as false when api is empty string', () => {
      const { result } = renderHook(() => useObjectChat({ api: '' }));
      expect(result.current.isApiMode).toBe(false);
    });

    it('should cancel pending auto-response timer when clear is called', () => {
      const { result } = renderHook(() =>
        useObjectChat({
          autoResponse: true,
          autoResponseText: 'Auto reply!',
          autoResponseDelay: 1000,
        })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.clear();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);

      // Advance time - no auto-response should appear after clear
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });
});
