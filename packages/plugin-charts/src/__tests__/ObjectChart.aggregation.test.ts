/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { aggregateRecords } from '../ObjectChart';

describe('aggregateRecords', () => {
  const records = [
    { account: 'Acme Corp', amount: 100 },
    { account: 'Acme Corp', amount: 200 },
    { account: 'Globex', amount: 150 },
    { account: 'Globex', amount: 50 },
    { account: 'Initech', amount: 300 },
  ];

  it('should aggregate using sum', () => {
    const result = aggregateRecords(records, {
      field: 'amount',
      function: 'sum',
      groupBy: 'account',
    });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.account === 'Acme Corp')?.amount).toBe(300);
    expect(result.find(r => r.account === 'Globex')?.amount).toBe(200);
    expect(result.find(r => r.account === 'Initech')?.amount).toBe(300);
  });

  it('should aggregate using count', () => {
    const result = aggregateRecords(records, {
      field: 'amount',
      function: 'count',
      groupBy: 'account',
    });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.account === 'Acme Corp')?.amount).toBe(2);
    expect(result.find(r => r.account === 'Globex')?.amount).toBe(2);
    expect(result.find(r => r.account === 'Initech')?.amount).toBe(1);
  });

  it('should aggregate using avg', () => {
    const result = aggregateRecords(records, {
      field: 'amount',
      function: 'avg',
      groupBy: 'account',
    });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.account === 'Acme Corp')?.amount).toBe(150);
    expect(result.find(r => r.account === 'Globex')?.amount).toBe(100);
    expect(result.find(r => r.account === 'Initech')?.amount).toBe(300);
  });

  it('should aggregate using min', () => {
    const result = aggregateRecords(records, {
      field: 'amount',
      function: 'min',
      groupBy: 'account',
    });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.account === 'Acme Corp')?.amount).toBe(100);
    expect(result.find(r => r.account === 'Globex')?.amount).toBe(50);
  });

  it('should aggregate using max', () => {
    const result = aggregateRecords(records, {
      field: 'amount',
      function: 'max',
      groupBy: 'account',
    });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.account === 'Acme Corp')?.amount).toBe(200);
    expect(result.find(r => r.account === 'Globex')?.amount).toBe(150);
  });

  it('should handle records with missing groupBy field', () => {
    const input = [
      { account: 'Acme', amount: 100 },
      { amount: 200 }, // missing account
    ];

    const result = aggregateRecords(input, {
      field: 'amount',
      function: 'sum',
      groupBy: 'account',
    });

    expect(result).toHaveLength(2);
    expect(result.find(r => r.account === 'Acme')?.amount).toBe(100);
    expect(result.find(r => r.account === 'Unknown')?.amount).toBe(200);
  });

  it('should handle empty records', () => {
    const result = aggregateRecords([], {
      field: 'amount',
      function: 'sum',
      groupBy: 'account',
    });

    expect(result).toEqual([]);
  });

  it('should handle non-numeric values gracefully', () => {
    const input = [
      { account: 'Acme', amount: 'not-a-number' },
      { account: 'Acme', amount: 100 },
    ];

    const result = aggregateRecords(input, {
      field: 'amount',
      function: 'sum',
      groupBy: 'account',
    });

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100); // NaN coerced to 0, then 0 + 100
  });
});
