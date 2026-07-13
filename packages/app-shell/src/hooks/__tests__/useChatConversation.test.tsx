/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
// The chat surface derives the draft/plan affordance cards from the tool result
// via these mappers — round-tripping our cache through them is the real
// production path (live render → cache → cache-fallback reload).
import { uiMessageToChatMessage } from '@object-ui/plugin-chatbot';

import {
  sanitizeChatMessagesForCache,
  toUIMessages,
  useChatConversation,
  writeConversationMessagesCache,
} from '../useChatConversation';

const API_BASE = 'http://ai.test/api/v1/ai';
const CACHE_PREFIX = 'objectstack:ai-chat-conversation-id';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useChatConversation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is inert when userId is undefined', async () => {
    const { result } = renderHook(() =>
      useChatConversation({ userId: undefined, apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.initialMessages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates from a cached conversation id', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-cached');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'conv-cached',
        messages: [
          { id: 'm1', role: 'user', content: 'hello' },
          { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'hi back' }] },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-cached');
    expect(result.current.initialMessages).toEqual([
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'hi back' }] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-cached`);
  });

  it('preserves non-text message parts during hydration', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-tools');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'conv-tools',
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content: [
              { type: 'tool-query_data', toolCallId: 'tc1', input: { objectName: 'deal' }, output: { count: 3 }, state: 'output-available' },
              { type: 'text', text: 'Found 3 deals.' },
            ],
          },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.initialMessages[0]?.parts).toEqual([
      { type: 'tool-query_data', toolCallId: 'tc1', input: { objectName: 'deal' }, output: { count: 3 }, state: 'output-available' },
      { type: 'text', text: 'Found 3 deals.' },
    ]);
  });

  it('falls back to the sanitized local message cache when the server has no messages', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-cached');
    writeConversationMessagesCache(
      'conv-cached',
      sanitizeChatMessagesForCache([
        { id: 'u1', role: 'user', content: 'count records' },
        {
          id: 'a1',
          role: 'assistant',
          content: 'Found records.',
          toolInvocations: [
            { toolCallId: 'tc1', toolName: 'aggregate_data', state: 'output-available' },
          ],
        },
      ]),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-cached', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.initialMessages).toEqual([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'count records' }] },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Found records.' },
          {
            type: 'tool-aggregate_data',
            toolCallId: 'tc1',
            toolName: 'aggregate_data',
            state: 'output-available',
          },
        ],
      },
    ]);
  });

  it('falls back to POST when cached id 404s', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-missing');
    fetchMock
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-new', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-new'));
    expect(result.current.initialMessages).toEqual([]);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-new');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-missing`);
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe(`${API_BASE}/conversations`);
    expect((postCall[1] as RequestInit).method).toBe('POST');
  });

  it('creates a new conversation when there is no cache', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u2', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-fresh'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations`);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u2`)).toBe('conv-fresh');
  });

  it('uses a distinct cache key per scope', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-default');
    localStorage.setItem(`${CACHE_PREFIX}:u1:agent-x`, 'conv-scoped');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-scoped', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', scope: 'agent-x', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-scoped'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-scoped`);
  });

  it('reset() deletes the current conversation and creates a new one', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-old', messages: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-new', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-old'));

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.conversationId).toBe('conv-new');
    expect(result.current.initialMessages).toEqual([]);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-new');

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[1][0]).toBe(`${API_BASE}/conversations/conv-old`);
    expect((calls[1][1] as RequestInit).method).toBe('DELETE');
    expect(calls[2][0]).toBe(`${API_BASE}/conversations`);
    expect((calls[2][1] as RequestInit).method).toBe('POST');
  });

  it('swallows fetch errors and clears loading', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u3', apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.initialMessages).toEqual([]);
  });
});

describe('useChatConversation — forceNew (the sidebar New button)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the cached conversation and creates a fresh one', async () => {
    localStorage.setItem('objectstack:ai-chat-conversation-id:u1', 'conv-cached');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE, forceNew: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-fresh');
    // ONE call — the create; the cached id was never even fetched.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations`);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    // Cache now points at the fresh conversation.
    expect(localStorage.getItem('objectstack:ai-chat-conversation-id:u1')).toBe('conv-fresh');
  });

  it('overrides the resolved-once guard when flipping forceNew on an open page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'conv-a', messages: [] }));

    const { result, rerender } = renderHook(
      ({ forceNew }: { forceNew: boolean }) =>
        useChatConversation({ userId: 'u1', apiBase: API_BASE, forceNew }),
      { initialProps: { forceNew: false } },
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-a'));

    // The user clicks New: same mount, forceNew flips true. The stale id must
    // clear immediately (so the URL-mirroring host can't bounce back), then a
    // fresh conversation resolves.
    fetchMock.mockResolvedValue(jsonResponse({ id: 'conv-b', messages: [] }));
    rerender({ forceNew: true });
    await waitFor(() => expect(result.current.conversationId).toBe('conv-b'));
    const createCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === `${API_BASE}/conversations` && c[1]?.method === 'POST',
    );
    expect(createCalls.length).toBe(2);
  });

  it('is ignored while an explicit activeId is set (deep link wins)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-x', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE, activeId: 'conv-x', forceNew: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-x`);
  });
});

// The floating assistant's ASK surface opens a FRESH thread each visit
// (`resumeMode: 'fresh'`) instead of resuming the last conversation, while
// avoiding empty-row spam by reusing an untouched cached conversation. Its
// "New chat" button calls startNew(), which mints a fresh conversation WITHOUT
// deleting the current one (contrast reset()).
describe('useChatConversation — resumeMode "fresh" + startNew (the floating ask surface)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses an untouched (zero-message) cached conversation rather than minting another', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-empty');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-empty', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE, resumeMode: 'fresh' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-empty');
    expect(result.current.initialMessages).toEqual([]);
    // GET only — the empty conversation is reused, NOT a fresh POST (no spam).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-empty`);
  });

  it('starts a fresh conversation when the cached one was actually used, leaving it in history', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-used');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'conv-used',
          messages: [{ id: 'm1', role: 'user', content: 'an earlier question' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE, resumeMode: 'fresh' }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-fresh'));
    expect(result.current.initialMessages).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-used`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/conversations`);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
    // The used conversation is NOT deleted; the cache simply repoints to the new one.
    const methods = fetchMock.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method ?? 'GET');
    expect(methods).not.toContain('DELETE');
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-fresh');
  });

  it('startNew() mints a fresh conversation and switches to it without deleting the current one', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-current');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'conv-current',
          messages: [{ id: 'm1', role: 'user', content: 'hi' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-next', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-current'));

    await act(async () => {
      await result.current.startNew();
    });

    expect(result.current.conversationId).toBe('conv-next');
    expect(result.current.initialMessages).toEqual([]);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-next');
    // Crucially: NO delete — the prior thread survives in history.
    const methods = fetchMock.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method ?? 'GET');
    expect(methods).not.toContain('DELETE');
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/conversations`);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
  });
});

// Regression: a cache-fallback reload (server returns no/partial messages →
// `readMessageCache`) must keep the draft/plan affordance cards, not just the
// bare tool header. `sanitizeChatMessagesForCache` used to drop the tool
// `output`, so `mapMessages.detect*` returned undefined for cache-restored
// messages and the "Review N changes / Publish" card, the ADR-0038 verification
// chip, and the "Proposed plan" card silently vanished.
describe('sanitizeChatMessagesForCache — affordance cards survive a cache round-trip', () => {
  // The raw tool outputs exactly as the build/propose tools return them.
  const draftedOutput = {
    status: 'drafted',
    drafted: [
      { type: 'app', name: 'tracker_app' },
      { type: 'object', name: 'task' },
    ],
    summary: 'Built Tracker',
    packageId: 'pkg_1',
    autoPublishable: true,
    failed: [{ type: 'view', name: 'broken' }],
    materialized: true,
    verification: { errors: 0, warnings: 1 },
    issues: [{ severity: 'warning', code: 'lint_x', message: 'Consider X', fix: 'do Y' }],
    nextSteps: ['Replace the sample data', 'Publish from the status panel'],
  };
  const proposedOutput = {
    status: 'blueprint_proposed',
    summary: 'A lightweight tracker',
    counts: { objects: 2, views: 3, dashboards: 1, seedData: 2 },
    questions: ['Track interviews separately?'],
    targetApp: 'recruiting',
    blueprint: {
      assumptions: ['One pipeline for all roles'],
      objects: [
        { name: 'candidate', label: 'Candidate', fields: [{ name: 'full_name' }, { name: 'stage' }] },
        { name: 'job', fields: [{ name: 'title' }] },
      ],
    },
  };

  // An assistant message carrying both an apply_blueprint (drafted) and a
  // propose_blueprint (blueprint_proposed) tool output, as the live stream
  // produces it.
  const liveUiMessage = {
    id: 'a1',
    role: 'assistant' as const,
    parts: [
      { type: 'text', text: 'Done.' },
      {
        type: 'tool-apply_blueprint',
        toolCallId: 'tc-draft',
        state: 'output-available' as const,
        input: {},
        output: draftedOutput,
      },
      {
        type: 'tool-propose_blueprint',
        toolCallId: 'tc-plan',
        state: 'output-available' as const,
        input: {},
        output: proposedOutput,
      },
    ],
  };

  it('preserves draftReview + proposedPlan through sanitize → localStorage → re-map', () => {
    // 1. Live render derives the cards from the raw tool output (baseline).
    const live = uiMessageToChatMessage(liveUiMessage);
    expect(live.toolInvocations?.[0]?.draftReview?.items).toEqual(draftedOutput.drafted);
    expect(live.toolInvocations?.[1]?.proposedPlan?.objects).toEqual([
      { name: 'candidate', label: 'Candidate', fieldCount: 2 },
      { name: 'job', fieldCount: 1 },
    ]);

    // 2. Cache it, then round-trip through JSON exactly like localStorage does.
    const cached = sanitizeChatMessagesForCache([live]);
    const persisted = JSON.parse(JSON.stringify(cached)) as typeof cached;

    // The cached tool parts keep a compact `output` (no full blueprint).
    const draftPart = persisted[0]?.parts.find((p) => p.type === 'tool-apply_blueprint');
    const planPart = persisted[0]?.parts.find((p) => p.type === 'tool-propose_blueprint');
    expect(draftPart?.output).toMatchObject({ status: 'drafted' });
    expect(planPart?.output).toMatchObject({ status: 'blueprint_proposed' });
    // Leanness: the field definitions are dropped, only the count is kept.
    expect(JSON.stringify(planPart?.output)).not.toContain('full_name');

    // 3. Cache-fallback reload re-derives the cards from the cached output.
    const reloaded = uiMessageToChatMessage(persisted[0]);

    const draftReview = reloaded.toolInvocations?.[0]?.draftReview;
    expect(draftReview).toBeDefined();
    expect(draftReview?.items).toEqual(draftedOutput.drafted);
    expect(draftReview?.summary).toBe('Built Tracker');
    expect(draftReview?.packageId).toBe('pkg_1');
    expect(draftReview?.autoPublishable).toBe(true);
    expect(draftReview?.materialized).toBe(true);
    expect(draftReview?.failedCount).toBe(1);
    expect(draftReview?.verification).toEqual({ errors: 0, warnings: 1 });
    expect(draftReview?.issues).toEqual([
      { severity: 'warning', code: 'lint_x', message: 'Consider X', fix: 'do Y' },
    ]);
    expect(draftReview?.nextSteps).toEqual([
      'Replace the sample data',
      'Publish from the status panel',
    ]);

    const proposedPlan = reloaded.toolInvocations?.[1]?.proposedPlan;
    expect(proposedPlan).toBeDefined();
    expect(proposedPlan?.objects).toEqual([
      { name: 'candidate', label: 'Candidate', fieldCount: 2 },
      { name: 'job', fieldCount: 1 },
    ]);
    expect(proposedPlan?.counts).toEqual({ objects: 2, views: 3, dashboards: 1, seedData: 2 });
    expect(proposedPlan?.questions).toEqual(['Track interviews separately?']);
    expect(proposedPlan?.assumptions).toEqual(['One pipeline for all roles']);
    expect(proposedPlan?.summary).toBe('A lightweight tracker');
    expect(proposedPlan?.targetApp).toBe('recruiting');
  });

  it('does not add an output to plain (non-draft/plan) tool invocations', () => {
    const cached = sanitizeChatMessagesForCache([
      {
        id: 'a1',
        role: 'assistant',
        content: 'Counted.',
        toolInvocations: [{ toolCallId: 'tc1', toolName: 'aggregate_data', state: 'output-available' }],
      },
    ]);
    const toolPart = cached[0]?.parts.find((p) => p.type === 'tool-aggregate_data');
    expect(toolPart).toBeDefined();
    expect('output' in (toolPart as object)).toBe(false);
  });
});

// The server persists conversations in ModelMessage format, where an assistant
// tool CALL is the literal `type:'tool-call'` with the real tool in `toolName`.
// Left as-is the chat step humanizes to "Call"; toUIMessages must remap it to
// the AI SDK UI part type `tool-<toolName>` so the title (and the toolName the
// mapper extracts) reflect the real tool after a clean server-backed reload.
describe('toUIMessages — remaps the ModelMessage tool-call part type', () => {
  it('rewrites assistant tool-call → tool-<toolName> and still merges the tool result', () => {
    const ui = toUIMessages([
      {
        id: 'a1',
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'tc1', toolName: 'apply_blueprint', input: { goal: 'tracker' } },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            output: { status: 'drafted', drafted: [{ type: 'app', name: 'tracker_app' }], summary: 'Built' },
          },
        ],
      },
    ]);

    const part = ui[0]?.parts[0];
    expect(part?.type).toBe('tool-apply_blueprint');
    expect(part?.output).toEqual({
      status: 'drafted',
      drafted: [{ type: 'app', name: 'tracker_app' }],
      summary: 'Built',
    });

    // Through the mapper the tool reads as the real tool, not "call", and its
    // draft card survives because the result merged onto the remapped part.
    const cm = uiMessageToChatMessage(ui[0]);
    expect(cm.toolInvocations?.[0]?.toolName).toBe('apply_blueprint');
    expect(cm.toolInvocations?.[0]?.draftReview?.items).toEqual([{ type: 'app', name: 'tracker_app' }]);
  });

  it('leaves a tool-call without a toolName untouched (no false remap)', () => {
    const ui = toUIMessages([
      { id: 'a1', role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'tc1' }] },
    ]);
    expect(ui[0]?.parts[0]?.type).toBe('tool-call');
  });
});

// ADR-0057 Amendment A1.b — bind-on-create re-key + the legacy-scope migration
// read. `rekeyScope` re-keys the CURRENT conversation under a new scope
// without re-resolving (build thread binds the package it just minted); the
// legacy fallback lets an app-scoped visit (`app:X:build`) adopt a thread
// still cached under the product-only scope, but ONLY when the host's
// predicate confirms the thread is actually bound to that app.
describe('useChatConversation — A1.b rekeyScope + legacy-scope fallback', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rekeyScope writes the new scope key, keeps the legacy key, and flips conversationScope', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'conv-a', messages: [] }));

    const { result, rerender } = renderHook(
      ({ scope }: { scope: string }) =>
        useChatConversation({ userId: 'u1', apiBase: API_BASE, scope }),
      { initialProps: { scope: 'build' } },
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-a'));
    expect(result.current.conversationScope).toBe('build');

    act(() => result.current.rekeyScope('app:crm:build'));

    // Same conversation id under BOTH keys — the product-only key is
    // deliberately left intact (dock/FAB still resolve through it).
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:app:crm:build`)).toBe('conv-a');
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:build`)).toBe('conv-a');
    rerender({ scope: 'build' }); // conversationScope is ref-backed; read after a render
    expect(result.current.conversationScope).toBe('app:crm:build');
  });

  it('a scope change to the rekeyed scope resumes the SAME conversation without re-resolving', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'conv-a', messages: [] }));

    const { result, rerender } = renderHook(
      ({ scope }: { scope: string }) =>
        useChatConversation({ userId: 'u1', apiBase: API_BASE, scope }),
      { initialProps: { scope: 'build' } },
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-a'));
    const callsBefore = fetchMock.mock.calls.length;

    // The host rekeys and THEN flips its scope (the ?package= navigate) — the
    // resolve guard must treat the new scope as already-resolved: same id, no
    // create, no refetch, and crucially no setConversationId(undefined) window.
    act(() => result.current.rekeyScope('app:crm:build'));
    rerender({ scope: 'app:crm:build' });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-a');
    expect(result.current.conversationScope).toBe('app:crm:build');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    const createCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === `${API_BASE}/conversations` && c[1]?.method === 'POST',
    );
    expect(createCalls.length).toBe(1); // only the original resolve created one
  });

  it('rekeyScope is a no-op before a conversation is resolved', async () => {
    const { result } = renderHook(() =>
      useChatConversation({ userId: undefined, apiBase: API_BASE, scope: 'build' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.rekeyScope('app:crm:build'));
    expect(localStorage.getItem(`${CACHE_PREFIX}:app:crm:build`)).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX))).toEqual([]);
  });

  it('adopts the legacy-scope thread when the predicate matches (pre-A1.b migration read)', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1:build`, 'conv-legacy');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'conv-legacy',
        messages: [{ id: 'm1', role: 'user', content: 'build a crm' }],
      }),
    );
    const adoptLegacy = vi.fn(
      (messages: { parts: Array<{ text?: string }> }[]) =>
        messages.some((m) => m.parts.some((p) => p.text === 'build a crm')),
    );

    const { result } = renderHook(() =>
      useChatConversation({
        userId: 'u1',
        apiBase: API_BASE,
        scope: 'app:crm:build',
        legacyScope: 'build',
        adoptLegacy,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-legacy');
    expect(result.current.conversationScope).toBe('app:crm:build');
    expect(adoptLegacy).toHaveBeenCalled();
    // Adopted: the app scope now caches the same id; the legacy key survives.
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:app:crm:build`)).toBe('conv-legacy');
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:build`)).toBe('conv-legacy');
    // ONE fetch (the legacy GET) — no create.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-legacy`);
  });

  it('creates a fresh conversation when the predicate rejects, leaving the legacy key intact', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1:build`, 'conv-other');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-other', messages: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({
        userId: 'u1',
        apiBase: API_BASE,
        scope: 'app:crm:build',
        legacyScope: 'build',
        adoptLegacy: () => false,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-fresh');
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:app:crm:build`)).toBe('conv-fresh');
    // The legacy product-only thread was NOT hijacked or unlinked.
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1:build`)).toBe('conv-other');
  });

  it('treats a failing legacy fetch as a miss (creates fresh) instead of dead-ending', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1:build`, 'conv-legacy');
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({
        userId: 'u1',
        apiBase: API_BASE,
        scope: 'app:crm:build',
        legacyScope: 'build',
        adoptLegacy: () => true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-fresh');
  });

  it('feeds the predicate the local message cache when the server returns no history', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1:build`, 'conv-legacy');
    // The sanitized cache path (documented cache-fallback): the draft card —
    // and its packageId — may only survive locally.
    writeConversationMessagesCache('conv-legacy', [
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-apply_blueprint',
            toolCallId: 'tc1',
            toolName: 'apply_blueprint',
            state: 'output-available',
            output: { status: 'drafted', drafted: [], packageId: 'crm' },
          },
        ],
      },
    ]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-legacy', messages: [] }));
    const adoptLegacy = vi.fn(
      (messages: { parts: Array<{ output?: { packageId?: string } }> }[]) =>
        messages.some((m) => m.parts.some((p) => p.output?.packageId === 'crm')),
    );

    const { result } = renderHook(() =>
      useChatConversation({
        userId: 'u1',
        apiBase: API_BASE,
        scope: 'app:crm:build',
        legacyScope: 'build',
        adoptLegacy,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-legacy');
    expect(adoptLegacy).toHaveBeenCalled();
    // The adopted thread also hydrates from that cache (not an empty pane).
    expect(result.current.initialMessages.length).toBe(1);
  });

  it('the legacy fallback never runs when the primary scope key is cached', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1:app:crm:build`, 'conv-app');
    localStorage.setItem(`${CACHE_PREFIX}:u1:build`, 'conv-legacy');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-app', messages: [] }));
    const adoptLegacy = vi.fn(() => true);

    const { result } = renderHook(() =>
      useChatConversation({
        userId: 'u1',
        apiBase: API_BASE,
        scope: 'app:crm:build',
        legacyScope: 'build',
        adoptLegacy,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-app');
    expect(adoptLegacy).not.toHaveBeenCalled();
  });
});

// The activeId re-resolve (scope re-key / URL-mirror) can race an in-flight
// turn: the server persists messages at turn COMPLETION, so a mid-stream read
// returns none. That empty read must never wipe the messages already hydrated
// for the SAME conversation — a later pane remount would render an empty
// thread (the A1.b blanked-pane incident).
describe('useChatConversation — same-conversation empty re-read preserves hydrated messages', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps initialMessages when a scope-change refetch of the held conversation returns none', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'conv-a',
        messages: [{ id: 'm1', role: 'user', content: 'build it' }],
      }),
    );

    const { result, rerender } = renderHook(
      ({ scope }: { scope: string }) =>
        useChatConversation({ userId: 'u1', apiBase: API_BASE, scope, activeId: 'conv-a' }),
      { initialProps: { scope: 'build' } },
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-a'));
    expect(result.current.initialMessages).toHaveLength(1);

    // The A1.b re-key flips the scope; the effect re-resolves the SAME
    // activeId while the turn is still streaming server-side → no history yet.
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-a', messages: [] }));
    act(() => result.current.rekeyScope('app:crm:build'));
    rerender({ scope: 'app:crm:build' });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-a');
    // The empty mid-turn read did NOT clobber the hydrated history.
    expect(result.current.initialMessages).toHaveLength(1);
  });

  it('still replaces messages when the activeId resolves a DIFFERENT conversation', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'conv-a', messages: [{ id: 'm1', role: 'user', content: 'a' }] }),
    );
    const { result, rerender } = renderHook(
      ({ activeId }: { activeId: string }) =>
        useChatConversation({ userId: 'u1', apiBase: API_BASE, scope: 'build', activeId }),
      { initialProps: { activeId: 'conv-a' } },
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-a'));

    // Sidebar switch to an (untouched) other conversation: empty is the truth.
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-b', messages: [] }));
    rerender({ activeId: 'conv-b' });
    await waitFor(() => expect(result.current.conversationId).toBe('conv-b'));
    expect(result.current.initialMessages).toHaveLength(0);
  });
});
