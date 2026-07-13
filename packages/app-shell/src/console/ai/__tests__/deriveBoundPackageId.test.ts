/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * #2458 / ADR-0057 Amendment A1.a — the package a build conversation is bound to,
 * shown as the header chip. Explicit `?package=` (Edit-with-AI) wins; otherwise
 * the most recent package a build/draft in the thread produced; undefined = the
 * not-yet-bound "New app" draft (the magic flow's start state).
 */
import { describe, it, expect } from 'vitest';
import { deriveBoundPackageId } from '../AiChatPage';
import type { ChatMessage } from '@object-ui/plugin-chatbot';

const msg = (toolInvocations: unknown[]): ChatMessage =>
  ({ id: 'm', role: 'assistant', content: '', toolInvocations } as unknown as ChatMessage);

describe('deriveBoundPackageId', () => {
  it('prefers the explicit editPackageId (Edit-with-AI) over anything in messages', () => {
    const messages = [msg([{ draftReview: { packageId: 'app.drafted' } }])];
    expect(deriveBoundPackageId(messages, 'app.edit')).toBe('app.edit');
  });

  it('unbound while nothing has been built → undefined ("New app")', () => {
    expect(deriveBoundPackageId([], undefined)).toBeUndefined();
    expect(deriveBoundPackageId([msg([{ someOther: true }])], undefined)).toBeUndefined();
  });

  it('binds to the package a build/draft produced (draftReview or builderHandoff)', () => {
    expect(deriveBoundPackageId([msg([{ draftReview: { packageId: 'app.inventory' } }])], undefined)).toBe(
      'app.inventory',
    );
    expect(deriveBoundPackageId([msg([{ builderHandoff: { prompt: 'x', packageId: 'app.crm' } }])], undefined)).toBe(
      'app.crm',
    );
  });

  it('takes the MOST RECENT package when several appear (newest wins)', () => {
    const messages = [
      msg([{ draftReview: { packageId: 'app.first' } }]),
      msg([{ draftReview: { packageId: 'app.second' } }]),
    ];
    expect(deriveBoundPackageId(messages, undefined)).toBe('app.second');
  });
});
