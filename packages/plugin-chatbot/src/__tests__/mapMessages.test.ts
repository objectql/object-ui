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

  it('promotes a stale input-available state to output-available when an output is present (reloaded conversations)', () => {
    // A conversation persisted mid-stream can carry `input-available` next to a
    // present output (the terminal state was never snapshotted) — without the
    // promotion a reloaded chat shows "Running" forever on a finished build.
    const out = uiMessageToChatMessage({
      id: 'm-reload',
      role: 'assistant',
      parts: [
        {
          type: 'tool-apply_blueprint',
          toolCallId: 'call_b',
          state: 'input-available',
          input: { blueprint: {} },
          output: { status: 'drafted', drafted: [{ type: 'object', name: 'job' }] },
        },
      ],
    });
    expect(out.toolInvocations?.[0]?.state).toBe('output-available');
  });

  it('keeps input-available when there is genuinely no output yet AND this is the live streaming tail', () => {
    const out = uiMessageToChatMessage(
      {
        id: 'm-live',
        role: 'assistant',
        parts: [
          { type: 'tool-apply_blueprint', toolCallId: 'call_c', state: 'input-available', input: {} },
        ],
      },
      { streaming: true },
    );
    expect(out.toolInvocations?.[0]?.state).toBe('input-available');
  });

  it('promotes a dangling input-available to Completed on a NON-streaming (historical) message, even without an output', () => {
    // The real staging incident: a reloaded build conversation showed every
    // tool stuck on "Running" because the server never snapshotted terminal
    // tool states. A tool in a turn that has ENDED cannot still be running.
    const out = uiMessageToChatMessage({
      id: 'm-history',
      role: 'assistant',
      parts: [
        { type: 'tool-add_field', toolCallId: 'call_d', state: 'input-available', input: {} },
        { type: 'tool-verify_build', toolCallId: 'call_e', state: 'input-streaming', input: {} },
      ],
    });
    expect(out.toolInvocations?.[0]?.state).toBe('output-available');
    expect(out.toolInvocations?.[1]?.state).toBe('output-available');
  });

  it('uiMessagesToChatMessages: only the streaming tail keeps a tool Running; prior messages terminalize', () => {
    const msgs = [
      {
        id: 'm-prior',
        role: 'assistant',
        parts: [{ type: 'tool-create_object', toolCallId: 'c1', state: 'input-available', input: {} }],
      },
      {
        id: 'm-tail',
        role: 'assistant',
        parts: [{ type: 'tool-add_field', toolCallId: 'c2', state: 'input-available', input: {} }],
      },
    ];
    const out = uiMessagesToChatMessages(msgs as never, { isStreaming: true });
    expect(out[0].toolInvocations?.[0]?.state).toBe('output-available'); // prior turn → terminalized
    expect(out[1].toolInvocations?.[0]?.state).toBe('input-available');  // live tail → still Running
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

  it('lifts data-chart parts into charts[] (visualize_data)', () => {
    const out = uiMessageToChatMessage({
      id: 'm8',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Here is the breakdown:' },
        {
          type: 'data-chart',
          id: 'chart-0',
          data: {
            type: 'chart',
            chartType: 'bar',
            title: 'Deals by status',
            xAxisKey: 'status',
            series: [{ dataKey: 'count', label: 'Count' }],
            data: [
              { status: 'won', count: 5 },
              { status: 'lost', count: 2 },
            ],
          },
        },
      ],
    });
    expect(out.content).toBe('Here is the breakdown:');
    expect(out.charts).toHaveLength(1);
    expect(out.charts?.[0]).toEqual({
      chartType: 'bar',
      title: 'Deals by status',
      xAxisKey: 'status',
      series: [{ dataKey: 'count', label: 'Count' }],
      data: [
        { status: 'won', count: 5 },
        { status: 'lost', count: 2 },
      ],
    });
  });

  it('keeps multiple data-chart parts in arrival order and drops series-less payloads', () => {
    const out = uiMessageToChatMessage({
      id: 'm9',
      role: 'assistant',
      parts: [
        { type: 'data-chart', id: 'c0', data: { type: 'chart', chartType: 'pie', series: [{ dataKey: 'count' }], data: [] } },
        { type: 'data-chart', id: 'c1', data: { type: 'chart', series: [], data: [] } }, // unrenderable → dropped
        { type: 'data-chart', id: 'c2', data: { type: 'chart', chartType: 'line', series: [{ dataKey: 'total' }], data: [] } },
      ],
    });
    expect(out.charts).toHaveLength(2);
    expect(out.charts?.map((c) => c.chartType)).toEqual(['pie', 'line']);
  });

  it('leaves charts undefined when there is no data-chart part', () => {
    const out = uiMessageToChatMessage({ id: 'm10', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] });
    expect(out.charts).toBeUndefined();
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
