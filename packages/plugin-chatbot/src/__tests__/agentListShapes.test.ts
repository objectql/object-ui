// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `GET /api/v1/ai/agents` shape tolerance (objectstack#4053).
 *
 * Two producers serve this route — the framework dispatcher's degraded fallback
 * when no AI service is registered, and cloud's `service-ai` — and it is
 * mid-migration onto the platform's declared `{ success: true, data }` envelope.
 *
 * Why this file exists rather than a comment: an unrecognised shape here does not
 * throw, warn, or log. It yields an empty list, and `useAiSurfaceEnabled` turns an
 * empty list into "hide the entire AI surface". That is ALSO the correct behaviour
 * for a seat-less user (ADR-0068) or a Community-Edition deployment with no
 * `service-ai` — so a parse miss looks exactly like the legitimate hidden state.
 * There is no downstream signal that would catch it: no failing request, no 403,
 * no visible difference. The tests are the only thing standing between an envelope
 * conversion on the server and the AI UI quietly vanishing for every user.
 *
 * Teaching the reader all three shapes BEFORE any producer converts is what lets
 * the server side move on its own schedule instead of landing in lockstep with a
 * console release.
 */

import { describe, expect, it } from 'vitest';
import { extractAgentList } from '../useAgents';

const ASK = { name: 'ask', label: 'Ask' };
const BUILD = { name: 'build', label: 'Build' };

describe('extractAgentList — every shape this route answers in', () => {
  it('reads `{ agents }` — what both producers send today', () => {
    expect(extractAgentList({ agents: [ASK, BUILD] })).toEqual([ASK, BUILD]);
  });

  it('reads a bare array', () => {
    expect(extractAgentList([ASK, BUILD])).toEqual([ASK, BUILD]);
  });

  it('reads the declared envelope with `data` as the array', () => {
    // The shape objectstack#3983 set the precedent for: `data` carries the
    // payload directly. This is the variant that silently emptied the list.
    expect(extractAgentList({ success: true, data: [ASK, BUILD] })).toEqual([ASK, BUILD]);
  });

  it('reads the declared envelope with `data: { agents }`', () => {
    // The other plausible conversion — relocating the existing payload under
    // `data` rather than flattening it. Both must read the same.
    expect(extractAgentList({ success: true, data: { agents: [ASK, BUILD] } })).toEqual([ASK, BUILD]);
  });

  it('agrees across all four shapes — the point of one extractor', () => {
    const shapes: unknown[] = [
      { agents: [ASK] },
      [ASK],
      { success: true, data: [ASK] },
      { success: true, data: { agents: [ASK] } },
    ];
    for (const s of shapes) expect(extractAgentList(s)).toEqual([ASK]);
  });
});

describe('extractAgentList — empty is a real answer, not a fallback', () => {
  it('an empty catalog stays empty in every shape', () => {
    // A seat-less user gets this legitimately (ADR-0068), so it must not be
    // conflated with a miss — but it must not throw either.
    expect(extractAgentList({ agents: [] })).toEqual([]);
    expect(extractAgentList([])).toEqual([]);
    expect(extractAgentList({ success: true, data: [] })).toEqual([]);
    expect(extractAgentList({ success: true, data: { agents: [] } })).toEqual([]);
  });

  it('never throws on a shape it does not recognise', () => {
    // Callers gate the whole AI surface on this; a throw would surface as a
    // load error rather than a hidden surface, but neither is worth a crash.
    for (const junk of [null, undefined, 0, 'nope', {}, { data: null }, { agents: 'no' }]) {
      expect(extractAgentList(junk)).toEqual([]);
    }
  });
});

describe('extractAgentList — envelope detection matches unwrapResponse', () => {
  it('keys on a BOOLEAN `success`, as the SDK does', () => {
    // `ObjectStackClient.unwrapResponse` treats a body as an envelope iff
    // `typeof body.success === 'boolean'`. Diverging from that rule is how two
    // readers of one route end up disagreeing about which shape they got.
    expect(extractAgentList({ success: true, data: [ASK] })).toEqual([ASK]);
    expect(extractAgentList({ success: false, data: [ASK] })).toEqual([ASK]);
  });

  it('does NOT treat a non-boolean `success` as an envelope', () => {
    // A payload that happens to carry a truthy `success` field is data, not an
    // envelope — unwrapping it would hide the real agents.
    expect(extractAgentList({ success: 'yes', agents: [ASK] })).toEqual([ASK]);
    expect(extractAgentList({ success: 1, agents: [ASK] })).toEqual([ASK]);
  });
});
