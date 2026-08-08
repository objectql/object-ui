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

  // The three-dialect matrix (objectui#3491 / cloud#944). The two live producers
  // fill `error` in opposite ways and ADR-0112 declares a third shape they are
  // converging on (cloud#1168); every one of them must be readable HERE before
  // any producer moves, and every one must miss on a non-quota code.
  describe('dialect matrix', () => {
    const err = (payload: unknown) => new Error(JSON.stringify(payload));
    const CODES = [
      'ai_design_quota_exhausted',
      'ai_data_chat_trial_exhausted',
      'ai_allowance_exhausted',
    ] as const;

    describe('flat guardrail dialect — `error` holds the code', () => {
      it.each(CODES)('hits on %s', (code) => {
        expect(parseAiQuotaError(err({ error: code, message: 'zh', upgrade: true }))).toMatchObject({
          code,
          message: 'zh',
          upgrade: true,
        });
      });

      it('misses on a code outside the recognized set', () => {
        expect(parseAiQuotaError(err({ error: 'ai_quota_exhausted', message: 'zh' }))).toBeNull();
      });
    });

    describe('service-ai dialect — code in the `code` sibling key', () => {
      it.each(CODES)('hits on %s', (code) => {
        expect(
          parseAiQuotaError(err({ error: '', code, resetAt: '2026-08-09T00:00:00Z' })),
        ).toMatchObject({ code, message: '' });
      });

      it('reads the prose this dialect puts in `error` as the message', () => {
        // `error` carries the message here, so it must surface as the message —
        // and, in the flat dialect above, must NOT (it is the code there).
        const prose = 'AI allowance exhausted, retry after the reset.';
        expect(
          parseAiQuotaError(err({ error: prose, code: 'ai_allowance_exhausted' })),
        ).toMatchObject({ code: 'ai_allowance_exhausted', message: prose });
      });

      it('misses on the code service-ai emits today, which is not in the set', () => {
        // Documents a real remaining gap rather than asserting it away: the
        // shape is now readable, the vocabulary is cloud#1168's to align.
        expect(
          parseAiQuotaError(err({ error: '', code: 'ai_quota_exhausted', resetAt: 'x' })),
        ).toBeNull();
      });
    });

    describe('declared envelope (ADR-0112) — code nested under `error`', () => {
      it.each(CODES)('hits on %s', (code) => {
        expect(
          parseAiQuotaError(err({ success: false, error: { code, message: 'zh' } })),
        ).toMatchObject({ code, message: 'zh' });
      });

      it('misses on a declared non-quota code', () => {
        expect(
          parseAiQuotaError(
            err({ success: false, error: { code: 'QUOTA_EXCEEDED', message: 'zh' } }),
          ),
        ).toBeNull();
      });

      it('misses when the nested error carries no code at all', () => {
        expect(parseAiQuotaError(err({ success: false, error: { message: 'zh' } }))).toBeNull();
      });
    });

    it('degrades to today’s behavior (null) for unknown shapes', () => {
      expect(parseAiQuotaError(err({ success: false, error: null }))).toBeNull();
      expect(parseAiQuotaError(err({ success: false, error: [] }))).toBeNull();
      expect(parseAiQuotaError(err({ error: { code: 42 } }))).toBeNull();
      expect(parseAiQuotaError(err({ code: 42 }))).toBeNull();
      expect(parseAiQuotaError(new Error('{ not json }'))).toBeNull();
    });

    it('still locates a quota body embedded in surrounding text', () => {
      // Unchanged pre-existing behavior, pinned because the dialect widening
      // reads more keys off whatever this substring extraction returns: the body
      // is sliced from the first `{` to the last `}`, so a wrapper (prose, or a
      // JSON array of one error) does not hide it.
      expect(
        parseAiQuotaError(new Error('POST /api/chat 429: {"error":"ai_allowance_exhausted"}')),
      ).toMatchObject({ code: 'ai_allowance_exhausted' });
      expect(
        parseAiQuotaError(err([{ success: false, error: { code: 'ai_allowance_exhausted' } }])),
      ).toMatchObject({ code: 'ai_allowance_exhausted' });
    });

    describe('companion fields stay backward compatible', () => {
      it('reads top-level upgrade / topUp / messageEn alongside a nested code', () => {
        // The realistic transitional producer: declared envelope emitted next to
        // the legacy top-level keys old clients still read.
        expect(
          parseAiQuotaError(
            err({
              success: false,
              error: { code: 'ai_allowance_exhausted', message: 'zh' },
              messageEn: 'Allowance used up',
              upgrade: false,
              topUp: true,
            }),
          ),
        ).toMatchObject({
          code: 'ai_allowance_exhausted',
          message: 'zh',
          messageEn: 'Allowance used up',
          upgrade: false,
          topUp: true,
        });
      });

      it('defaults the CTA flags to false when a payload carries none', () => {
        // A nested-only payload gets no CTA flags: their position in the declared
        // envelope is deliberately not presumed (cloud#1168 aligns it).
        expect(
          parseAiQuotaError(err({ success: false, error: { code: 'ai_allowance_exhausted' } })),
        ).toEqual({
          code: 'ai_allowance_exhausted',
          message: '',
          messageEn: undefined,
          upgrade: false,
          topUp: false,
        });
      });
    });

    describe('parse priority is a total order', () => {
      it('prefers the declared envelope over the legacy limbs', () => {
        expect(
          parseAiQuotaError(
            err({
              success: false,
              error: { code: 'ai_design_quota_exhausted', message: 'nested' },
              code: 'ai_allowance_exhausted',
              message: 'flat',
            }),
          ),
        ).toMatchObject({ code: 'ai_design_quota_exhausted', message: 'nested' });
      });

      it('prefers the flat code over the sibling code key', () => {
        expect(
          parseAiQuotaError(
            err({ error: 'ai_design_quota_exhausted', code: 'ai_allowance_exhausted' }),
          ),
        ).toMatchObject({ code: 'ai_design_quota_exhausted' });
      });

      it('falls through to a legacy limb when the nested code is unrecognized', () => {
        expect(
          parseAiQuotaError(
            err({
              success: false,
              error: { code: 'QUOTA_EXCEEDED', message: 'nested' },
              code: 'ai_allowance_exhausted',
              message: 'flat',
            }),
          ),
        ).toMatchObject({ code: 'ai_allowance_exhausted', message: 'nested' });
      });
    });
  });
});
