// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pins that the object designer's field IO never carries `indexed` back out
 * (objectui#4644).
 *
 * `indexed` is not a `FieldSchema` key and never was — the field-level flag
 * built no index (objectstack#2377 removed it), and since objectstack#4001
 * closed the silent-drop shape `FieldSchema.safeParse` refuses it by name:
 *
 *   Unrecognized key(s) on this field: `indexed`.
 *     • never a FieldSchema key; a field-level index flag built no index
 *       (#2377). Declare the index in the object's `indexes[]`.
 *
 * Measured on console 17.0.0 GA: the field inspector shipped an `Indexed`
 * checkbox writing the key, and saving the draft came back
 * `HTTP 422 {"code":"INVALID_METADATA"}` — the toggle stayed ticked, so every
 * later save of that object stayed blocked too.
 *
 * Retiring the control is only half of it. `readFields` deliberately preserves
 * unknown keys and every write path spreads the def it read, so a draft
 * authored before the retirement would carry the key straight back out to
 * `PUT /api/v1/meta/object/:name` with no control left on screen to clear it.
 * Stripping on load is what un-breaks those saves — which is why the pins
 * below are round-trips (`readFields` → `writeFields`), not just reads.
 *
 * Both draft shapes are covered because `readFields` normalises two of them
 * (array and record) through separate branches.
 */

import { describe, it, expect } from 'vitest';
import { readFields, writeFields, RETIRED_FIELD_KEYS } from './object-fields-io';

/** Round-trip a `draft.fields` value the way every designer write path does. */
function roundTrip(fields: unknown) {
  return writeFields(readFields(fields));
}

describe('object-fields-io · retired FieldSchema keys (objectui#4644)', () => {
  it('names `indexed` as retired', () => {
    expect([...RETIRED_FIELD_KEYS]).toEqual(['indexed']);
  });

  it('drops `indexed` from a record-shaped draft on round-trip', () => {
    const out = roundTrip({
      owner_id: { type: 'lookup', label: 'Owner', indexed: true },
    }) as Record<string, Record<string, unknown>>;

    expect('indexed' in out.owner_id).toBe(false);
    // Falsification: keyed to the tombstone, not a blanket unknown-key purge.
    expect(out.owner_id).toEqual({ type: 'lookup', label: 'Owner' });
  });

  it('drops `indexed` from an array-shaped draft on round-trip', () => {
    const out = roundTrip([
      { name: 'owner_id', type: 'lookup', label: 'Owner', indexed: true },
    ]) as Array<Record<string, unknown>>;

    expect('indexed' in out[0]).toBe(false);
    expect(out[0]).toEqual({ name: 'owner_id', type: 'lookup', label: 'Owner' });
  });

  it('drops `indexed: false` too — the key itself is what the parse rejects', () => {
    // The GA rejection is `unrecognized_keys`: it fires on the key's presence,
    // so an un-ticked-but-persisted `false` blocks the save exactly as a
    // `true` does. Leaving falsy values behind would fix only half the drafts.
    const out = roundTrip({ code: { type: 'text', indexed: false } }) as Record<
      string,
      Record<string, unknown>
    >;
    expect('indexed' in out.code).toBe(false);
  });

  it('leaves every other unknown key on the field untouched', () => {
    // The module's contract is that the inspector only edits keys it knows
    // about — a live spec key it does not render (or one a newer spec adds)
    // must survive the round-trip, or retiring one key would quietly delete
    // authored metadata.
    const out = roundTrip({
      amount: {
        type: 'currency',
        label: 'Amount',
        indexed: true,
        precision: 18,
        scale: 2,
        someFutureSpecKey: { nested: true },
      },
    }) as Record<string, Record<string, unknown>>;

    expect(out.amount).toEqual({
      type: 'currency',
      label: 'Amount',
      precision: 18,
      scale: 2,
      someFutureSpecKey: { nested: true },
    });
  });

  it('strips across every field, not just the one being edited', () => {
    // Any single edit re-serialises the WHOLE fields collection, so a poisoned
    // sibling the author never opened would otherwise keep the save blocked.
    const out = roundTrip({
      a: { type: 'text', indexed: true },
      b: { type: 'text' },
      c: { type: 'number', indexed: true },
    }) as Record<string, Record<string, unknown>>;

    expect(Object.values(out).some((d) => 'indexed' in d)).toBe(false);
    expect(Object.keys(out)).toEqual(['a', 'b', 'c']);
  });

  it('returns the original def object when there is nothing to strip', () => {
    // Cheap identity guard: the strip must not churn every field's reference
    // on every read, or memo consumers keyed on the def re-render forever.
    const clean = { type: 'text', label: 'Name' };
    const view = readFields({ name: clean });
    expect(view.entries[0].def).toEqual(clean);
  });
});
