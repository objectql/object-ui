/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { normalizeQuickFilter, normalizeQuickFilters } from '../normalize-quick-filter';

describe('normalizeQuickFilter', () => {
  it('should pass through ObjectUI format unchanged', () => {
    const input = { id: 'active', label: 'Active', filters: [['status', '=', 'active']] };
    const result = normalizeQuickFilter(input);
    expect(result).toBe(input); // same reference
    expect(result.id).toBe('active');
    expect(result.label).toBe('Active');
    expect(result.filters).toEqual([['status', '=', 'active']]);
  });

  it('should convert spec format { field, operator, value } to ObjectUI format', () => {
    const result = normalizeQuickFilter({
      field: 'status',
      operator: 'eq',
      value: 'active',
      label: 'Active',
    });
    expect(result.id).toBe('status-eq-active');
    expect(result.label).toBe('Active');
    expect(result.filters).toEqual([['status', '=', 'active']]);
  });

  it('should auto-generate label when omitted', () => {
    const result = normalizeQuickFilter({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result.label).toBe('status eq active');
  });

  it('should handle null value', () => {
    const result = normalizeQuickFilter({
      field: 'archived',
      operator: 'eq',
      value: null,
      label: 'Not Archived',
    });
    expect(result.id).toBe('archived-eq-');
    expect(result.filters).toEqual([['archived', '=', null]]);
  });

  it('should map "equals" operator to "="', () => {
    const result = normalizeQuickFilter({
      field: 'status',
      operator: 'equals',
      value: 'active',
    });
    expect(result.filters).toEqual([['status', '=', 'active']]);
  });

  it('should map "gt" operator to ">"', () => {
    const result = normalizeQuickFilter({
      field: 'amount',
      operator: 'gt',
      value: 100,
    });
    expect(result.filters).toEqual([['amount', '>', 100]]);
  });

  it('should map "lte" operator to "<="', () => {
    const result = normalizeQuickFilter({
      field: 'age',
      operator: 'lte',
      value: 18,
    });
    expect(result.filters).toEqual([['age', '<=', 18]]);
  });

  it('should pass through unknown operators', () => {
    const result = normalizeQuickFilter({
      field: 'status',
      operator: 'custom_op',
      value: 'x',
    });
    expect(result.filters).toEqual([['status', 'custom_op', 'x']]);
  });

  it('should preserve icon and defaultActive', () => {
    const result = normalizeQuickFilter({
      field: 'status',
      operator: 'eq',
      value: 'active',
      label: 'Active',
      icon: 'check',
      defaultActive: true,
    });
    expect(result.icon).toBe('check');
    expect(result.defaultActive).toBe(true);
  });
});

describe('normalizeQuickFilters', () => {
  it('should return undefined for undefined input', () => {
    expect(normalizeQuickFilters(undefined)).toBeUndefined();
  });

  it('should return undefined for empty array', () => {
    expect(normalizeQuickFilters([])).toBeUndefined();
  });

  it('should normalize mixed format arrays', () => {
    const result = normalizeQuickFilters([
      { id: 'vip', label: 'VIP', filters: [['vip', '=', true]] },
      { field: 'status', operator: 'eq', value: 'active', label: 'Active' },
    ]);
    expect(result).toHaveLength(2);
    expect(result![0].id).toBe('vip');
    expect(result![1].id).toBe('status-eq-active');
    expect(result![1].filters).toEqual([['status', '=', 'active']]);
  });
});
