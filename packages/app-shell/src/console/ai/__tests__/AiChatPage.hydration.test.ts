// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { hydratedMessagesToChatMessages } from '../AiChatPage';
import {
  aiMessageRowsToServerMessages,
  toUIMessages,
  type HydratedUIMessage,
} from '../../../hooks/useChatConversation';

function assistantWith(parts: HydratedUIMessage['parts']): HydratedUIMessage[] {
  return [{ id: 'm1', role: 'assistant', parts }];
}

describe('AiChatPage hydration — tool invocation states', () => {
  it('promotes STATELESS tool parts to output-available (server ModelMessage tool-call entries)', () => {
    // Server conversations persist ModelMessage content: `tool-call` entries
    // carry toolName/toolCallId but NO UI state. Hydrated history has ended,
    // so stateless must render Completed — not an eternal "Running" chip.
    const [msg] = hydratedMessagesToChatMessages(
      assistantWith([
        { type: 'tool-call', toolCallId: 't1', toolName: 'propose_blueprint' },
      ]),
    );
    expect(msg.toolInvocations).toEqual([
      { toolCallId: 't1', toolName: 'propose_blueprint', state: 'output-available' },
    ]);
  });

  it('promotes dangling mid-stream states to output-available', () => {
    const [msg] = hydratedMessagesToChatMessages(
      assistantWith([
        { type: 'tool-add_field', toolCallId: 't1', toolName: 'add_field', state: 'input-available' },
        { type: 'tool-create_metadata', toolCallId: 't2', toolName: 'create_metadata', state: 'input-streaming' },
      ]),
    );
    expect(msg.toolInvocations?.map((t) => t.state)).toEqual(['output-available', 'output-available']);
  });

  it('preserves genuine terminal states', () => {
    const [msg] = hydratedMessagesToChatMessages(
      assistantWith([
        { type: 'tool-add_field', toolCallId: 't1', toolName: 'add_field', state: 'output-error', errorText: 'boom' },
        { type: 'tool-verify_build', toolCallId: 't2', toolName: 'verify_build', state: 'output-denied' },
      ]),
    );
    expect(msg.toolInvocations).toEqual([
      { toolCallId: 't1', toolName: 'add_field', state: 'output-error', errorText: 'boom' },
      { toolCallId: 't2', toolName: 'verify_build', state: 'output-denied' },
    ]);
  });

  it('lifts the pre-build proposed plan so the review card survives a reload on this surface', () => {
    // propose_blueprint's `blueprint_proposed` result rides the merged tool
    // output (here the persisted `{type:text,value}` envelope). Without lifting
    // it on THIS converter the "Proposed plan" card only shows in the floating
    // chat, never on /ai/build after a refresh.
    const envelope = JSON.stringify({
      status: 'blueprint_proposed',
      blueprint: {
        summary: 'A reading list',
        assumptions: ['One shelf for now'],
        objects: [{ name: 'book', label: 'Book', fields: [{ name: 'title' }, { name: 'author' }] }],
      },
      counts: { objects: 1, views: 0, dashboards: 0, seedData: 0 },
      questions: [],
    });
    const [msg] = hydratedMessagesToChatMessages(
      assistantWith([
        {
          type: 'tool-call',
          toolCallId: 't1',
          toolName: 'propose_blueprint',
          output: { type: 'text', value: envelope },
        },
      ]),
    );
    expect(msg.toolInvocations?.[0]?.proposedPlan).toMatchObject({
      summary: 'A reading list',
      objects: [{ name: 'book', label: 'Book', fieldCount: 2 }],
      assumptions: ['One shelf for now'],
    });
  });
});

describe('shared-conversation render — flat ai_messages rows → proposed-plan card', () => {
  // Reproduces the public `/s/:token` share bug: the endpoint returns FLAT
  // `ai_messages` rows, which the read-only page must put through the SAME
  // hydrate pipeline as the live chat. Before the fix it dumped the raw
  // `{"type":"tool-result",…}` envelope as text; this pins that the full
  // raw-rows → ServerMessage → toUIMessages → map chain yields the card.
  it('recovers the Proposed plan card from the raw shared rows', () => {
    const envelope = JSON.stringify({
      status: 'blueprint_proposed',
      blueprint: {
        summary: 'A simple MES',
        assumptions: ['Single production line'],
        objects: [{ name: 'work_order', label: '工单', fields: [{ name: 'no' }, { name: 'qty' }] }],
      },
      counts: { objects: 1, views: 0, dashboards: 0, seedData: 0 },
      questions: [],
    });
    const chat = hydratedMessagesToChatMessages(
      toUIMessages(
        aiMessageRowsToServerMessages([
          { id: 'u1', role: 'user', content: '帮我开发一个mes' },
          {
            id: 'a1',
            role: 'assistant',
            content: '我来帮您开发一个MES。',
            tool_calls: JSON.stringify([
              { type: 'tool-call', toolCallId: 'c1', toolName: 'propose_blueprint', input: {} },
            ]),
          },
          {
            id: 't1',
            role: 'tool',
            tool_call_id: 'c1',
            content: JSON.stringify([
              { type: 'tool-result', toolCallId: 'c1', toolName: 'propose_blueprint', output: { type: 'text', value: envelope } },
            ]),
          },
        ]),
      ),
    );
    // No standalone tool message leaks into the transcript.
    expect(chat.map((m) => m.role)).toEqual(['user', 'assistant']);
    const assistant = chat[1];
    expect(assistant.content).toBe('我来帮您开发一个MES。');
    expect(assistant.toolInvocations?.[0]?.proposedPlan).toMatchObject({
      summary: 'A simple MES',
      objects: [{ name: 'work_order', label: '工单', fieldCount: 2 }],
      assumptions: ['Single production line'],
    });
  });
});
