/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Composer send-failure UX: when a message is rejected before it reaches the
 * model (rate-limit / network — `notSent`), the typed text must be RESTORED to
 * the box (not silently dropped) and a clear inline notice shown — NOT the
 * "Response failed / Retry" banner (which would regenerate the rolled-back turn).
 * A streamed-response error still shows the banner. A clean submit clears the box.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatbotEnhanced } from '../ChatbotEnhanced';

const LABELS = {
  sendFailedRateLimited: 'RATE_LIMIT_MSG',
  sendFailedGeneric: 'GENERIC_MSG',
};

/** Tagged error shaped like one from sendAwareFetch. */
function notSentError(status?: number): Error {
  const e = new Error(status === 429 ? '{"error":"rate_limited"}' : 'boom') as Error & {
    notSent?: boolean;
    status?: number;
  };
  e.notSent = true;
  if (status) e.status = status;
  return e;
}

async function submit(text: string, onSendMessage: () => void) {
  const textarea = screen.getByPlaceholderText('Ask…') as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.submit(textarea.closest('form')!);
  // prompt-input calls onSubmit in a microtask (after blob conversion).
  await waitFor(() => expect(onSendMessage).toHaveBeenCalled());
  return textarea;
}

describe('ChatbotEnhanced send-failure UX', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('restores the input and shows a rate-limit notice on a 429 (no Retry banner)', async () => {
    const onSendMessage = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced placeholder="Ask…" onSendMessage={onSendMessage} labels={LABELS} />,
    );

    const textarea = await submit('build me a CRM', onSendMessage);
    expect(onSendMessage.mock.calls[0][0]).toBe('build me a CRM');
    // The composer optimistically cleared the box on submit…
    expect(textarea.value).toBe('');

    // …then the send is rejected with a 429.
    rerender(
      <ChatbotEnhanced
        placeholder="Ask…"
        onSendMessage={onSendMessage}
        labels={LABELS}
        error={notSentError(429)}
      />,
    );

    // ① input restored, ② clear error shown, and NOT the generic "Response failed" banner.
    await waitFor(() => expect(textarea.value).toBe('build me a CRM'));
    expect(screen.getByTestId('chat-send-error')).toHaveTextContent('RATE_LIMIT_MSG');
    expect(screen.queryByText(/Response failed/i)).not.toBeInTheDocument();
  });

  it('uses the generic notice for a non-429 not-sent failure (network / 5xx)', async () => {
    const onSendMessage = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced placeholder="Ask…" onSendMessage={onSendMessage} labels={LABELS} />,
    );
    const textarea = await submit('hello there', onSendMessage);

    rerender(
      <ChatbotEnhanced
        placeholder="Ask…"
        onSendMessage={onSendMessage}
        labels={LABELS}
        error={notSentError(503)}
      />,
    );

    await waitFor(() => expect(textarea.value).toBe('hello there'));
    expect(screen.getByTestId('chat-send-error')).toHaveTextContent('GENERIC_MSG');
  });

  it('shows the Response-failed banner (not the send notice) for a streamed-response error', async () => {
    const onSendMessage = vi.fn();
    render(
      <ChatbotEnhanced
        placeholder="Ask…"
        onSendMessage={onSendMessage}
        labels={LABELS}
        onReload={vi.fn()}
        error={new Error('stream dropped mid-turn')}
      />,
    );

    expect(screen.getByText(/Response failed/i)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-send-error')).not.toBeInTheDocument();
  });

  it('a clean submit (no error) leaves the box cleared — text is only kept on failure', async () => {
    const onSendMessage = vi.fn();
    render(<ChatbotEnhanced placeholder="Ask…" onSendMessage={onSendMessage} labels={LABELS} />);
    const textarea = await submit('all good', onSendMessage);
    // No error prop → nothing restored; the optimistic clear stands.
    expect(textarea.value).toBe('');
    expect(screen.queryByTestId('chat-send-error')).not.toBeInTheDocument();
  });
});
