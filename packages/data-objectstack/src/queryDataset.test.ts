/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AnalyticsQuery as SpecAnalyticsQuery,
  AnalyticsResult as SpecAnalyticsResult,
  DatasetCompareTo as SpecDatasetCompareTo,
  DatasetSelection as SpecDatasetSelection,
} from '@objectstack/spec/contracts';
import type { PercentScale as SpecPercentScale } from '@objectstack/spec/data';
import {
  ObjectStackAdapter,
  clearSharedDiscoveryCache,
  isAnalyticsNotInstalledError,
} from './index';

/** A fetch mock that answers discovery + records the dataset-query POST. */
function makeFetch(datasetResponse: { ok: boolean; status?: number; body: unknown }) {
  const calls: Array<{ url: string; init?: any }> = [];
  const fetchImpl = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('/api/v1/discovery')) {
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: { version: 'v1', routes: {} } }) } as any;
    }
    if (u.includes('/api/v1/analytics/dataset/query')) {
      return {
        ok: datasetResponse.ok,
        status: datasetResponse.status ?? (datasetResponse.ok ? 200 : 400),
        statusText: datasetResponse.ok ? 'OK' : 'Bad Request',
        json: async () => datasetResponse.body,
      } as any;
    }
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({}) } as any;
  });
  return { fetchImpl, calls };
}

const inlineDataset = {
  name: 'sales', label: 'Sales', object: 'opportunity', include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' }],
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
};
const selection = { dimensions: ['region'], measures: ['revenue'] };

describe('ObjectStackAdapter.queryDataset', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('POSTs the inline dataset + selection and returns rows/fields', async () => {
    const { fetchImpl, calls } = makeFetch({
      ok: true,
      body: { rows: [{ region: 'NA', revenue: 100 }], fields: [{ name: 'revenue', type: 'number' }] },
    });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', token: 'tok_123', autoReconnect: false, fetch: fetchImpl as any });

    const result = await adapter.queryDataset(inlineDataset as any, selection);

    expect(result.rows).toEqual([{ region: 'NA', revenue: 100 }]);
    expect(result.fields).toEqual([{ name: 'revenue', type: 'number' }]);

    const post = calls.find((c) => c.url.includes('/analytics/dataset/query'))!;
    expect(post.url).toBe('http://localhost:3000/api/v1/analytics/dataset/query');
    expect(post.init.method).toBe('POST');
    expect(post.init.headers.Authorization).toBe('Bearer tok_123');
    expect(JSON.parse(post.init.body)).toEqual({ dataset: inlineDataset, selection });
  });

  it('sends datasetName when given a string', async () => {
    const { fetchImpl, calls } = makeFetch({ ok: true, body: { rows: [], fields: [] } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    await adapter.queryDataset('sales', selection);
    const post = calls.find((c) => c.url.includes('/analytics/dataset/query'))!;
    expect(JSON.parse(post.init.body)).toEqual({ datasetName: 'sales', selection });
  });

  it('unwraps a { success, data } envelope', async () => {
    const { fetchImpl } = makeFetch({ ok: true, body: { success: true, data: { rows: [{ x: 1 }], fields: [] } } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    const result = await adapter.queryDataset(inlineDataset as any, selection);
    expect(result.rows).toEqual([{ x: 1 }]);
  });

  it('throws (no silent fallback) with the server message on a 4xx', async () => {
    const { fetchImpl } = makeFetch({ ok: false, status: 400, body: { code: 'DATASET_INVALID', message: 'relationship not declared' } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    await expect(adapter.queryDataset(inlineDataset as any, selection)).rejects.toThrow(/relationship not declared/);
  });

  // framework#3891 retired the degraded in-kernel analytics fallback, so a
  // deployment without @objectstack/service-analytics answers 501 (REST route
  // present, no service) or 404 (framework#4019 stopped mounting the routes).
  // Neither is an authoring mistake — the caller gets a typed, readable error
  // instead of `Dataset query failed: 501 Not Implemented — …`.
  describe('analytics capability absent', () => {
    it('maps 501 NOT_IMPLEMENTED to a readable ANALYTICS_NOT_INSTALLED error', async () => {
      const { fetchImpl } = makeFetch({
        ok: false,
        status: 501,
        body: {
          code: 'NOT_IMPLEMENTED',
          message: 'Analytics dataset query is not available on this deployment (no analytics service with queryDataset).',
        },
      });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(true);
      expect(err.code).toBe('ANALYTICS_NOT_INSTALLED');
      expect(err.message).toContain('Analytics capability is not installed');
      expect(err.message).toContain('@objectstack/service-analytics');
    });

    it('maps a 404 (routes not mounted) the same way', async () => {
      const { fetchImpl } = makeFetch({ ok: false, status: 404, body: { error: 'Not found' } });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(true);
    });

    it('leaves a real compile error alone (it is NOT a missing capability)', async () => {
      const { fetchImpl } = makeFetch({ ok: false, status: 400, body: { message: 'relationship not declared in include' } });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(false);
      expect(String(err.message)).toContain('relationship not declared');
    });
  });
});

/* -------------------------------------------------------------------------- */
/* objectui#3613 — the `selection` parameter IS the spec type, not a copy.      */
/*                                                                             */
/* Compile-time pins. A violation is a `tsc --noEmit` error, not a runtime      */
/* failure: this package's tsconfig.json includes its whole `src/**` (tests     */
/* included), so these are checked by `pnpm --filter @object-ui/data-objectstack*/
/* type-check` with no separate tsconfig.typetests.json — the same property     */
/* spec-symbol-batch6.test.ts documents and relies on.                          */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

/** The declared type of `queryDataset`'s second parameter, read off the method. */
type SelectionParam = Parameters<ObjectStackAdapter['queryDataset']>[1];

describe('queryDataset(selection) is @objectstack/spec DatasetSelection itself', () => {
  it('is pinned at compile time', () => {
    type _SpecNotAny = Assert<Equal<IsAny<SpecDatasetSelection>, false>>;

    // THE pin. `Equal` rather than a two-way `extends` on purpose: a
    // restatement that merely *overlaps* the contract satisfies mutual
    // assignability in the drifted direction too (a required `dimension` is
    // still assignable TO an optional one). Structural identity is the only
    // assertion a hand copy cannot pass while drifting.
    type _IsTheSpecType = Assert<Equal<SelectionParam, SpecDatasetSelection>>;

    expect(true).toBe(true);
  });

  // The three drifts the deleted copy had accumulated, named individually so a
  // future reader learns what a restatement costs — not just that one existed.
  it('pins compareTo as the spec DatasetCompareTo, with dimension OPTIONAL', () => {
    type CompareTo = NonNullable<SelectionParam['compareTo']>;
    type _IsSpecCompareTo = Assert<Equal<CompareTo, SpecDatasetCompareTo>>;

    // objectstack#5011 made `dimension` optional BECAUSE the executor resolves
    // it (exactly one dated time dimension → that one; zero or several → a loud
    // error listing the candidates). The copy declared it required, so the
    // compiler demanded from every typed caller precisely the consumer-side
    // dimension guess that change forbids — turning a loud executor error into
    // a silently wrong comparison window.
    type _DimensionOptional = Assert<Equal<CompareTo['dimension'], string | undefined>>;
    type _DimensionWasNotRequired = Assert<Equal<Equal<CompareTo['dimension'], string>, false>>;
    // …and the shape with no `dimension` at all is a legal authoring surface.
    type _KindOnlyIsValid = Assert<
      { kind: 'previousPeriod' } extends CompareTo ? true : false
    >;

    expect(true).toBe(true);
  });

  it('pins timeDimensions at the spec shape, not `unknown[]`', () => {
    type _IsSpecTimeDimensions = Assert<
      Equal<SelectionParam['timeDimensions'], SpecAnalyticsQuery['timeDimensions']>
    >;
    type _NotUnknownArray = Assert<
      Equal<Equal<SelectionParam['timeDimensions'], unknown[] | undefined>, false>
    >;
    // The entry shape the executor's compareTo resolution reads (`dateRange`
    // present ⇒ shiftable) — invisible through `unknown[]`.
    type Entry = NonNullable<SelectionParam['timeDimensions']>[number];
    type _EntryHasDimension = Assert<Equal<Entry['dimension'], string>>;
    type _EntryHasDateRange = Assert<HasKey<Entry, 'dateRange'>>;

    expect(true).toBe(true);
  });

  it('pins runtimeFilter as a FilterCondition and carries dateGranularity', () => {
    // The copy widened `runtimeFilter` to `Record<string, unknown>`, which
    // erases the `$and`/`$or`/`$not` vocabulary the server parses.
    type _RuntimeFilterNarrowed = Assert<
      Equal<Equal<SelectionParam['runtimeFilter'], Record<string, unknown> | undefined>, false>
    >;
    type _RuntimeFilterKnowsLogicalOps = Assert<
      HasKey<NonNullable<SelectionParam['runtimeFilter']>, '$and'>
    >;

    // `dateGranularity` (framework#3588) is the drift nobody had noticed: the
    // copy never grew the key, so a typed caller could not bucket a trend by
    // month at all. A restatement does not only drift on the fields it has — it
    // also stops at whatever the contract looked like the day it was written.
    type _HasDateGranularity = Assert<HasKey<SelectionParam, 'dateGranularity'>>;
    type _DateGranularityEnum = Assert<
      Equal<
        SelectionParam['dateGranularity'],
        'day' | 'week' | 'month' | 'quarter' | 'year' | undefined
      >
    >;

    expect(true).toBe(true);
  });

  // The runtime half of the same fact: the adapter must forward `compareTo`
  // VERBATIM. If it ever "helpfully" filled a `dimension` in to satisfy its own
  // old declaration, the executor would stop resolving and every caller's
  // comparison window would depend on the adapter's guess.
  it('forwards a dimension-less compareTo to the server untouched', async () => {
    const { fetchImpl, calls } = makeFetch({ ok: true, body: { rows: [], fields: [] } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

    await adapter.queryDataset('sales', {
      dimensions: ['region'],
      measures: ['revenue'],
      timeDimensions: [{ dimension: 'closedAt', granularity: 'month', dateRange: ['2026-01-01', '2026-03-31'] }],
      compareTo: { kind: 'previousPeriod' },
    });

    const post = calls.find((c) => c.url.includes('/analytics/dataset/query'))!;
    const sent = JSON.parse(post.init.body);
    expect(sent.selection.compareTo).toEqual({ kind: 'previousPeriod' });
    expect(sent.selection.compareTo).not.toHaveProperty('dimension');
  });
});

/* -------------------------------------------------------------------------- */
/* objectui#3752 — the RESULT's `fields` element is the spec type, not a copy.  */
/*                                                                             */
/* Same drift family as #3613 above, on the other side of the call: the return  */
/* type hand-listed five keys and had already stopped at the contract of the    */
/* day it was written — no `percentScale`. Compile-time pins, checked by        */
/* `pnpm --filter @object-ui/data-objectstack type-check` for the reason that   */
/* section documents (this package's tsconfig.json compiles its own tests).     */
/* -------------------------------------------------------------------------- */

/** What `queryDataset` RESOLVES to, read off the method. */
type DatasetEnvelope = Awaited<ReturnType<ObjectStackAdapter['queryDataset']>>;
/** …and the declared shape of one result column. */
type ResultField = DatasetEnvelope['fields'][number];

describe('queryDataset result fields ARE @objectstack/spec AnalyticsResult fields', () => {
  it('is pinned at compile time', () => {
    type _SpecNotAny = Assert<Equal<IsAny<SpecAnalyticsResult>, false>>;

    // THE pin: structural identity with the spec's element, so the declaration
    // cannot lag the contract again. `Equal` rather than `extends` for the
    // #3613 reason — a narrower copy stays assignable while drifting.
    type _IsTheSpecField = Assert<Equal<ResultField, SpecAnalyticsResult['fields'][number]>>;

    // The single key the deleted copy was missing, named so a reader learns
    // WHICH omission cost something rather than merely that one existed.
    type _HasPercentScale = Assert<HasKey<ResultField, 'percentScale'>>;
    type _PercentScaleIsTheSpecUnion = Assert<
      Equal<ResultField['percentScale'], SpecPercentScale | undefined>
    >;
    // …and not a widened `string`: 'fraction' | 'whole' is the whole point —
    // a renderer branches on it instead of guessing from the value (#3136).
    type _PercentScaleIsNotString = Assert<
      Equal<Equal<ResultField['percentScale'], string | undefined>, false>
    >;

    // The exact shape this replaced, kept as a NEGATIVE pin: restoring the
    // hand-written five keys turns this red, so the sabotage direction is
    // recorded in the test rather than in a commit message.
    type _NotTheFiveKeyCopy = Assert<
      Equal<
        Equal<ResultField, { name: string; type: string; label?: string; format?: string; currency?: string }>,
        false
      >
    >;

    expect(true).toBe(true);
  });

  // Why only `fields` is spec-owned and the envelope is not (objectui#3752
  // direction B). The REST route answers `AnalyticsResult` PLUS ADR-0021 D2
  // drill sidecars, but this method rebuilds its own object from the payload
  // and never copies `sql` — so declaring the envelope as `AnalyticsResult &
  // {…}` would advertise a key the adapter structurally cannot return.
  it('pins the envelope as NOT an AnalyticsResult (no `sql`)', () => {
    type _NoSql = Assert<Equal<HasKey<DatasetEnvelope, 'sql'>, false>>;
    // The drill sidecars the spec type does not carry stay locally declared.
    type _HasDrillObject = Assert<HasKey<DatasetEnvelope, 'object'>>;
    type _HasDimensionFields = Assert<HasKey<DatasetEnvelope, 'dimensionFields'>>;
    type _HasDrillRawRows = Assert<HasKey<DatasetEnvelope, 'drillRawRows'>>;

    expect(true).toBe(true);
  });

  // The runtime half: a column's `percentScale` must reach the caller verbatim.
  // The adapter passes `fields` through untouched, so this guards against a
  // future "normalisation" quietly dropping the key the declaration now shows.
  it('returns a percentage column with its percentScale untouched', async () => {
    const { fetchImpl } = makeFetch({
      ok: true,
      body: {
        rows: [{ region: 'NA', winRate: 1 }],
        fields: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'winRate', type: 'number', label: 'Win rate', format: '0.0%', percentScale: 'fraction' },
        ],
      },
    });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

    const result = await adapter.queryDataset(inlineDataset as any, selection);

    // Read through the DECLARED type, not `as any`: this line is the reason the
    // issue was filed — before the fix it did not compile.
    const winRate = result.fields.find((f) => f.name === 'winRate')!;
    expect(winRate.percentScale).toBe('fraction');
    const region = result.fields.find((f) => f.name === 'region')!;
    expect(region.percentScale).toBeUndefined();
  });
});
