/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  parseUrlFilterTriples,
  serializeDrillFilterParams,
  deleteFieldFilterParams,
  groupFilterChips,
  type FilterTriple,
} from './drillUrlFilters';

const parse = (qs: string) => parseUrlFilterTriples(new URLSearchParams(qs));

describe('parseUrlFilterTriples', () => {
  it('parses the equality shorthand', () => {
    expect(parse('filter[status]=open')).toEqual([['status', '=', 'open']]);
  });

  it('parses range/comparison operators into ObjectQL ops', () => {
    expect(parse('filter[close_date][gte]=2026-04-01&filter[close_date][lt]=2026-07-01')).toEqual([
      ['close_date', '>=', '2026-04-01'],
      ['close_date', '<', '2026-07-01'],
    ]);
  });

  it('keeps relationship-path field names intact', () => {
    expect(parse('filter[account.region]=NA')).toEqual([['account.region', '=', 'NA']]);
  });

  it('ignores an unknown operator (never downgrades it to equality)', () => {
    expect(parse('filter[x][bogus]=1')).toEqual([]);
  });

  it('skips empty values', () => {
    expect(parse('filter[status]=')).toEqual([]);
  });
});

describe('serializeDrillFilterParams', () => {
  it('serializes an equality value', () => {
    expect(serializeDrillFilterParams({ status: 'open' }).toString()).toBe('filter%5Bstatus%5D=open');
  });

  it('serializes an ObjectQL range operator object to gte/lt params', () => {
    const qs = serializeDrillFilterParams({ close_date: { $gte: '2026-04-01', $lt: '2026-07-01' } });
    expect(qs.get('filter[close_date][gte]')).toBe('2026-04-01');
    expect(qs.get('filter[close_date][lt]')).toBe('2026-07-01');
  });

  it('skips null/undefined and never stringifies an unknown object to "[object Object]"', () => {
    const qs = serializeDrillFilterParams({ a: null, b: undefined, weird: { nope: 1 } });
    expect(qs.toString()).toBe('');
  });
});

describe('round-trip: serialize → parse (write and read sides agree)', () => {
  it('a mixed equality + date-range drill filter survives the URL round-trip', () => {
    const filter = { stage: 'qualification', close_date: { $gte: '2026-06-01', $lt: '2026-07-01' } };
    const triples = parseUrlFilterTriples(serializeDrillFilterParams(filter));
    expect(triples).toEqual<FilterTriple[]>([
      ['stage', '=', 'qualification'],
      ['close_date', '>=', '2026-06-01'],
      ['close_date', '<', '2026-07-01'],
    ]);
  });
});

describe('deleteFieldFilterParams', () => {
  it('removes the equality AND both range-bound params for a field, leaving others', () => {
    const params = new URLSearchParams(
      'filter[close_date][gte]=2026-06-01&filter[close_date][lt]=2026-07-01&filter[stage]=qualification',
    );
    deleteFieldFilterParams(params, 'close_date');
    expect(params.toString()).toBe('filter%5Bstage%5D=qualification');
  });
});

describe('groupFilterChips', () => {
  it('collapses a date range into a single from → to chip', () => {
    expect(
      groupFilterChips([
        ['close_date', '>=', '2026-04-01'],
        ['close_date', '<', '2026-07-01'],
      ]),
    ).toEqual([{ field: 'close_date', text: '2026-04-01 → 2026-07-01' }]);
  });

  it('renders an equality chip and preserves field order', () => {
    expect(
      groupFilterChips([
        ['stage', '=', 'qualification'],
        ['close_date', '>=', '2026-04-01'],
        ['close_date', '<', '2026-07-01'],
      ]),
    ).toEqual([
      { field: 'stage', text: '= qualification' },
      { field: 'close_date', text: '2026-04-01 → 2026-07-01' },
    ]);
  });
});
