/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c follow-up — issue #2477 item 2: the Studio right dock remembers
 * a collapse instead of re-expanding on every pillar switch / package change /
 * Studio re-entry, under a key SCOPED to this surface so it never fights the
 * console dock's own state.
 *
 * The behaviour shipped in PR #2478, but only its storage HELPERS were pinned
 * (`layout/__tests__/chatDockReturnLocation.test.tsx`). The wiring that makes
 * them matter — StudioChatDock actually passing its own keys into
 * `useChatDockState` — was untested, so deleting `persistExpandedKey` (the one
 * line that fixes the card's complaint) left every test green. This pins it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ChatDockOptions } from '../../../layout/ChatDock';
import {
  DOCK_EXPANDED_STORAGE_KEY,
  DOCK_STUDIO_EXPANDED_STORAGE_KEY,
  DOCK_STUDIO_WIDTH_STORAGE_KEY,
  DOCK_WIDTH_STORAGE_KEY,
} from '../../../layout/chatDockState';

// Every option object StudioChatDock hands to useChatDockState, in order.
const dockOptions: Array<ChatDockOptions | undefined> = [];

vi.mock('../../../layout/ChatDock', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    // Record the options, then defer to the REAL hook so the recorded wiring is
    // the same call the shipped dock actually makes (a stub would let the two
    // drift apart silently).
    useChatDockState: (options?: ChatDockOptions) => {
      dockOptions.push(options);
      return (actual.useChatDockState as (o?: ChatDockOptions) => unknown)(options);
    },
    ChatDockPanel: () => null,
    ChatDockLauncher: () => null,
    ChatDockMobileSheet: () => null,
  };
});

// The dock's body and its data seams are irrelevant here — only the state
// wiring is under test. One agent so the empty-catalog gate lets it render.
vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [{ name: 'build' }], isLoading: false, error: null }),
}));
// Partial — the module also feeds the metadata client factory, which imports
// `createAuthenticatedFetch` from it at load time.
vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../../../console/ai/AiChatPage', () => ({
  ChatPane: () => null,
  resolveApiBase: () => '/api/v1',
}));
vi.mock('../../../hooks/useChatConversation', () => ({
  useChatConversation: () => ({ conversationId: 'c1', initialMessages: [] }),
}));

import { StudioChatDock } from '../StudioAiCopilot';

beforeEach(() => {
  dockOptions.length = 0;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

/**
 * Mount the dock and return the options it passed to `useChatDockState`. React
 * re-renders (and StrictMode double-invokes), so assert the wiring is STABLE
 * across every call rather than pinning a call count — a per-render-varying key
 * would be its own bug, and this catches it.
 */
function mountStudioDock(): ChatDockOptions | undefined {
  render(
    <MemoryRouter>
      <StudioChatDock packageId="app.crm" />
    </MemoryRouter>,
  );
  expect(dockOptions.length).toBeGreaterThan(0);
  for (const options of dockOptions) {
    expect(options).toEqual(dockOptions[0]);
  }
  return dockOptions[0];
}

describe('StudioChatDock state wiring (#2477 item 2)', () => {
  it('persists its expanded state under the STUDIO key, not the console one', () => {
    const options = mountStudioDock();
    // The fix itself: without a persist key the collapse is in-memory and the
    // dock re-expands on every pillar switch — the card's actual complaint.
    expect(options?.persistExpandedKey).toBe(DOCK_STUDIO_EXPANDED_STORAGE_KEY);
    // Scoped: sharing the console's key would make the two docks one collapse.
    expect(options?.persistExpandedKey).not.toBe(DOCK_EXPANDED_STORAGE_KEY);
  });

  it('keeps the copilot-visible first-visit posture (default expanded)', () => {
    expect(mountStudioDock()?.defaultExpanded).toBe(true);
  });

  it('sizes itself under the STUDIO width key so the console cannot squeeze the canvas', () => {
    const options = mountStudioDock();
    expect(options?.persistWidthKey).toBe(DOCK_STUDIO_WIDTH_STORAGE_KEY);
    expect(options?.persistWidthKey).not.toBe(DOCK_WIDTH_STORAGE_KEY);
  });

  it('a console collapse flag does not collapse the Studio dock', () => {
    // Cross-surface non-interference, the direction the card names: the console
    // dock storing '0' must leave Studio on its own default (expanded), and must
    // not have written anything under the Studio key.
    window.sessionStorage.setItem(DOCK_EXPANDED_STORAGE_KEY, '0');
    expect(mountStudioDock()?.defaultExpanded).toBe(true);
    expect(window.sessionStorage.getItem(DOCK_STUDIO_EXPANDED_STORAGE_KEY)).toBeNull();
  });
});
