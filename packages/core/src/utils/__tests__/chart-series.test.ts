/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { buildOptionColorMap } from '../chart-series';

describe('buildOptionColorMap', () => {
  const health = [
    { label: 'Green', value: 'green', color: '#10B981', default: true },
    { label: 'Yellow', value: 'yellow', color: '#F59E0B' },
    { label: 'Red', value: 'red', color: '#EF4444' },
  ];

  it('keys each option color by BOTH its value and its label', () => {
    // A dataset row's category may carry the raw value (legacy aggregate path)
    // or the resolved label (server-resolved dataset dimensions), so both work.
    expect(buildOptionColorMap(health)).toEqual({
      green: '#10B981', Green: '#10B981',
      yellow: '#F59E0B', Yellow: '#F59E0B',
      red: '#EF4444', Red: '#EF4444',
    });
  });

  it('returns null when the field has no options', () => {
    expect(buildOptionColorMap(undefined)).toBeNull();
    expect(buildOptionColorMap(null)).toBeNull();
    expect(buildOptionColorMap([])).toBeNull();
  });

  it('returns null when no option carries a color', () => {
    expect(buildOptionColorMap([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }])).toBeNull();
  });

  it('keeps only the options that carry a color', () => {
    expect(buildOptionColorMap([{ value: 'a', color: '#111' }, { value: 'b' }])).toEqual({ a: '#111' });
  });

  it('ignores non-string colors and malformed entries', () => {
    expect(
      buildOptionColorMap([
        { value: 'a', color: 123 },
        { value: 'b', color: '' },
        null,
        'not-an-object',
        { value: 'c', color: '#0f0' },
      ]),
    ).toEqual({ c: '#0f0' });
  });
});
