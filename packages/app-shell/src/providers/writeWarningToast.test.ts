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
 * A third thing was wrong, one reason later (objectui#3935): the wording was
 * picked by a two-way conditional on `readonly_when`, so every reason the write
 * path gained afterwards was announced as read-only. The reason table is now
 * exhaustive over the spec union, and the suite pins each reason's own sentence
 * plus the skew case a `Record` cannot cover.
 *
 * The sink is a PARAMETER, so this suite mocks no module. That is not a style
 * preference: `vitest.config.mts` runs the `unit` project with `isolate: false`
 * (one module graph per worker), where a `vi.mock('sonner')` holds only if no
 * other file in the same worker imported the real thing first — green when the
 * run is small, red once the whole repo is in flight.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DroppedFieldsEventSchema } from '@objectstack/spec/data';
import { emitWriteWarning, type WriteWarningSink } from './writeWarningToast';
import type { DroppedFieldsEvent, WriteWarningEvent } from '@object-ui/data-objectstack';

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

  it('uses the state wording for reason `readonly_when`, which is NOT read-only', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(EVENT, t, adapter as never, identityLabel, sink);

    expect(calls[0].description).toMatch(/^Not editable in this record's current state/);
    expect(calls[0].description).not.toMatch(/Read-only/);
  });

  it('uses the identifier wording for reason `primary_key` (objectstack#6437)', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(
      { ...EVENT, droppedFields: [{ object: 'andon', fields: ['type'], reason: 'primary_key' }] },
      t,
      adapter as never,
      identityLabel,
      sink,
    );

    expect(calls[0].description).toMatch(/^The record's identifier cannot be changed by a save/);
    // The whole point of objectui#3935: the strip is not a read-only lock, and
    // saying so pointed the user at a permission problem that does not exist.
    expect(calls[0].description).not.toMatch(/Read-only/);
  });

  it('keeps one line per reason when a save was stripped for several', async () => {
    const { sink, calls } = makeSink();

    await emitWriteWarning(
      {
        ...EVENT,
        droppedFields: [
          { object: 'andon', fields: ['type'], reason: 'readonly' },
          { object: 'andon', fields: ['source_method'], reason: 'primary_key' },
        ],
      },
      t,
      adapter as never,
      identityLabel,
      sink,
    );

    const lines = (calls[0].description ?? '').split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Read-only, so it did not take effect: Andon type');
    expect(lines[1]).toBe(
      "The record's identifier cannot be changed by a save, so it did not take effect: Source method",
    );
  });

  /**
   * The exhaustiveness pin (objectui#3935), read off the SPEC rather than a hand
   * list that would drift: `STRIPPED_LINE` is declared
   * `Record<DroppedFieldsEvent['reason'], …>`, so an extra key is a type error
   * and a missing one is too — but `type-check` and `vitest` are different gates,
   * and the reason the ternary this replaced survived so long is that nothing in
   * the test suite could see the gap at all.
   *
   * So assert it behaviourally: drive the toast once per reason the INSTALLED
   * spec declares and require each to produce its own sentence rather than the
   * skew wording. A pin bump that widens the enum makes this red next to the
   * compile error, in the gate a wording change is normally noticed in.
   */
  it('gives every reason the pinned spec declares its own wording (#3935)', async () => {
    const reasons = DroppedFieldsEventSchema.shape.reason.options;
    expect(reasons).toContain('primary_key');

    const wordings = new Map<string, string>();
    for (const reason of reasons) {
      const { sink, calls } = makeSink();

      await emitWriteWarning(
        { ...EVENT, droppedFields: [{ object: 'andon', fields: ['type'], reason }] },
        t,
        adapter as never,
        identityLabel,
        sink,
      );

      const line = calls[0]?.description ?? '';
      expect(line, `reason \`${reason}\` has no wording of its own`).not.toMatch(
        /^Not applied by the server/,
      );
      wordings.set(reason, line);
    }

    expect(new Set(wordings.values()).size).toBe(reasons.length);
  });

  /**
   * A server ahead of this bundle's spec pin. `notifyDroppedFields` asserts the
   * wire entry into `DroppedFieldsEvent` without checking `reason` against the
   * enum, so the value really can arrive from outside the union — and the toast
   * must neither throw (the adapter calls this as `void emitWriteWarning(...)`,
   * so a rejection is unhandled and the user loses the whole toast) nor reuse a
   * wording that would state a cause it does not know.
   */
  it('names the fields and claims no cause for a reason ahead of the spec pin (#3935)', async () => {
    const aheadOfPin: string = 'some_future_reason';
    const { sink, calls } = makeSink();

    await emitWriteWarning(
      {
        ...EVENT,
        droppedFields: [
          {
            object: 'andon',
            fields: ['type'],
            reason: aheadOfPin as DroppedFieldsEvent['reason'],
          },
        ],
      },
      t,
      adapter as never,
      identityLabel,
      sink,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].description).toBe('Not applied by the server: Andon type');
    expect(calls[0].description).not.toMatch(/Read-only/);
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
