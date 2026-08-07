/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  toDateInputValue,
  toDateTimeInputValue,
  fromDateTimeInputValue,
} from './nativeDateValue';

/**
 * These assertions are deliberately written to hold in EVERY timezone, because
 * the bug they pin (objectui#3127) is a timezone-shaped one and a test that
 * only passes in UTC would go green on CI while the defect it guards is live
 * for every user east or west of it.
 *
 * The trick: never hardcode the expected wall clock. Assert the SHAPE the
 * native control demands, and assert that reading that shape back (as local
 * time, which is how both the browser and `new Date` read a zone-less
 * datetime) lands on the same INSTANT we started from.
 */

const localInstantOf = (bare: string) => new Date(bare).getTime();

describe('toDateInputValue', () => {
  it('keeps a leading YYYY-MM-DD verbatim, in any timezone', () => {
    // Re-parsing would read this as UTC midnight and hand back the 16th
    // anywhere west of Greenwich. The calendar day is the value here.
    expect(toDateInputValue('2026-06-17')).toBe('2026-06-17');
    expect(toDateInputValue('2026-06-17T14:30:00.000Z')).toBe('2026-06-17');
  });

  it('formats a Date to the local calendar day', () => {
    const d = new Date(2026, 5, 17, 23, 59);
    expect(toDateInputValue(d)).toBe('2026-06-17');
  });

  it('maps empty and unparseable input to an empty control', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue('not a date')).toBe('');
  });
});

describe('toDateTimeInputValue', () => {
  it('renders a UTC ISO instant as a local wall clock the control accepts', () => {
    const iso = '2026-06-17T14:30:00.000Z';
    const shown = toDateTimeInputValue(iso);

    // 1. The shape `datetime-local` demands — the whole point of #3127.
    expect(shown).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // 2. …denoting the SAME instant the record holds.
    expect(localInstantOf(shown)).toBe(new Date(iso).getTime());
  });

  it('truncates an already-local datetime to minutes without re-parsing it', () => {
    expect(toDateTimeInputValue('2026-06-17T14:30')).toBe('2026-06-17T14:30');
    expect(toDateTimeInputValue('2026-06-17T14:30:59')).toBe('2026-06-17T14:30');
    expect(toDateTimeInputValue('2026-06-17T14:30:59.123')).toBe('2026-06-17T14:30');
  });

  it('maps empty and unparseable input to an empty control', () => {
    expect(toDateTimeInputValue(null)).toBe('');
    expect(toDateTimeInputValue(undefined)).toBe('');
    expect(toDateTimeInputValue('')).toBe('');
    expect(toDateTimeInputValue('not a date')).toBe('');
  });
});

describe('fromDateTimeInputValue', () => {
  it('reads the control back on the same basis it was written', () => {
    const local = '2026-06-17T14:30';
    const stored = fromDateTimeInputValue(local);

    expect(stored).toMatch(/Z$/);
    expect(new Date(stored).getTime()).toBe(localInstantOf(local));
  });

  it('round-trips an ISO instant through the control unchanged', () => {
    // The invariant that makes the read/write pair safe: opening an editor and
    // re-picking the same minute must not move the record.
    const iso = '2026-06-17T14:30:00.000Z';
    expect(fromDateTimeInputValue(toDateTimeInputValue(iso))).toBe(iso);
  });

  it('returns an unparseable value untouched rather than blanking it', () => {
    expect(fromDateTimeInputValue('garbage')).toBe('garbage');
    expect(fromDateTimeInputValue('')).toBe('');
  });
});
