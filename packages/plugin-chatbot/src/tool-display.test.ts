// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { parseAiQuotaError } from './tool-display';

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
