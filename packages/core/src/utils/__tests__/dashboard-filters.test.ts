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
  DATE_RANGE_PRESETS,
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

  // ---------------------------------------------------------------------
  // framework#4475 — a `date` globalFilter's preset-name default.
  //
  // Setup → System Overview rendered EVERY KPI tile as 0 while its period
  // selector read "All time". The dashboard declares
  //   globalFilters: [{ field: 'created_at', type: 'date',
  //                     defaultValue: 'last_7_days' }]
  // and `GlobalFilterSchema.defaultValue` is `string | number | boolean`, so
  // a bare preset name is the ONLY spelling an author can write — but only
  // the built-in `dateRange` declaration was ever lifted to `{ preset }`.
  // The raw string then flowed to `buildFilterCondition`, hit its
  // "bare string date means equality" branch, and the backend compiled
  //   SELECT COUNT(*) … FROM "sys_user" WHERE created_at = $1
  // (verified against a live server) — 200 OK, zero rows, no error anywhere.
  // The same missing lift is why the control showed "All time": DateRangeFilter
  // reads `.preset`/`.from`/`.to`, all undefined on a string.
  // ---------------------------------------------------------------------
  it('[#4475] lifts a date filter\'s preset-name default to { preset }', () => {
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        { field: 'created_at', type: 'date', label: 'Date Range', defaultValue: 'last_7_days' },
      ] as any,
    });
    expect(defs[0].defaultValue).toEqual({ preset: 'last_7_days' });
  });

  it('[#4475] the lifted default produces a RANGE, never an equality', () => {
    // The end-to-end assertion: what the dashboard declares must reach the
    // query as bounds. Pre-fix this was the literal string 'last_7_days'.
    const [def] = resolveDashboardFilterDefs({
      globalFilters: [
        { field: 'created_at', type: 'date', defaultValue: 'last_7_days' },
      ] as any,
    });
    expect(buildFilterCondition(def, def.defaultValue)).toEqual({
      $gte: '{7_days_ago}',
      $lte: '{today}',
    });
    // And the widget-scoped shape a dataset widget forwards as runtimeFilter.
    expect(buildWidgetScopedFilter({ id: 'w' }, [def], { created_at: def.defaultValue })).toEqual({
      created_at: { $gte: '{7_days_ago}', $lte: '{today}' },
    });
  });

  it('[#4475] leaves a genuine ISO date default as an equality', () => {
    // The documented bare-string behaviour is unchanged — only names this
    // module actually knows as presets are lifted.
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        { field: 'created_at', type: 'date', defaultValue: '2026-01-15' },
      ] as any,
    });
    expect(defs[0].defaultValue).toBe('2026-01-15');
    expect(buildFilterCondition(defs[0], defs[0].defaultValue)).toBe('2026-01-15');
  });

  it('[#4475] does not touch non-date filters that share a preset-like default', () => {
    const defs = resolveDashboardFilterDefs({
      globalFilters: [
        { field: 'bucket', type: 'select', defaultValue: 'last_7_days' },
        { field: 'score', type: 'number', defaultValue: 7 },
      ] as any,
    });
    expect(defs[0].defaultValue).toBe('last_7_days');
    expect(defs[1].defaultValue).toBe(7);
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

  // ---------------------------------------------------------------------
  // #3151 — a date value that is neither a known preset nor an ISO date.
  //
  // The sister case of framework#4475, and the more deceptive direction of
  // the same failure: a misspelled preset ('last_7_dayz') used to fall
  // through to the "bare string means equality" branch and emit
  //   SELECT COUNT(*) … WHERE created_at = 'last_7_dayz'
  // — 200 OK, zero rows, no warning anywhere, indistinguishable from a range
  // that genuinely has no data. It is now skipped and named out loud, the
  // same strictness buildWidgetScopedFilter applies to unknown field names.
  // ---------------------------------------------------------------------
  describe('[#3151] unrecognised date values', () => {
    const withWarn = (fn: (warn: ReturnType<typeof vi.spyOn>) => void) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        fn(warn);
      } finally {
        warn.mockRestore();
      }
    };

    it('skips a misspelled preset string and warns, naming the filter and the value', () => {
      withWarn((warn) => {
        expect(buildFilterCondition(dateDef, 'last_7_dayz')).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        const msg = String(warn.mock.calls[0][0]);
        expect(msg).toContain('skipping filter "dateRange"');
        expect(msg).toContain('last_7_dayz');
        // The remedy travels with the rejection.
        expect(msg).toContain('last_7_days');
      });
    });

    it('keeps a valid ISO date string as an equality, with no warning', () => {
      withWarn((warn) => {
        expect(buildFilterCondition(dateDef, '2026-01-15')).toBe('2026-01-15');
        expect(buildFilterCondition(dateDef, '2026-01-15T08:30:00Z')).toBe('2026-01-15T08:30:00Z');
        expect(warn).not.toHaveBeenCalled();
      });
    });

    it('keeps a date-macro token as an equality, with no warning', () => {
      // Macro tokens stay symbolic in the condition and are resolved at query
      // time by resolveDateMacros — the same vocabulary PRESET_RANGES emits.
      withWarn((warn) => {
        expect(buildFilterCondition(dateDef, '{today}')).toBe('{today}');
        expect(buildFilterCondition(dateDef, '{7_days_ago}')).toBe('{7_days_ago}');
        expect(warn).not.toHaveBeenCalled();
      });
    });

    it('rejects a string that only looks like a date or a macro', () => {
      withWarn((warn) => {
        expect(buildFilterCondition(dateDef, '{last_7_dayz}')).toBeUndefined();
        expect(buildFilterCondition(dateDef, '15/01/2026')).toBeUndefined();
        expect(buildFilterCondition(dateDef, '2026-13-45')).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(3);
      });
    });

    it('[#4475 regression] a valid preset name still becomes a RANGE, with no warning', () => {
      withWarn((warn) => {
        const [def] = resolveDashboardFilterDefs({
          globalFilters: [
            { field: 'created_at', type: 'date', defaultValue: 'last_7_days' },
          ] as any,
        });
        expect(buildFilterCondition(def, def.defaultValue)).toEqual({
          $gte: '{7_days_ago}',
          $lte: '{today}',
        });
        expect(warn).not.toHaveBeenCalled();
      });
    });

    it('skips an unknown object preset and warns (was a silent drop)', () => {
      withWarn((warn) => {
        expect(buildFilterCondition(dateDef, { preset: 'last_7_dayz' })).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        const msg = String(warn.mock.calls[0][0]);
        expect(msg).toContain('skipping filter "dateRange"');
        expect(msg).toContain('unknown date range preset "last_7_dayz"');
      });
    });

    it('keeps explicit bounds when an unknown preset rides along, and says so', () => {
      withWarn((warn) => {
        expect(
          buildFilterCondition(dateDef, { preset: 'last_7_dayz', from: '2026-01-01' }),
        ).toEqual({ $gte: '2026-01-01' });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('ignoring unknown date range preset');
      });
    });

    it('drops the filter end-to-end: no runtimeFilter reaches the widget query', () => {
      withWarn((warn) => {
        // What the dashboard actually forwards as `runtimeFilter`. Pre-fix
        // this was { created_at: 'last_7_dayz' } — the zero-row query.
        const [def] = resolveDashboardFilterDefs({
          globalFilters: [
            { field: 'created_at', type: 'date', defaultValue: 'last_7_dayz' },
          ] as any,
        });
        expect(
          buildWidgetScopedFilter({ id: 'kpi_users' }, [def], { created_at: def.defaultValue }),
        ).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('last_7_dayz');
      });
    });
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

/**
 * `DATE_RANGE_PRESETS` stopped being `Object.keys(PRESET_RANGES)` and became a
 * re-export of the spec's const in objectui#4167 (objectstack#4115).
 *
 * A COPY of a const passes every value comparison — that insight is why the
 * guard's own header says reference identity is the only check that separates a
 * re-export from a fork, and it is the one assertion a `toEqual` on the member
 * list cannot make. So the first test asks `toBe`, deliberately.
 *
 * The second is the other half of the burn-down and the one with teeth at
 * runtime: the spec owns which presets EXIST, this module owns what each one
 * RESOLVES TO, and nothing but the `satisfies` in `dashboard-filters.ts` ties
 * them together. That is a compile-time pin, so it is erased here — this test
 * is what makes the same claim visible in a suite run, and what would catch a
 * future edit that re-annotated the table as `Record<string, …>` (a string index
 * signature satisfies every literal key, so the `satisfies` would go vacuously
 * green while the bounds table quietly went missing entries).
 */
describe('DATE_RANGE_PRESETS is the spec\'s list, not a copy of it', () => {
  it('is the spec\'s own array by REFERENCE, not an equal one', async () => {
    const spec = await import('@objectstack/spec/ui');
    expect(DATE_RANGE_PRESETS).toBe(spec.DATE_RANGE_PRESETS);
  });

  it('every offered preset resolves to date-macro bounds', () => {
    // `buildFilterCondition` warns and drops a preset it has no bounds for, so a
    // preset in this list with no entry in the bounds table is a filter that
    // validates clean and then selects nothing — the exact failure the spec's
    // own comment on DATE_RANGE_PRESETS describes.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const preset of DATE_RANGE_PRESETS) {
        const built = buildFilterCondition(
          { name: 'd', field: 'created_at', type: 'dateRange' },
          { preset },
        );
        expect(built, `preset "${preset}" produced no condition`).toBeDefined();
      }
      expect(
        warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('unknown date range preset')),
      ).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
