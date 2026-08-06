/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The write-warning toast — objectui#3484, points B and C.
 *
 * Two things were wrong with the message the shell raised when a save came back
 * with `droppedFields`:
 *
 *  - it named fields by their API key (`type, source_method`), which is not
 *    what the user is looking at; and
 *  - "Some fields were not saved" landed beside the save surface's own
 *    "Updated" toast, so the two read as a contradiction with nothing telling
 *    the user which had actually happened.
 *
 * It resolves labels off the object schema (the adapter caches it) and says one
 * coherent thing: saved, and here is what did not take effect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { toastWriteWarning } from '../AdapterProvider';
import type { WriteWarningEvent } from '@object-ui/data-objectstack';

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/** Stand-in for i18next: returns the caller's English default, interpolated. */
const t = (_key: string, opts?: Record<string, unknown>) => {
  const raw = String(opts?.defaultValue ?? '');
  return raw.replace('{{fields}}', String(opts?.fields ?? ''));
};

/** Identity field-label resolver (no translation bundle loaded). */
const identityLabel = (_o: string, _f: string, fallback: string) => fallback;

const ANDON_SCHEMA = {
  fields: {
    type: { label: 'Andon type' },
    source_method: { label: 'Source method' },
  },
};

const adapter = { getObjectSchema: vi.fn(async () => ANDON_SCHEMA) };

const EVENT: WriteWarningEvent = {
  operation: 'update',
  resource: 'andon',
  id: 'r1',
  droppedFields: [{ object: 'andon', fields: ['type', 'source_method'], reason: 'readonly_when' }],
};

describe('toastWriteWarning (#3484)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.getObjectSchema.mockResolvedValue(ANDON_SCHEMA);
  });

  it('names the fields by LABEL, not by API key', async () => {
    await toastWriteWarning(EVENT, t, adapter as never, identityLabel);

    expect(toast.warning).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(opts?.description).toContain('Andon type, Source method');
    expect(opts?.description).not.toContain('source_method');
  });

  it('says the record WAS saved, so it does not contradict the success toast', async () => {
    await toastWriteWarning(EVENT, t, adapter as never, identityLabel);

    const [title, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(String(title)).toMatch(/^Saved/);
    expect(String(title)).not.toMatch(/not saved/i);
    expect(String(opts?.description)).toMatch(/did not take effect/);
  });

  it('routes a label through the translation bundle when one is loaded', async () => {
    const zh = (_o: string, fieldName: string, fallback: string) =>
      fieldName === 'type' ? '安灯类型' : fallback;

    await toastWriteWarning(EVENT, t, adapter as never, zh);

    const [, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(opts?.description).toContain('安灯类型');
  });

  it('falls back to the API key when the schema does not name the field', async () => {
    adapter.getObjectSchema.mockResolvedValue({ fields: {} });

    await toastWriteWarning(EVENT, t, adapter as never, identityLabel);

    const [, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(opts?.description).toContain('type, source_method');
  });

  it('still toasts when the metadata read fails — an API key beats silence', async () => {
    adapter.getObjectSchema.mockRejectedValue(new Error('offline'));

    await toastWriteWarning(EVENT, t, adapter as never, identityLabel);

    expect(toast.warning).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(opts?.description).toContain('type, source_method');
  });

  it('uses the static read-only wording for reason `readonly`', async () => {
    await toastWriteWarning(
      { ...EVENT, droppedFields: [{ object: 'andon', fields: ['type'], reason: 'readonly' }] },
      t,
      adapter as never,
      identityLabel,
    );

    const [, opts] = vi.mocked(toast.warning).mock.calls[0];
    expect(String(opts?.description)).toMatch(/^Read-only/);
  });

  it('raises nothing for an empty event', async () => {
    await toastWriteWarning({ ...EVENT, droppedFields: [] }, t, adapter as never, identityLabel);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
