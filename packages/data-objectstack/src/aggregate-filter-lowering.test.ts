/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `aggregate()` lowers rule-shaped filter arrays before the analytics wire.
 *
 * WHY THIS FILE EXISTS (objectui#6302). `find()` has translated
 * `[{ field, operator, value }, ...]` into the server's filter AST since the
 * day `convertQueryParams` learned to — see `filter-entry-translation.test.ts`,
 * which runs every shape down both `find()` routes. The analytics path did not:
 * `aggregate()` assigned `payload.where = params.filter` verbatim and posted it
 * to `/analytics/query`.
 *
 * The two doors are not equally forgiving, which is why the gap had a
 * user-visible end. `lowerAnalyticsWhere` in `@objectstack/service-analytics`
 * — shared by BOTH aggregation strategies, so there is no deployment where the
 * lenient reading applies — accepts AST tuples and THROWS on an array of rule
 * objects ("[analytics] received a 'where' array that is not a filter"). The
 * spec's own `isFilterAST` gate says the same thing about the same value, and
 * the tests below assert on it directly so the refusal is pinned by the
 * contract rather than by a message string:
 *
 *   isFilterAST([{ field: 'stage', operator: 'equals', value: 'won' }])  // false
 *   isFilterAST(['stage', '=', 'won'])                                   // true
 *
 * Net effect before the fix: a stored `ViewFilterRule[]` that a LIST renders
 * correctly rendered `element:number` into its error state on every
 * analytics-capable deployment — and analytics is the default one, because the
 * CLI always loads it.
 *
 * The fix reuses `translateFilterArray` rather than adding a second lowering.
 * That is load-bearing and is asserted as such below: the cross-path parity
 * block requires `aggregate()`'s `where` and `find()`'s `filter=` to be the
 * SAME value for the same input, so the two paths cannot drift the way the two
 * `find()` routes once did. Non-array filters are deliberately untouched — the
 * MongoDB-style object this branch was written for is already what the
 * analytics endpoint accepts, and translating it would be a semantic change
 * this fix does not make.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFilterAST } from '@objectstack/spec/data';
import { ObjectStackAdapter, clearSharedDiscoveryCache, isMalformedFilterError } from './index';

/** Rows that carry the requested measure, so nothing degrades to the fallback. */
const ANALYTICS_ROWS = { rows: [{ amount_sum: 150 }] };

function makeAdapter() {
  /** Every parsed `/analytics/query` request body, in order. */
  const analyticsBodies: any[] = [];
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    urls.push(u);
    if (u.includes('/api/v1/discovery')) {
      return {
        ok: true, status: 200, statusText: 'OK',
        json: async () => ({ success: true, data: { version: 'v1', routes: {} } }),
      } as any;
    }
    if (u.includes('/api/v1/analytics/query')) {
      analyticsBodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
      return { ok: true, status: 200, statusText: 'OK', json: async () => ANALYTICS_ROWS } as any;
    }
    return {
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ success: true, data: { object: 'opportunity', records: [], total: 0 } }),
    } as any;
  });
  const adapter = new ObjectStackAdapter({
    baseUrl: 'http://localhost:3000', token: 't', autoReconnect: false, fetch: fetchImpl as any,
  });
  return { adapter, analyticsBodies, urls };
}

const SUM_BY_STAGE = { function: 'sum', field: 'amount', groupBy: '_all' };

/**
 * The `where` this filter put on the analytics wire.
 *
 * `HAS_NO_WHERE` distinguishes "the key was absent" from "the key was present
 * and undefined" — the empty-filter cases below turn on exactly that.
 */
const HAS_NO_WHERE = Symbol('no where key');

async function whereOnWire(filter: unknown): Promise<unknown> {
  const { adapter, analyticsBodies } = makeAdapter();
  await adapter.aggregate('opportunity', { ...SUM_BY_STAGE, filter });
  expect(analyticsBodies).toHaveLength(1);
  const body = analyticsBodies[0];
  return 'where' in body ? body.where : HAS_NO_WHERE;
}

/** The `filter=` the SAME value produces on the plain `find()` route. */
async function filterOnFindWire(filter: unknown): Promise<unknown> {
  const { adapter, urls } = makeAdapter();
  await adapter.find('opportunity', { $filter: filter } as any);
  const dataCall = urls.filter((u) => u.includes('/data/opportunity')).pop();
  const raw = dataCall ? new URL(dataCall).searchParams.get('filter') : null;
  return raw === null ? HAS_NO_WHERE : JSON.parse(raw);
}

describe('aggregate() lowers a rule-shaped filter array before `client.analytics.query`', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('translates a single rule into an AST tuple', async () => {
    const where = await whereOnWire([{ field: 'stage', operator: 'equals', value: 'won' }]);
    expect(where).toEqual(['stage', '=', 'won']);
  });

  it('the lowered value passes the AST gate the raw one fails', async () => {
    const rules = [{ field: 'stage', operator: 'equals', value: 'won' }];
    // Negative control: this is what used to reach the wire, and it is exactly
    // the value `lowerAnalyticsWhere` refuses. Without this line the test above
    // could pass against a lowering that produced some OTHER non-AST shape.
    expect(isFilterAST(rules)).toBe(false);
    expect(isFilterAST(await whereOnWire(rules) as any)).toBe(true);
  });

  it('maps operator aliases the way the find() path does', async () => {
    expect(await whereOnWire([{ field: 'amount', operator: 'greater_than_or_equal', value: 3 }]))
      .toEqual(['amount', '>=', 3]);
  });

  it('joins several rules with `and`', async () => {
    expect(await whereOnWire([
      { field: 'stage', operator: 'eq', value: 'won' },
      { field: 'amount', operator: 'gt', value: 100 },
    ])).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]);
  });

  it('lowers rules SPREAD into a logical node, not just top-level ones', async () => {
    // The commonest composite there is: a view's stored filter plus one the
    // user added in the panel. The head is the string `and`, so a top-level-only
    // check would call the whole thing "already AST" and ship the rule raw.
    const composite = ['and', { field: 'stage', operator: 'eq', value: 'won' }, ['amount', '>', 100]];
    expect(isFilterAST(composite as any)).toBe(false);
    const where = await whereOnWire(composite);
    expect(where).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]);
    expect(isFilterAST(where as any)).toBe(true);
  });

  it('produces the SAME `where` as the AST-tuple equivalent (the acceptance criterion)', async () => {
    const fromRules = await whereOnWire([{ field: 'stage', operator: 'equals', value: 'won' }]);
    const fromTuple = await whereOnWire(['stage', '=', 'won']);
    expect(fromRules).toEqual(fromTuple);
  });
});

describe('aggregate() leaves every already-correct filter shape byte-unchanged', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('an AST tuple passes through untouched', async () => {
    expect(await whereOnWire(['stage', '=', 'won'])).toEqual(['stage', '=', 'won']);
  });

  it('a logical AST node passes through untouched', async () => {
    expect(await whereOnWire(['or', ['stage', '=', 'won'], ['stage', '=', 'lost']]))
      .toEqual(['or', ['stage', '=', 'won'], ['stage', '=', 'lost']]);
  });

  it('a legacy nested array of nodes passes through untouched', async () => {
    expect(await whereOnWire([['stage', '=', 'won'], ['amount', '>', 100]]))
      .toEqual([['stage', '=', 'won'], ['amount', '>', 100]]);
  });

  it('a record-shaped (MongoDB-style) filter is NOT translated', async () => {
    // The shape this branch was written for. `/analytics/query` accepts it, so
    // lowering it here would be a semantic change, not a fix.
    expect(await whereOnWire({ stage: 'won' })).toEqual({ stage: 'won' });
  });

  it('a record-shaped filter with an operator object is NOT translated either', async () => {
    expect(await whereOnWire({ amount: { $gt: 100 } })).toEqual({ amount: { $gt: 100 } });
  });

  it('an empty array still reaches the wire as an empty array', async () => {
    // Unchanged on purpose: `if (params.filter)` is truthy for `[]`, and this
    // fix moves no boundary it did not have to move.
    expect(await whereOnWire([])).toEqual([]);
  });

  it('no filter means no `where` key at all', async () => {
    const { adapter, analyticsBodies } = makeAdapter();
    await adapter.aggregate('opportunity', SUM_BY_STAGE);
    expect(analyticsBodies[0]).not.toHaveProperty('where');
  });
});

describe('the find() path is unchanged, and the two paths share one lowering', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  // Each row is one input. Both sides are measured on the wire, so a change to
  // either path that the other does not make turns this red.
  const SHARED_CASES: Array<[string, unknown]> = [
    ['a single rule', [{ field: 'stage', operator: 'equals', value: 'won' }]],
    ['an aliased operator', [{ field: 'amount', operator: 'greater_than_or_equal', value: 3 }]],
    ['several rules', [
      { field: 'stage', operator: 'eq', value: 'won' },
      { field: 'amount', operator: 'gt', value: 100 },
    ]],
    ['rules spread into a logical node', ['and', { field: 'stage', operator: 'eq', value: 'won' }, ['amount', '>', 100]]],
    ['an AST tuple', ['stage', '=', 'won']],
    ['a logical AST node', ['or', ['stage', '=', 'won'], ['stage', '=', 'lost']]],
  ];

  for (const [name, filter] of SHARED_CASES) {
    it(`aggregate() and find() agree on ${name}`, async () => {
      const viaFind = await filterOnFindWire(filter);
      expect(viaFind).not.toBe(HAS_NO_WHERE);
      expect(await whereOnWire(filter)).toEqual(viaFind);
    });
  }

  it('find() still lowers a single rule exactly as it did before', async () => {
    // The `find()` half of the card's acceptance, stated independently of
    // `aggregate()` so a regression there cannot hide behind the parity rows.
    expect(await filterOnFindWire([{ field: 'stage', operator: 'equals', value: 'won' }]))
      .toEqual(['stage', '=', 'won']);
  });

  it('find() still sends no filter for an empty array', async () => {
    // The one place the two paths legitimately differ: `convertQueryParams`
    // drops an empty filter, the analytics payload keeps `[]`. Recorded, not
    // reconciled — reconciling it is a behaviour change this card does not make.
    expect(await filterOnFindWire([])).toBe(HAS_NO_WHERE);
    expect(await whereOnWire([])).toEqual([]);
  });
});

describe('a rule the adapter cannot translate refuses on the aggregate path too', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('throws the same malformed-filter refusal `find()` raises, without inventing numbers', async () => {
    // Dropping the untranslatable entry would WIDEN the result set and report
    // success — the silent over-fetch `MalformedFilterError` exists to stop.
    // Sharing the lowering means the analytics path inherits that refusal.
    const { adapter, analyticsBodies, urls } = makeAdapter();
    const err = await adapter
      .aggregate('opportunity', {
        ...SUM_BY_STAGE,
        filter: [
          { field: 'stage', operator: 'eq', value: 'won' },
          { operator: 'eq', value: 'no field here' },
        ],
      })
      .then(() => null, (e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(isMalformedFilterError(err)).toBe(true);
    // Nothing was posted to analytics, and no plausible-looking number came
    // back from the fallback instead.
    expect(analyticsBodies).toHaveLength(0);
    expect(urls.some((u) => u.includes('/data/opportunity'))).toBe(false);
  });
});
