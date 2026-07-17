/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolveDashboardFilterDefs,
  dashboardFilterVariableDefs,
  buildFilterCondition,
  buildWidgetScopedFilter,
  DATE_RANGE_FILTER_NAME,
  type DashboardFilterDef,
} from '../dashboard-filters';
import { mergeFilters } from '../merge-filters';

const regionDef: DashboardFilterDef = {
  name: 'region',
  field: 'region',
  type: 'select',
  options: [
    { value: 'EMEA', label: 'EMEA' },
    { value: 'APAC', label: 'APAC' },
    { value: 'AMER', label: 'AMER' },
  ],
};

const dateDef: DashboardFilterDef = {
  name: DATE_RANGE_FILTER_NAME,
  field: 'created_at',
  type: 'dateRange',
};

describe('resolveDashboardFilterDefs', () => {
  it('normalizes options: spec {value,label} objects AND bare-string shorthand → {value,label} pairs', () => {
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        // @objectstack/spec object form — rendering this un-normalized as a
        // React child crashed the Revenue Pulse dashboard (caught in dogfood).
        { name: 'region', field: 'region', type: 'select', options: [{ value: 'amer', label: 'AMER' }, { value: 'emea', label: 'EMEA' }] },
        // objectui bare-string shorthand.
        { name: 'status', field: 'status', type: 'select', options: ['draft', 'paid'] },
      ] as any,
    });
    expect(defs[0].options).toEqual([
      { value: 'amer', label: 'AMER' },
      { value: 'emea', label: 'EMEA' },
    ]);
    expect(defs[1].options).toEqual([
      { value: 'draft', label: 'draft' },
      { value: 'paid', label: 'paid' },
    ]);
  });

  it('maps dateRange to the reserved name with a created_at field default', () => {
    const defs = resolveDashboardFilterDefs({
      dateRange: { defaultRange: 'last_30_days' },
    });
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      name: DATE_RANGE_FILTER_NAME,
      field: 'created_at',
      type: 'dateRange',
      defaultValue: { preset: 'last_30_days' },
    });
  });

  it('honors an explicit dateRange.field and skips a custom default preset', () => {
    const defs = resolveDashboardFilterDefs({
      dateRange: { field: 'closed_at', defaultRange: 'custom' },
    });
    expect(defs[0].field).toBe('closed_at');
    expect(defs[0].defaultValue).toBeUndefined();
  });

  it('defaults a global filter name to its field and preserves declared names', () => {
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        { field: 'region' },
        { name: 'owner', field: 'owner_id', type: 'lookup' },
      ],
    });
    expect(defs.map((d) => d.name)).toEqual(['region', 'owner']);
    expect(defs[0].type).toBe('text');
    expect(defs[1].field).toBe('owner_id');
  });

  it('skips entries without a field and lets duplicate names win last', () => {
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        { field: '' } as any,
        { name: 'region', field: 'region' },
        { name: 'region', field: 'sales_region' },
      ],
    });
    expect(defs).toHaveLength(1);
    expect(defs[0].field).toBe('sales_region');
  });
});

describe('dashboardFilterVariableDefs', () => {
  it('produces page-variable definitions keyed by filter name', () => {
    const vars = dashboardFilterVariableDefs([dateDef, regionDef]);
    expect(vars).toEqual([
      { name: DATE_RANGE_FILTER_NAME, type: 'object', defaultValue: undefined },
      { name: 'region', type: 'string', defaultValue: undefined },
    ]);
  });
});

describe('buildFilterCondition', () => {
  it('maps a date preset to symbolic macro-token bounds', () => {
    expect(buildFilterCondition(dateDef, { preset: 'last_30_days' })).toEqual({
      $gte: '{30_days_ago}',
      $lte: '{today}',
    });
    expect(buildFilterCondition(dateDef, { preset: 'this_month' })).toEqual({
      $gte: '{current_month_start}',
      $lte: '{current_month_end}',
    });
  });

  it('passes custom ISO bounds through and omits a missing bound', () => {
    expect(buildFilterCondition(dateDef, { from: '2026-01-01', to: '2026-06-30' })).toEqual({
      $gte: '2026-01-01',
      $lte: '2026-06-30',
    });
    expect(buildFilterCondition(dateDef, { from: '2026-01-01' })).toEqual({
      $gte: '2026-01-01',
    });
  });

  it('maps select values to equality and arrays to $in', () => {
    expect(buildFilterCondition(regionDef, 'EMEA')).toBe('EMEA');
    expect(buildFilterCondition(regionDef, ['EMEA', 'APAC'])).toEqual({ $in: ['EMEA', 'APAC'] });
  });

  it('maps text to $contains and numbers to equality', () => {
    expect(buildFilterCondition({ name: 'q', field: 'name', type: 'text' }, 'acme')).toEqual({
      $contains: 'acme',
    });
    expect(buildFilterCondition({ name: 'n', field: 'amount', type: 'number' }, 42)).toBe(42);
  });

  it('returns undefined for empty values', () => {
    expect(buildFilterCondition(regionDef, undefined)).toBeUndefined();
    expect(buildFilterCondition(regionDef, '')).toBeUndefined();
    expect(buildFilterCondition(regionDef, [])).toBeUndefined();
    expect(buildFilterCondition(dateDef, {})).toBeUndefined();
    expect(buildFilterCondition(dateDef, { preset: undefined })).toBeUndefined();
  });
});

describe('buildWidgetScopedFilter', () => {
  const defs = [dateDef, regionDef];

  it('applies the default binding (the filter\'s own field)', () => {
    const scoped = buildWidgetScopedFilter({ id: 'w1' }, defs, { region: 'EMEA' });
    expect(scoped).toEqual({ region: 'EMEA' });
  });

  it('lets filterBindings override the target field per widget', () => {
    const scoped = buildWidgetScopedFilter(
      { id: 'w1', filterBindings: { dateRange: 'signed_at', region: 'sales_region' } },
      defs,
      { dateRange: { preset: 'last_7_days' }, region: 'APAC' },
    );
    expect(scoped).toEqual({
      $and: [
        { signed_at: { $gte: '{7_days_ago}', $lte: '{today}' } },
        { sales_region: 'APAC' },
      ],
    });
  });

  it('opts a widget out with filterBindings: false', () => {
    const scoped = buildWidgetScopedFilter(
      { id: 'w1', filterBindings: { region: false } },
      defs,
      { region: 'EMEA' },
    );
    expect(scoped).toBeUndefined();
  });

  it('honors the legacy targetWidgets allow-list for default bindings', () => {
    const gated: DashboardFilterDef = { ...regionDef, targetWidgets: ['w2'] };
    expect(buildWidgetScopedFilter({ id: 'w1' }, [gated], { region: 'EMEA' })).toBeUndefined();
    expect(buildWidgetScopedFilter({ id: 'w2' }, [gated], { region: 'EMEA' })).toEqual({
      region: 'EMEA',
    });
    // Explicit binding wins over the allow-list.
    expect(
      buildWidgetScopedFilter({ id: 'w1', filterBindings: { region: 'area' } }, [gated], {
        region: 'EMEA',
      }),
    ).toEqual({ area: 'EMEA' });
  });

  it('combines several active filters with $and and returns undefined when none apply', () => {
    const scoped = buildWidgetScopedFilter({ id: 'w1' }, defs, {
      dateRange: { preset: 'today' },
      region: 'EMEA',
    });
    expect(scoped).toEqual({
      $and: [
        { created_at: { $gte: '{today}', $lte: '{today}' } },
        { region: 'EMEA' },
      ],
    });
    expect(buildWidgetScopedFilter({ id: 'w1' }, defs, {})).toBeUndefined();
  });

  it('skips a DEFAULT binding whose field is not on the object (knownFields), with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const known = new Set(['status', 'signed_at']);
      // Default region binding targets `region`, which the object lacks → skipped.
      expect(buildWidgetScopedFilter({ id: 'w1' }, [regionDef], { region: 'EMEA' }, known)).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('does not exist');
    } finally {
      warn.mockRestore();
    }
  });

  it('always honours an EXPLICIT filterBindings string, even when knownFields lacks it', () => {
    const known = new Set(['status']);
    const scoped = buildWidgetScopedFilter(
      { id: 'w1', filterBindings: { region: 'sales_region' } },
      [regionDef],
      { region: 'EMEA' },
      known,
    );
    // The author asked for that field — a typo surfaces as an empty widget,
    // never a silently-dropped filter.
    expect(scoped).toEqual({ sales_region: 'EMEA' });
  });

  it('applies no metadata check when knownFields is omitted (metadata unavailable)', () => {
    expect(buildWidgetScopedFilter({ id: 'w1' }, [regionDef], { region: 'EMEA' })).toEqual({
      region: 'EMEA',
    });
  });
});

describe('mergeFilters', () => {
  it('ANDs two non-empty filters, passes single ones through, drops empties', () => {
    expect(mergeFilters({ a: 1 }, { b: 2 })).toEqual({ $and: [{ a: 1 }, { b: 2 }] });
    expect(mergeFilters({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeFilters(undefined, { b: 2 })).toEqual({ b: 2 });
    expect(mergeFilters({}, undefined)).toBeUndefined();
  });
});
