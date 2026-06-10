/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Unit tests for the UIMessage → ChatMessage mappers. These are the
 * single source of truth used by both `useObjectChat` and apps that drive
 * `@ai-sdk/react`'s `useChat()` directly (e.g. Studio's chat panel).
 */
import { describe, it, expect } from 'vitest';
import { uiMessageToChatMessage, uiMessagesToChatMessages } from '../mapMessages';

describe('uiMessageToChatMessage', () => {
  it('concatenates text parts and falls back to streaming=false by default', () => {
    const out = uiMessageToChatMessage({
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ],
    });
    expect(out).toMatchObject({
      id: 'm1',
      role: 'assistant',
      content: 'Hello world',
    });
    expect(out.streaming).toBeUndefined();
  });

  it('extracts reasoning parts into the `reasoning` field', () => {
    const out = uiMessageToChatMessage({
      id: 'm2',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Thinking step 1.' },
        { type: 'text', text: 'Answer.' },
      ],
    });
    expect(out.content).toBe('Answer.');
    expect(out.reasoning).toContain('Thinking step 1.');
  });

  it('extracts tool-* parts into ChatToolInvocation entries', () => {
    const out = uiMessageToChatMessage({
      id: 'm3',
      role: 'assistant',
      parts: [
        {
          type: 'tool-listUsers',
          toolCallId: 'call_1',
          state: 'output-available',
          input: { limit: 5 },
          output: { users: [] },
        },
      ],
    });
    expect(out.toolInvocations).toHaveLength(1);
    expect(out.toolInvocations?.[0]).toMatchObject({
      toolCallId: 'call_1',
      toolName: 'listUsers',
      state: 'output-available',
    });
  });

  it('preserves legacy msg.toolInvocations when no tool-* parts are present', () => {
    const out = uiMessageToChatMessage({
      id: 'm4',
      role: 'assistant',
      parts: [{ type: 'text', text: 'done' }],
      toolInvocations: [
        { toolCallId: 'legacy', toolName: 'foo', state: 'result', result: {} },
      ],
    });
    expect(out.toolInvocations).toHaveLength(1);
    expect(out.toolInvocations?.[0]).toMatchObject({ toolCallId: 'legacy' });
  });

  it('honours opts.streaming', () => {
    const out = uiMessageToChatMessage(
      { id: 'm5', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
      { streaming: true },
    );
    expect(out.streaming).toBe(true);
  });

  it('lifts a reconciled data-build-progress part into buildProgress', () => {
    const out = uiMessageToChatMessage({
      id: 'm6',
      role: 'assistant',
      parts: [
        {
          type: 'data-build-progress',
          id: 'build-progress',
          data: {
            phase: 'data',
            appLabel: 'CRM',
            items: [{ type: 'object', name: 'customer' }, { type: 'view', name: 'customer.list' }],
            done: 2,
            total: 6,
          },
        },
      ],
    });
    expect(out.buildProgress).toEqual({
      phase: 'data',
      appLabel: 'CRM',
      items: [{ type: 'object', name: 'customer' }, { type: 'view', name: 'customer.list' }],
      done: 2,
      total: 6,
    });
  });

  it('leaves buildProgress undefined when there is no build-progress part', () => {
    const out = uiMessageToChatMessage({ id: 'm7', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] });
    expect(out.buildProgress).toBeUndefined();
  });
});

// ADR-0033 Phase B — the chat lifts draft envelopes onto the invocation so a
// "Review N change(s)" affordance can open the designer's review/diff.
describe('draftReview detection (ADR-0033)', () => {
  const toolPart = (output: unknown) => ({
    type: 'tool-create_metadata',
    toolCallId: 'd1',
    state: 'output-available' as const,
    input: {},
    output,
  });
  const draftReviewOf = (output: unknown) =>
    uiMessageToChatMessage({ id: 'm', role: 'assistant', parts: [toolPart(output)] })
      .toolInvocations?.[0]?.draftReview;

  it('lifts a single drafted item ({status:drafted, type, name})', () => {
    const dr = draftReviewOf({ status: 'drafted', type: 'object', name: 'project', summary: 'Drafted new object "project"' });
    expect(dr).toEqual({ items: [{ type: 'object', name: 'project' }], summary: 'Drafted new object "project"' });
  });

  it('lifts a batch from apply_blueprint ({status:drafted, drafted:[…]})', () => {
    const dr = draftReviewOf({
      status: 'drafted',
      drafted: [
        { type: 'object', name: 'project' },
        { type: 'view', name: 'open_tasks' },
      ],
      failed: [],
      summary: 'drafted 2 artifact(s)',
    });
    expect(dr?.items).toEqual([
      { type: 'object', name: 'project' },
      { type: 'view', name: 'open_tasks' },
    ]);
  });

  it('parses the Vercel `{ type:text, value }` wrapper (stringified JSON)', () => {
    const dr = draftReviewOf({ type: 'text', value: JSON.stringify({ status: 'drafted', type: 'view', name: 'grid_v' }) });
    expect(dr?.items).toEqual([{ type: 'view', name: 'grid_v' }]);
  });

  it('does NOT surface blueprint_proposed (no draft yet) or plain results', () => {
    expect(draftReviewOf({ status: 'blueprint_proposed', counts: { objects: 3 } })).toBeUndefined();
    expect(draftReviewOf({ users: [] })).toBeUndefined();
    expect(draftReviewOf({ status: 'drafted' })).toBeUndefined(); // no type/name → no target
  });
});

describe('uiMessagesToChatMessages', () => {
  it('returns [] for empty / non-array input', () => {
    expect(uiMessagesToChatMessages([])).toEqual([]);
    expect(uiMessagesToChatMessages(undefined as never)).toEqual([]);
  });

  it('only flags the trailing assistant message as streaming when isStreaming=true', () => {
    const out = uiMessagesToChatMessages(
      [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
        { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'how can I help' }] },
      ],
      { isStreaming: true },
    );
    expect(out.map((m) => Boolean(m.streaming))).toEqual([false, false, true]);
  });

  it('does not flag streaming when the last message is a user turn', () => {
    const out = uiMessagesToChatMessages(
      [
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'a follow-up' }] },
      ],
      { isStreaming: true },
    );
    expect(out.map((m) => Boolean(m.streaming))).toEqual([false, false]);
  });

  it('omits streaming flag entirely when isStreaming is false', () => {
    const out = uiMessagesToChatMessages(
      [{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'done' }] }],
      { isStreaming: false },
    );
    expect(out[0]?.streaming).toBeFalsy();
  });
});
