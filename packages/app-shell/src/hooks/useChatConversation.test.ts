// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Hydration regression tests for the AI chat conversation loader.
 *
 * The server persists conversations in ModelMessage format: a tool CALL lives on
 * the assistant message, while its RESULT lives in a SEPARATE `tool`-role row.
 * Earlier `toUIMessages` dropped the `tool` row entirely, so the result (and the
 * ADR-0033 draft envelope it carries) was lost on reload — the build card +
 * Publish button vanished on refresh. These tests pin the fix: the result is
 * merged back onto the assistant tool-call part so the chat can rebuild the
 * draft affordances after a refresh.
 */
import { describe, it, expect } from 'vitest';
import { toUIMessages } from './useChatConversation';

describe('toUIMessages — merging tool-results onto the call (refresh survival)', () => {
  const draftEnvelope = {
    status: 'drafted',
    drafted: [
      { type: 'object', name: 'expense' },
      { type: 'app', name: 'expense_tracker' },
    ],
    packageId: 'com.workspace',
    materialized: true,
  };

  const rows = [
    { id: 'u1', role: 'user', content: 'build an expense tracker' },
    {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'text', text: "I'll build it." },
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'apply_blueprint', input: { blueprint: {} } },
      ],
    },
    {
      id: 't1',
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'call_1', toolName: 'apply_blueprint', output: draftEnvelope }],
    },
    { id: 'a2', role: 'assistant', content: 'Done!' },
  ];

  it('drops the standalone tool row but merges its output onto the assistant call part', () => {
    const out = toUIMessages(rows as never);
    // user, assistant(call), assistant(done) — the `tool` row is not rendered.
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant']);
    const callPart = out[1].parts.find((p) => p.toolCallId === 'call_1');
    expect(callPart).toBeDefined();
    expect((callPart as { output?: unknown }).output).toEqual(draftEnvelope);
    // a finished result terminalizes the call so the chip never reads "Running".
    expect((callPart as { state?: string }).state).toBe('output-available');
  });

  it('marks the call output-error when the tool result reports an error', () => {
    const errRows = [
      {
        id: 'a1',
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'c_err', toolName: 'add_field', input: {} }],
      },
      {
        id: 't1',
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'c_err', toolName: 'add_field', output: { ok: false }, errorText: 'boom' },
        ],
      },
    ];
    const out = toUIMessages(errRows as never);
    const callPart = out[0].parts.find((p) => p.toolCallId === 'c_err');
    expect((callPart as { state?: string }).state).toBe('output-error');
    expect((callPart as { errorText?: string }).errorText).toBe('boom');
  });

  it('leaves messages without tool results untouched', () => {
    const plain = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];
    const out = toUIMessages(plain as never);
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(out[1].parts).toEqual([{ type: 'text', text: 'hello' }]);
  });
});
