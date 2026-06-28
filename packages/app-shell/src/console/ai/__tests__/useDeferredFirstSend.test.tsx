// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Regression tests for the AI-build empty-state FIRST-message drop.
 *
 * On a fresh `/ai/:agent` the composer goes live before `POST /conversations`
 * has minted the conversation id, and `<ChatPane>` is keyed on that id — so the
 * instant it resolves the pane REMOUNTS. A first message submitted in that
 * window used to die with the doomed pane: its optimistic bubble was discarded
 * and the just-started `…/chat` request was aborted before it reached the wire,
 * so the message vanished silently (input cleared, no bubble, no error, no
 * `…/chat`). The user had to send a second time.
 *
 * Distinct from the #2047 path, where `…/chat` WAS sent and then failed
 * (429/5xx/network) — there is a failure to recover from. Here the send never
 * happened, so these lock in that `useDeferredFirstSend` STASHES such a send and
 * REPLAYS it the moment a conversation id exists — including across the pane
 * remount — so `doSend` (which fires `…/chat`) is reliably invoked and the
 * message is never dropped.
 */
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, render, screen, fireEvent } from '@testing-library/react';
import { useDeferredFirstSend, type PendingFirstMessage } from '../AiChatPage';

const API = 'https://example.test/api/v1/ai/agents/build/chat';

function setup(initial: { chatApi?: string; conversationId?: string }) {
  const pendingRef: React.MutableRefObject<PendingFirstMessage | null> = { current: null };
  const doSend = vi.fn();
  const { result, rerender } = renderHook(
    ({ chatApi, conversationId }) =>
      useDeferredFirstSend({ chatApi, conversationId, pendingRef, doSend }),
    { initialProps: { chatApi: initial.chatApi, conversationId: initial.conversationId } },
  );
  return { result, rerender, pendingRef, doSend };
}

describe('useDeferredFirstSend', () => {
  it('defers a send made before the conversation id exists, then replays it once it lands', () => {
    const { result, rerender, pendingRef, doSend } = setup({ chatApi: API, conversationId: undefined });

    // Empty-state first send: id not minted yet → stash, do NOT send (a send now
    // would be a convId-less /chat or aborted by the imminent remount).
    act(() => result.current('please build me a CRM'));
    expect(doSend).not.toHaveBeenCalled();
    expect(pendingRef.current).toEqual({ content: 'please build me a CRM', files: undefined });

    // POST /conversations resolved → the stashed message is replayed exactly once.
    act(() => rerender({ chatApi: API, conversationId: 'c1' }));
    expect(doSend).toHaveBeenCalledTimes(1);
    expect(doSend).toHaveBeenCalledWith('please build me a CRM', undefined);
    expect(pendingRef.current).toBeNull();

    // A later id change (URL mirror / switch) must not re-fire the consumed send.
    act(() => rerender({ chatApi: API, conversationId: 'c2' }));
    expect(doSend).toHaveBeenCalledTimes(1);
  });

  it('sends straight through when a conversation id is already present', () => {
    const { result, pendingRef, doSend } = setup({ chatApi: API, conversationId: 'c1' });

    act(() => result.current('second message'));
    expect(doSend).toHaveBeenCalledTimes(1);
    expect(doSend).toHaveBeenCalledWith('second message', undefined);
    expect(pendingRef.current).toBeNull();
  });

  it('carries file attachments through the deferral', () => {
    const { result, rerender, pendingRef, doSend } = setup({ chatApi: API, conversationId: undefined });
    const file = new File(['hi'], 'spec.txt', { type: 'text/plain' });

    act(() => result.current('with a file', [file]));
    expect(doSend).not.toHaveBeenCalled();
    expect(pendingRef.current).toEqual({ content: 'with a file', files: [file] });

    act(() => rerender({ chatApi: API, conversationId: 'c1' }));
    expect(doSend).toHaveBeenCalledWith('with a file', [file]);
  });

  it('local/echo mode (no chatApi) sends immediately so the offline-demo bot still responds', () => {
    const { result, pendingRef, doSend } = setup({ chatApi: undefined, conversationId: undefined });

    act(() => result.current('hello echo'));
    expect(doSend).toHaveBeenCalledWith('hello echo', undefined);
    expect(pendingRef.current).toBeNull();
  });

  // The crux of the bug: the stash lives in the PAGE, so it survives the keyed
  // <ChatPane> remount and the replay fires in the FRESHLY-mounted pane. This
  // harness mirrors that structure — a parent owns the ref + id, the child is
  // keyed on the id (so resolving it unmounts/remounts the child).
  it('replays the first message across the id-keyed pane REMOUNT (reproduces the reported bug)', () => {
    const pendingRef: React.MutableRefObject<PendingFirstMessage | null> = { current: null };
    const doSend = vi.fn();
    let mounts = 0;

    function Pane({ conversationId }: { conversationId: string | undefined }) {
      React.useEffect(() => {
        mounts += 1;
      }, []);
      const submit = useDeferredFirstSend({ chatApi: API, conversationId, pendingRef, doSend });
      return (
        <button data-testid="send" onClick={() => submit('first message')}>
          send
        </button>
      );
    }

    function Page() {
      const [conversationId, setConversationId] = React.useState<string | undefined>(undefined);
      return (
        <>
          {/* Keyed exactly like the real <ChatPane>: pending → real id remounts it. */}
          <Pane key={conversationId ?? 'pending'} conversationId={conversationId} />
          <button data-testid="resolve" onClick={() => setConversationId('c1')}>
            resolve
          </button>
        </>
      );
    }

    render(<Page />);
    expect(mounts).toBe(1);

    // Submit while the id is still pending → deferred, nothing sent yet.
    fireEvent.click(screen.getByTestId('send'));
    expect(doSend).not.toHaveBeenCalled();
    expect(pendingRef.current).toEqual({ content: 'first message', files: undefined });

    // Conversation id resolves → the pane REMOUNTS, and the new instance replays
    // the stashed message (this is what used to be silently dropped).
    fireEvent.click(screen.getByTestId('resolve'));
    expect(mounts).toBe(2); // proves the remount actually happened
    expect(doSend).toHaveBeenCalledTimes(1);
    expect(doSend).toHaveBeenCalledWith('first message', undefined);
    expect(pendingRef.current).toBeNull();
  });
});
