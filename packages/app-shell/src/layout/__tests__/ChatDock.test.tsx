/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c — ChatDockPanel chrome contract: the `children` body override
 * (the Studio dock's seam), the maximize button rendered only when a target is
 * provided, and the collapse button still driving the dock state.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatDockPanel, type ChatDockState } from '../ChatDock';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

// The default body (ChatDockConversation) drags in the whole chat graph
// (plugin-chatbot, hooks, AiChatPage) — irrelevant to the chrome under test,
// and every case here overrides the body via `children` anyway.
vi.mock('../../console/ai/AiChatPage', () => ({
  ChatPane: () => null,
  resolveApiBase: (explicit?: string) => explicit ?? '/api/v1/ai',
}));
vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [], isLoading: false, error: undefined }),
}));
vi.mock('../../hooks', () => ({
  useChatConversation: () => ({ conversationId: undefined, initialMessages: [] }),
}));

function dockState(overrides: Partial<ChatDockState> = {}): ChatDockState {
  return {
    expanded: true,
    width: 420,
    dragging: false,
    maximized: false,
    toggle: vi.fn(),
    expand: vi.fn(),
    collapse: vi.fn(),
    maximize: vi.fn(),
    restore: vi.fn(),
    onResizePointerDown: vi.fn(),
    ...overrides,
  };
}

describe('ChatDockPanel', () => {
  it('renders the children body override instead of the default conversation', () => {
    render(
      <ChatDockPanel dock={dockState()}>
        <div data-testid="studio-dock-body" />
      </ChatDockPanel>,
    );
    expect(screen.getByTestId('studio-dock-body')).toBeInTheDocument();
  });

  it('shows the maximize button only when onMaximize is provided, and fires it', () => {
    const { rerender } = render(
      <ChatDockPanel dock={dockState()}>
        <div />
      </ChatDockPanel>,
    );
    expect(screen.queryByTestId('chat-dock-maximize')).not.toBeInTheDocument();

    const onMaximize = vi.fn();
    rerender(
      <ChatDockPanel dock={dockState()} onMaximize={onMaximize}>
        <div />
      </ChatDockPanel>,
    );
    fireEvent.click(screen.getByTestId('chat-dock-maximize'));
    expect(onMaximize).toHaveBeenCalledTimes(1);
  });

  it('renders the title override and keeps collapse wired to the dock state', () => {
    const dock = dockState();
    render(
      <ChatDockPanel dock={dock} title="AI copilot">
        <div />
      </ChatDockPanel>,
    );
    expect(screen.getByText('AI copilot')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-dock-collapse'));
    expect(dock.collapse).toHaveBeenCalledTimes(1);
  });
});
