/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `convertSortToQueryParams` — the shared sort→`$orderby` sink introduced with
 * objectstack#7137, when `object-timeline` and `record:line_items` gained sort
 * read sites and would otherwise have made a fifth and sixth private copy of the
 * conversion `ObjectGantt` / `ObjectMap` / `ObjectCalendar` each inline.
 *
 * The last two cases pin the two places this function is deliberately MORE
 * faithful to the declared contract than those copies: `SortConfig.order` is
 * optional (an entry without it means ascending, not "drop this key"), and
 * nothing usable yields `undefined` rather than a truthy-but-empty `{}`.
 */

import { describe, it, expect } from 'vitest';
import { convertSortToQueryParams } from '../sort-query';

describe('convertSortToQueryParams', () => {
  it('lowers the legacy string clause', () => {
    expect(convertSortToQueryParams('name desc')).toEqual({ name: 'desc' });
    expect(convertSortToQueryParams('name asc')).toEqual({ name: 'asc' });
    // A bare field name is ascending — same as an omitted direction.
    expect(convertSortToQueryParams('name')).toEqual({ name: 'asc' });
    // Direction casing is not the author's problem.
    expect(convertSortToQueryParams('name DESC')).toEqual({ name: 'desc' });
  });

  it('lowers a SortConfig[] preserving key order', () => {
    expect(
      convertSortToQueryParams([
        { field: 'stage', order: 'asc' },
        { field: 'amount', order: 'desc' },
      ]),
    ).toEqual({ stage: 'asc', amount: 'desc' });
    expect(
      Object.keys(
        convertSortToQueryParams([
          { field: 'stage', order: 'asc' },
          { field: 'amount', order: 'desc' },
        ])!,
      ),
    ).toEqual(['stage', 'amount']);
  });

  it('treats an entry with no `order` as ascending instead of dropping it', () => {
    // `$orderby`'s own declared shape is `Array<{ field: string; order?: … }>`,
    // so an omitted direction means ascending. The three private copies this
    // function replaces require both keys and drop such an entry, losing an
    // authored sort key.
    expect(convertSortToQueryParams([{ field: 'line_no' }])).toEqual({ line_no: 'asc' });
    expect(
      convertSortToQueryParams([{ field: 'line_no' }, { field: 'amount', order: 'desc' }]),
    ).toEqual({ line_no: 'asc', amount: 'desc' });
  });

  it('returns undefined — never an empty object — when nothing is orderable', () => {
    expect(convertSortToQueryParams(undefined)).toBeUndefined();
    expect(convertSortToQueryParams(null)).toBeUndefined();
    expect(convertSortToQueryParams('')).toBeUndefined();
    expect(convertSortToQueryParams('   ')).toBeUndefined();
    expect(convertSortToQueryParams([])).toBeUndefined();
    // Entries with no usable field name contribute nothing, and an all-unusable
    // array must not produce a truthy `{}` that a caller would send as $orderby.
    expect(convertSortToQueryParams([{ order: 'desc' }])).toBeUndefined();
    expect(convertSortToQueryParams([{ field: '' }])).toBeUndefined();
    // Shapes the schema types do not declare are refused, not guessed at.
    expect(convertSortToQueryParams(42 as any)).toBeUndefined();
    expect(convertSortToQueryParams({ name: 'desc' } as any)).toBeUndefined();
  });
});
