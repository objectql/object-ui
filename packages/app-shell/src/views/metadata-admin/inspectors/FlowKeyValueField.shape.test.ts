// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { toEntries, rowsToValue, type Row } from './FlowKeyValueField';

const row = (key: string, raw: string): Row => ({ id: key, key, raw });

describe('FlowKeyValueField shape handling (#1934 — assignment array form)', () => {
  it('reads the object-map shape into entries', () => {
    expect(toEntries({ a: 1, b: 'x' })).toEqual([
      ['a', 1],
      ['b', 'x'],
    ]);
  });

  it('reads the assignment ARRAY shape ({variable|name|key, value}) into entries', () => {
    expect(toEntries([{ variable: 'lead_score', value: 0 }, { variable: 'qualified', value: false }])).toEqual([
      ['lead_score', 0],
      ['qualified', false],
    ]);
    expect(toEntries([{ name: 'a', value: 1 }, { key: 'b', value: 2 }])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('ignores a non-object / non-array value', () => {
    expect(toEntries('nope')).toEqual([]);
    expect(toEntries(null)).toEqual([]);
  });

  it('writes back the OBJECT shape, smart-parsing + de-duping', () => {
    const out = rowsToValue([row('amount', '30'), row('flag', 'true'), row('', 'skip'), row('amount', 'dupe')], false);
    expect(out).toEqual({ amount: 30, flag: true });
  });

  it('writes back the ARRAY shape, preserving [{variable, value}]', () => {
    const out = rowsToValue([row('lead_score', '0'), row('qualified', 'false'), row('ref', '{record.id}')], true);
    expect(out).toEqual([
      { variable: 'lead_score', value: 0 },
      { variable: 'qualified', value: false },
      { variable: 'ref', value: '{record.id}' },
    ]);
  });

  it('round-trips an array-shape assignment without changing its shape', () => {
    const stored = [{ variable: 'lead_score', value: 0 }, { variable: 'enrichment_data', value: null }];
    const rows = toEntries(stored).map(([k, v]) => row(k, v == null ? '' : String(v)));
    const out = rowsToValue(rows, /* arrayShape */ true);
    expect(Array.isArray(out)).toBe(true);
    expect((out as Array<Record<string, unknown>>).map((e) => e.variable)).toEqual(['lead_score', 'enrichment_data']);
  });
});
