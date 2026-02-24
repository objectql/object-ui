/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { extractRecords } from '../extract-records';

describe('extractRecords', () => {
  const sampleData = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];

  it('should return the array directly when results is an array', () => {
    expect(extractRecords(sampleData)).toEqual(sampleData);
  });

  it('should extract from results.records', () => {
    expect(extractRecords({ records: sampleData })).toEqual(sampleData);
  });

  it('should extract from results.data', () => {
    expect(extractRecords({ data: sampleData })).toEqual(sampleData);
  });

  it('should extract from results.value', () => {
    expect(extractRecords({ value: sampleData })).toEqual(sampleData);
  });

  it('should return empty array for null/undefined', () => {
    expect(extractRecords(null)).toEqual([]);
    expect(extractRecords(undefined)).toEqual([]);
  });

  it('should return empty array for non-array/non-object', () => {
    expect(extractRecords('string')).toEqual([]);
    expect(extractRecords(42)).toEqual([]);
  });

  it('should return empty array for object without recognized keys', () => {
    expect(extractRecords({ total: 100 })).toEqual([]);
  });

  it('should prefer records over data and value', () => {
    const records = [{ id: 1 }];
    const data = [{ id: 2 }];
    expect(extractRecords({ records, data })).toEqual(records);
  });
});
