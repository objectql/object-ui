// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#5799 — the built-moment transition (cloud#1609 增量一).
 *
 * The maintainer's form ruling: cold start keeps the full-page build surface;
 * the moment a WHOLE-APP build exists, the conversation lives in the Studio
 * workbench. Three pins:
 *
 *  1. REOPENING a conversation that already built an app lands in
 *     `/studio/<pkg>/interfaces` — the kill criterion ("no path stays on the
 *     full-page chat after the build"), driven from the persisted draftReview
 *     envelope (#2623 lesson: never runtime canvas state).
 *  2. A LIVE build completion transitions when the turn settles.
 *  3. The Studio dock's 以完整页面打开 door is the ONE sanctioned way back:
 *     its one-shot sessionStorage opt-out keeps the arrival on the full page
 *     instead of bouncing straight back to Studio.
 *
 * Same faked-chat harness as AiChatPage.buildHistorySurvives.test.tsx: the
 * hook instance owns the thread; hydration (the REAL AiChatPage path) derives
 * draftReview from the persisted tool envelope.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

interface FakeMsg {
  id: string;
  role: string;
  content: string;
  toolInvocations?: unknown[];
}

const chat = {
  isLoading: false,
  append: undefined as ((m: FakeMsg) => void) | undefined,
};

vi.mock('@object-ui/plugin-chatbot', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const React2 = await import('react');
  return {
    ...actual,
    useAgents: () => ({
      agents: [{ name: 'metadata_assistant', label: 'Build', capabilities: ['build'] }],
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    }),
    useAiModels: () => ({ models: [], defaultModelId: undefined }),
    useHitlInChat: () => ({ decide: vi.fn(), decisions: {} }),
    useObjectChat: (opts: { initialMessages?: FakeMsg[] }) => {
      const [messages, setMessages] = React2.useState<FakeMsg[]>(
        () => (opts.initialMessages ?? []) as FakeMsg[],
      );
      chat.append = (m: FakeMsg) => setMessages((prev) => [...prev, m]);
      return {
        messages,
        isLoading: chat.isLoading,
        error: undefined,
        sendMessage: vi.fn(),
        stop: vi.fn(),
        reload: vi.fn(),
        clear: vi.fn(),
        setMessages: vi.fn(),
      };
    },
    ChatbotEnhanced: (props: Record<string, unknown>) => {
      const msgs = (props.messages ?? []) as FakeMsg[];
      return <div data-testid="pane">{msgs.map((m) => m.id).join(',')}</div>;
    },
  };
});

vi.mock('@object-ui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useAuth: () => ({ user: { id: 'u1' } }) };
});
vi.mock('../../../providers/MetadataProvider', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useMetadata: () => ({ apps: [] }) };
});
vi.mock('../../../providers/AdapterProvider', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useAdapter: () => null };
});
vi.mock('../ConversationsSidebar', () => ({
  ConversationsSidebar: () => <div data-testid="sidebar" />,
}));
vi.mock('../LiveCanvas', () => ({
  LiveCanvas: () => <div data-testid="live-canvas" />,
}));

import { AiChatPage } from '../AiChatPage';

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

/** A persisted thread whose build ALREADY finished: the tool row carries the
 *  whole-app draft envelope (app item + packageId). */
const BUILT_TURNS = [
  { id: 'r1', role: 'user', content: [{ type: 'text', text: 'build me a CRM' }] },
  {
    id: 'r2',
    role: 'assistant',
    content: [
      { type: 'text', text: 'Built it.' },
      { type: 'tool-call', toolCallId: 't1', toolName: 'apply_blueprint' },
    ],
  },
  {
    id: 'r3',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 't1',
        toolName: 'apply_blueprint',
        output: {
          type: 'text',
          value: JSON.stringify({
            status: 'drafted',
            packageId: 'app.k9',
            drafted: [
              { type: 'app', name: 'k9_app' },
              { type: 'object', name: 'k9_task' },
            ],
          }),
        },
      },
    ],
  },
];

const UNBUILT_TURNS = [
  { id: 'r1', role: 'user', content: [{ type: 'text', text: 'hello' }] },
  { id: 'r2', role: 'assistant', content: [{ type: 'text', text: 'hi — what shall we build?' }] },
];

let serverTurns: unknown[] = [];

function installFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (/\/conversations\/conv-1$/.test(url) && method === 'GET') {
        return new Response(JSON.stringify({ id: 'conv-1', messages: serverTurns }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/ai/build/conv-1']}>
      <Routes>
        <Route path="/ai/:agent/:conversationId" element={<AiChatPage />} />
        <Route path="/ai/:agent" element={<AiChatPage />} />
        <Route
          path="/studio/:packageId/:tab"
          element={<div data-testid="studio-page" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  chat.isLoading = false;
  serverTurns = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AiChatPage — built-moment transition (objectui#5799)', () => {
  it('reopening a conversation that already built an app lands in the Studio workbench', async () => {
    serverTurns = BUILT_TURNS;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeInTheDocument(), {
      timeout: 4000,
    });
  });

  it("an AUTO-PUBLISH environment's published envelope transitions too (the staging posture)", async () => {
    serverTurns = JSON.parse(
      JSON.stringify(BUILT_TURNS).replace('"status":"drafted"', '"status":"published"'),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeInTheDocument(), {
      timeout: 4000,
    });
  });

  it('a conversation with no whole-app build stays on the full page', async () => {
    serverTurns = UNBUILT_TURNS;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('pane')).toBeInTheDocument(), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId('studio-page')).not.toBeInTheDocument();
  });

  it('a LIVE build completion transitions when the turn settles', async () => {
    serverTurns = UNBUILT_TURNS;
    chat.isLoading = true;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('pane')).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.queryByTestId('studio-page')).not.toBeInTheDocument();

    // The build turn lands (envelope on the invocation, as the live mapper
    // produces it) and the stream settles.
    act(() => {
      chat.append?.({
        id: 'live-1',
        role: 'assistant',
        content: 'built',
        toolInvocations: [
          {
            toolCallId: 't9',
            toolName: 'apply_blueprint',
            state: 'output-available',
            draftReview: {
              packageId: 'app.k9',
              items: [
                { type: 'app', name: 'k9_app' },
                { type: 'object', name: 'k9_task' },
              ],
            },
          },
        ],
      });
      chat.isLoading = false;
    });
    // one more render so the faked hook reports the settled isLoading
    act(() => {
      chat.append?.({ id: 'live-2', role: 'assistant', content: 'done' });
    });
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeInTheDocument(), {
      timeout: 4000,
    });
  });

  it("the dock's full-page door opts out ONCE — no bounce straight back to Studio", async () => {
    serverTurns = BUILT_TURNS;
    window.sessionStorage.setItem('objectstack:ai-full-page-requested', '1');
    renderPage();
    await waitFor(() => expect(screen.getByTestId('pane')).toBeInTheDocument(), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId('studio-page')).not.toBeInTheDocument();
    // consumed: the NEXT built conversation transitions normally
    expect(window.sessionStorage.getItem('objectstack:ai-full-page-requested')).toBeNull();
  });
});
