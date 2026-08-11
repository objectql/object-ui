/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The write-warning message — objectui#3484, points B and C.
 *
 * Two things were wrong with what the shell said when a save came back with
 * `droppedFields`:
 *
 *  - it named fields by their API key (`type, source_method`), which is not
 *    what the user is looking at; and
 *  - "Some fields were not saved" landed beside the save surface's own
 *    "Updated" toast, so the two read as a contradiction with nothing telling
 *    the user which had actually happened.
 *
 * It now resolves labels off the object schema (the adapter caches it) and says
 * one coherent thing: saved, and here is what did not take effect.
 *
 * The sink is a PARAMETER, so this suite mocks no module. That is not a style
 * preference: `vitest.config.mts` runs the `unit` project with `isolate: false`
 * (one module graph per worker), where a `vi.mock('sonner')` holds only if no
 * other file in the same worker imported the real thing first — green when the
 * run is small, red once the whole repo is in flight.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitWriteWarning, type WriteWarningSink } from './writeWarningToast';
import type { WriteWarningEvent } from '@object-ui/data-objectstack';

/** Stand-in for i18next: returns the caller's English default, interpolated. */
const t = (_key: string, opts?: Record<string, unknown>) => {
  const raw = String(opts?.defaultValue ?? '');
  return raw.replace('{{fields}}', String(opts?.fields ?? ''));
};

/** Identity field-label resolver (no translation bundle loaded). */
const identityLabel = (_o: string, _f: string, fallback: string) => fallback;

/**
 * The label lookup reads `fields[<apiKey>].label` and falls back to the key when
 * the entry is absent — so the schema shape is an OPEN map of field entries, not
 * this fixture's two specific keys. Annotated as such: without it `vi.fn` infers
 * the resolved type from this literal alone, and the `{ fields: {} }` case below
 * (the whole point of the "falls back to the API key" test) is rejected for
 * missing `type` / `source_method` (objectui#4040).
 */
type ObjectSchemaShape = { fields: Record<string, { label: string }> };

const ANDON_SCHEMA: ObjectSchemaShape = {
  fields: {
    type: { label: 'Andon type' },
    source_method: { label: 'Source method' },
  },
};

const adapter = { getObjectSchema: vi.fn(async (): Promise<ObjectSchemaShape> => ANDON_SCHEMA) };

const EVENT: WriteWarningEvent = {
  operation: 'update',
  resource: 'andon',
  id: 'r1',
  droppedFields: [{ object: 'andon', fields: ['type', 'source_method'], reason: 'readonly_when' }],
};

/** Records what the shell would have shown. */
function makeSink() {
  const calls: Array<{ title: string; description?: string }> = [];
  const sink: WriteWarningSink = {
    warning: (title, options) => { calls.push({ title, description: options?.description }); },
  };
  return { sink, calls };
}

describe('emitWriteWarning (#3484)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.getObjectSchema.mockResolvedValue(ANDON_SCHEMA);
  });

  it('names the fields by LABEL, not by API key', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, adapter as never, identityLabel, sink);

    expect(calls).toHaveLength(1);
    expect(calls[0].description).toContain('Andon type, Source method');
    expect(calls[0].description).not.toContain('source_method');
  });

  it('says the record WAS saved, so it does not contradict the success toast', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, adapter as never, identityLabel, sink);

    expect(calls[0].title).toMatch(/^Saved/);
    expect(calls[0].title).not.toMatch(/not saved/i);
    expect(calls[0].description).toMatch(/did not take effect/);
  });

  it('routes a label through the translation bundle when one is loaded', async () => {
    const { sink, calls } = makeSink();
    const zh = (_o: string, fieldName: string, fallback: string) =>
      fieldName === 'type' ? '安灯类型' : fallback;

    await emitWriteWarning(EVENT, t, adapter as never, zh, sink);

    expect(calls[0].description).toContain('安灯类型');
  });

  it('falls back to the API key when the schema does not name the field', async () => {
    adapter.getObjectSchema.mockResolvedValue({ fields: {} });
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, adapter as never, identityLabel, sink);

    expect(calls[0].description).toContain('type, source_method');
  });

  it('still speaks when the metadata read fails — an API key beats silence', async () => {
    adapter.getObjectSchema.mockRejectedValue(new Error('offline'));
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, adapter as never, identityLabel, sink);

    expect(calls).toHaveLength(1);
    expect(calls[0].description).toContain('type, source_method');
  });

  it('uses the static read-only wording for reason `readonly`', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(
      { ...EVENT, droppedFields: [{ object: 'andon', fields: ['type'], reason: 'readonly' }] },
      t,
      adapter as never,
      identityLabel,
      sink,
    );

    expect(calls[0].description).toMatch(/^Read-only/);
  });

  it('says nothing for an empty event', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning({ ...EVENT, droppedFields: [] }, t, adapter as never, identityLabel, sink);

    expect(calls).toEqual([]);
  });

  it('falls back to API keys when there is no adapter to read metadata from', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, null, identityLabel, sink);

    expect(calls[0].description).toContain('type, source_method');
    expect(adapter.getObjectSchema).not.toHaveBeenCalled();
  });
});
