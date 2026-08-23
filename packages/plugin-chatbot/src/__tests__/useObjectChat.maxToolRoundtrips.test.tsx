/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#5605 — `maxToolRoundtrips` is an authorable, documented chatbot key
 * that reaches nothing. ADR-0049 says enforce-or-remove, and the MEASUREMENT
 * decides which arm: it cannot be enforced from here.
 *
 * The installed chat runtime is `@ai-sdk/react`'s `useChat`, whose options are
 * `ChatInit` plus `{ throttle, experimental_throttle, resume }`. `ChatInit`
 * declares exactly one loop control — `sendAutomaticallyWhen`, a boolean
 * predicate — and no numeric cap under any spelling. The numeric knob was
 * removed from `useChat` in a MAJOR ("remove deprecated useChat roundtrip
 * options"), and its successor `maxSteps` was renamed through `continueUntil`
 * to `stopWhen`/`stepCountIs`, which the installed `ai` package declares only
 * on `generateText`, `streamText` and `ToolLoopAgentSettings` — all
 * server-side. ObjectUI is backend-agnostic, so it owns no server loop either.
 *
 * So this is stage 1 of a two-stage retirement: the key still parses and still
 * carries its declared shape, but authoring it now says out loud that it does
 * nothing. These tests pin all three halves of that claim, each with a control
 * that fails in the opposite direction:
 *
 *   1. AUTHORED  → one notice naming the key.   Control: UNAUTHORED → silence.
 *   2. AUTHORED  → the value still never reaches the runtime boundary (the chat
 *      POST body). Control: `model`/`conversationId` DO reach that same body in
 *      the same request, so a dead harness cannot make this pass vacuously.
 *   3. The key still round-trips through `ChatbotSchema` — deprecating it is
 *      not a breaking change for documents that already author it.
 *
 * Resolution note (why no `dist/` rebuild is needed for the cross-package leg):
 * the root vitest config aliases `@object-ui/types` → `packages/types/src` and
 * `@object-ui/types/zod` → `packages/types/src/zod/index.zod.ts`, so test 3
 * reads SOURCE and never resolves through the package's `dist/`.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatbotSchema } from '@object-ui/types/zod';
import { useObjectChat, resetMaxToolRoundtripsWarning } from '../useObjectChat';

const API = 'https://example.test/api/v1/ai/chat';

type AnyRecord = { [key: string]: unknown };
type FetchMock = { mock: { calls: unknown[][] } };

/** A minimal, well-formed Vercel AI UI-message data stream so a send completes. */
function dataStreamResponse(): Response {
  const body =
    'data: {"type":"start"}\n\n' + 'data: {"type":"finish"}\n\n' + 'data: [DONE]\n\n';
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  });
}

/** The JSON body of a captured chat POST. */
function bodyOf(fetchMock: FetchMock, callIndex: number): AnyRecord {
  const init = fetchMock.mock.calls[callIndex]?.[1] as { body?: string } | undefined;
  return JSON.parse(init?.body ?? '{}') as AnyRecord;
}

/** Every string that appears anywhere in a captured body, keys included. */
function serialize(body: AnyRecord): string {
  return JSON.stringify(body);
}

beforeEach(() => {
  resetMaxToolRoundtripsWarning();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useObjectChat — maxToolRoundtrips is inert and now says so (#5605)', () => {
  it('warns ONCE, naming the key, when an author actually sets it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rerender } = renderHook(() => useObjectChat({ api: API, maxToolRoundtrips: 3 }));
    rerender();
    rerender();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('maxToolRoundtrips');
    // The notice has to be actionable, not just a scold: it names the real knob.
    expect(message).toContain('planning.maxIterations');
  });

  it('CONTROL: stays silent when the key is not authored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useObjectChat({ api: API }));

    expect(warn).not.toHaveBeenCalled();
  });

  it('reports an authored `0` too — the cap that most looks like it should bite', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useObjectChat({ api: API, maxToolRoundtrips: 0 }));

    // A truthiness check would swallow this one.
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does NOT reach the runtime boundary — the value is absent from the chat POST', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => dataStreamResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useObjectChat({
        api: API,
        conversationId: 'conv_1',
        model: 'gpt-4o',
        maxToolRoundtrips: 3,
      }),
    );

    await act(async () => {
      result.current.sendMessage('hello');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = bodyOf(fetchMock as unknown as FetchMock, 0);

    // CONTROL FIRST — without this, "the key is absent" would also pass if the
    // request never happened or the body were empty.
    expect(body.conversationId).toBe('conv_1');
    expect(body.model).toBe('gpt-4o');

    // The measurement this whole card rests on: the authored cap travels the
    // renderer → hook path and then stops. It is on no wire.
    expect(body.maxToolRoundtrips).toBeUndefined();
    expect(serialize(body)).not.toContain('maxToolRoundtrips');
    expect(serialize(body)).not.toContain('"3"');
  });

  it('still parses: deprecating the key does not break documents that author it', () => {
    const parsed = ChatbotSchema.safeParse({
      type: 'chatbot',
      messages: [],
      api: '/api/v1/ai/chat',
      maxToolRoundtrips: 3,
    });

    expect(parsed.success).toBe(true);
    // `z.object` STRIPS unknown keys rather than rejecting them, so retention in
    // the parsed output — not the absence of an `unrecognized_keys` issue — is
    // what actually discriminates "declared" from "gone". This is the assertion
    // stage 2 is expected to flip.
    expect(parsed.success && parsed.data.maxToolRoundtrips).toBe(3);
  });
});
