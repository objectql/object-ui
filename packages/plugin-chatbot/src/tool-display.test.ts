// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  isRateLimitError,
  isUnsentSendError,
  parseAiQuotaError,
  sendErrorStatus,
} from './tool-display';

/** Build an error shaped like one from sendAwareFetch. */
function tagged(status: number | undefined, message = 'x'): Error {
  const e = new Error(message) as Error & { status?: number; notSent?: boolean };
  e.notSent = true;
  if (status) e.status = status;
  return e;
}

describe('isUnsentSendError', () => {
  it('is true only when the error is tagged notSent', () => {
    expect(isUnsentSendError(tagged(429))).toBe(true);
    expect(isUnsentSendError(tagged(undefined))).toBe(true);
    expect(isUnsentSendError(new Error('stream dropped'))).toBe(false);
    expect(isUnsentSendError(undefined)).toBe(false);
    expect(isUnsentSendError(null)).toBe(false);
  });
});

describe('sendErrorStatus', () => {
  it('returns the tagged HTTP status when present', () => {
    expect(sendErrorStatus(tagged(429))).toBe(429);
    expect(sendErrorStatus(tagged(503))).toBe(503);
    expect(sendErrorStatus(tagged(undefined))).toBeUndefined();
    expect(sendErrorStatus(new Error('boom'))).toBeUndefined();
  });
});

describe('isRateLimitError', () => {
  it('detects a 429 via the tagged status', () => {
    expect(isRateLimitError(tagged(429))).toBe(true);
    expect(isRateLimitError(tagged(503))).toBe(false);
  });
  it('falls back to a message probe when the status was dropped', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('rate_limited'))).toBe(true);
    expect(isRateLimitError(new Error('internal server error'))).toBe(false);
  });
});

describe('parseAiQuotaError', () => {
  const body = (extra: Record<string, unknown>) =>
    JSON.stringify({ message: 'quota', messageEn: 'Quota used up', ...extra });

  it('recognizes the free design quota refusal', () => {
    const r = parseAiQuotaError(new Error(body({ error: 'ai_design_quota_exhausted', upgrade: true })));
    expect(r).toMatchObject({ code: 'ai_design_quota_exhausted', upgrade: true, topUp: false });
  });

  it('recognizes the free data-chat trial refusal', () => {
    const r = parseAiQuotaError(new Error(body({ error: 'ai_data_chat_trial_exhausted', upgrade: true })));
    expect(r?.code).toBe('ai_data_chat_trial_exhausted');
  });

  it('recognizes the paid allowance refusal with topUp', () => {
    const r = parseAiQuotaError(new Error(body({ error: 'ai_allowance_exhausted', upgrade: false, topUp: true })));
    expect(r).toMatchObject({ code: 'ai_allowance_exhausted', upgrade: false, topUp: true });
    expect(r?.messageEn).toBe('Quota used up');
  });

  it('strips the ai-sdk "Failed after N attempts" retry prefix', () => {
    const r = parseAiQuotaError(
      new Error(`Failed after 2 attempts. Last error: ${body({ error: 'ai_allowance_exhausted' })}`),
    );
    expect(r?.code).toBe('ai_allowance_exhausted');
  });

  it('returns null for unrelated errors', () => {
    expect(parseAiQuotaError(new Error('network timeout'))).toBeNull();
    expect(parseAiQuotaError(new Error(JSON.stringify({ error: 'something_else' })))).toBeNull();
    expect(parseAiQuotaError(undefined)).toBeNull();
    expect(parseAiQuotaError('')).toBeNull();
  });
});
