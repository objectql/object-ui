/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Object-form filter entries (`[{ field, operator, value }, ...]`) → filter AST.
 *
 * `find()` has TWO routes to the server and both translate the filter: a plain
 * read goes through `convertQueryParams`, while a read with `$expand`/`$search`
 * goes through `rawFindWithPopulate`. They used to carry independent copies of
 * the "is this object form?" test, and the copies had already drifted — so the
 * tests below run every case down BOTH routes and assert they agree.
 *
 * The stakes are the same as objectstack#3948: a filter this layer fails to
 * translate is not a filter it may skip. Skipping one entry of an `and` returns
 * a superset of the rows asked for, and skipping the last one sends no filter
 * at all — every row in the table, reported as success.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFilterAST } from '@objectstack/spec/data';
import { ObjectStackAdapter, clearSharedDiscoveryCache, isMalformedFilterError } from './index';

function makeAdapter() {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: any) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/api/v1/discovery')) {
      return {
        ok: true, status: 200, statusText: 'OK',
        json: async () => ({ success: true, data: { version: 'v1', routes: {} } }),
      } as any;
    }
    return {
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ success: true, data: { object: 'account', records: [], total: 0 } }),
    } as any;
  });
  const adapter = new ObjectStackAdapter({
    baseUrl: 'http://localhost:3000', token: 't', autoReconnect: false, fetch: fetchImpl as any,
  });
  return { adapter, calls };
}

/** The `filter=` this filter produced on the wire, or `undefined` if none was sent. */
async function filterOnWire(
  $filter: unknown,
  route: 'plain' | 'expand',
): Promise<unknown | undefined> {
  const { adapter, calls } = makeAdapter();
  await adapter.find('account', {
    $filter,
    ...(route === 'expand' ? { $expand: ['owner'] } : {}),
  } as any);
  const dataCall = calls.filter((u) => u.includes('/data/account')).pop();
  const raw = dataCall ? new URL(dataCall).searchParams.get('filter') : null;
  return raw === null ? undefined : JSON.parse(raw);
}

/** Run one input down both `find()` routes. */
function bothRoutes(name: string, $filter: unknown, assert: (wire: unknown | undefined) => void) {
  for (const route of ['plain', 'expand'] as const) {
    it(`${name} (${route} route)`, async () => assert(await filterOnWire($filter, route)));
  }
}

async function findRejects($filter: unknown, route: 'plain' | 'expand') {
  const { adapter } = makeAdapter();
  return adapter
    .find('account', { $filter, ...(route === 'expand' ? { $expand: ['owner'] } : {}) } as any)
    .then(() => null, (e) => e);
}

describe('object-form filter entries reach the wire as an AST', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  bothRoutes(
    'translates a single rule, mapping the operator alias',
    [{ field: 'stage', operator: 'greater_than_or_equal', value: 3 }],
    (wire) => expect(wire).toEqual(['stage', '>=', 3]),
  );

  bothRoutes(
    'joins several rules with `and`',
    [
      { field: 'stage', operator: 'eq', value: 'won' },
      { field: 'amount', operator: 'gt', value: 100 },
    ],
    (wire) => expect(wire).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]),
  );

  bothRoutes(
    'accepts the `op` shorthand key',
    [{ field: 'owner', op: 'eq', value: 'me' }],
    (wire) => expect(wire).toEqual(['owner', '=', 'me']),
  );

  bothRoutes(
    'passes an AST tuple through untouched',
    ['stage', '=', 'won'],
    (wire) => expect(wire).toEqual(['stage', '=', 'won']),
  );

  bothRoutes(
    'passes a logical AST node through untouched',
    ['or', ['stage', '=', 'won'], ['stage', '=', 'lost']],
    (wire) => expect(wire).toEqual(['or', ['stage', '=', 'won'], ['stage', '=', 'lost']]),
  );

  bothRoutes('sends no filter at all for an empty array', [], (wire) => expect(wire).toBeUndefined());
});

describe('a `name`-keyed entry is not an accepted shape', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  /**
   * `objectFilterEntryToAST` read `entry.field ?? entry.name` while the shape
   * sniff keyed on `field` alone, so the `name` half could never be reached —
   * dead from the commit that introduced it. The spec agrees it is not a real
   * shape: `ViewFilterRuleSchema.field` is required, so such a rule cannot be
   * saved as view metadata. It reaches the server unchanged and is refused
   * there (objectstack#4121) rather than being quietly half-understood here.
   */
  bothRoutes(
    'is passed through rather than translated',
    [{ name: 'stage', operator: 'eq', value: 'won' }],
    (wire) => expect(wire).toEqual([{ name: 'stage', operator: 'eq', value: 'won' }]),
  );
});

describe('an untranslatable entry fails instead of narrowing the filter', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  for (const route of ['plain', 'expand'] as const) {
    it(`rejects a rule with a blank field rather than dropping it (${route})`, async () => {
      // Survives `ViewFilterRuleSchema` (`field: z.string()` admits ''), so it
      // can be genuine stored metadata. It used to be dropped, and dropping the
      // only rule sent no filter — the whole table came back.
      const err = await findRejects([{ field: '', operator: 'eq', value: 'x' }], route);
      expect(err).toBeInstanceOf(Error);
      expect(isMalformedFilterError(err)).toBe(true);
    });

    it(`rejects a bad entry rather than silently widening the AND (${route})`, async () => {
      const err = await findRejects(
        [
          { field: 'stage', operator: 'eq', value: 'won' },
          { field: 'amount', operator: 42 as any, value: 1 },
        ],
        route,
      );
      expect(isMalformedFilterError(err)).toBe(true);
      // Names which entry, so the author can find it in the view config.
      expect(String((err as Error).message)).toContain('entry 1');
    });
  }

  it('carries the status and code that classify it as a rejected request', async () => {
    const err: any = await findRejects([{ field: '', operator: 'eq' }], 'plain');
    // plugin-list's `classifyLoadError` reads these to pick the error panel;
    // without them a malformed filter reads as "check your connection" (#3066).
    expect(err.code).toBe('INVALID_FILTER');
    expect(err.httpStatus).toBe(400);
  });
});

describe('object-form rules nested inside a logical node are translated too', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  /**
   * This is what a list builds the moment a view with a stored filter meets a
   * user filter from the panel — `['and', <ViewFilterRule[]>, <AST tuples>]`.
   * Translating only the top level shipped the rules raw, and the server has no
   * good answer for that: `isFilterAST` rejects the shape (so a server with
   * objectstack#4121 returns 400 and the list fails to load), while
   * `parseFilterAST` on the same array returns `{ amount: { $gt: 1 } }` — the
   * view's own `stage = won` dropped without a word.
   */
  bothRoutes(
    'translates a rule group nested under `and`',
    ['and', [{ field: 'stage', operator: 'eq', value: 'won' }], [['amount', '>', 1]]],
    (wire) => expect(wire).toEqual(['and', ['stage', '=', 'won'], [['amount', '>', 1]]]),
  );

  bothRoutes(
    'translates under `or`, and through more than one level',
    ['or', ['and', [{ field: 'stage', operator: 'not_in', value: ['lost'] }]], ['x', '=', 1]],
    (wire) => expect(wire).toEqual(['or', ['and', ['stage', 'nin', ['lost']]], ['x', '=', 1]]),
  );

  bothRoutes(
    'translates a group inside a legacy flat array of children',
    [[{ field: 'stage', operator: 'eq', value: 'won' }], ['amount', '>', 1]],
    (wire) => expect(wire).toEqual([['stage', '=', 'won'], ['amount', '>', 1]]),
  );

  bothRoutes(
    'leaves a field literally named `and` alone',
    ['and', '=', true],
    (wire) => expect(wire).toEqual(['and', '=', true]),
  );

  /**
   * A mixed array used to lose the tuple: it did not translate as a rule, so it
   * was filtered out and the query ran on the remaining condition alone —
   * broader than asked for. Keep both rather than dropping one or failing the
   * whole query.
   */
  bothRoutes(
    'keeps both halves of a rule/tuple mixed array',
    [{ field: 'stage', operator: 'eq', value: 'won' }, ['amount', '>', 1]],
    (wire) => expect(wire).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 1]]),
  );

  it('rejects a malformed rule nested under `and` as well', async () => {
    const err = await findRejects(['and', [{ field: '', operator: 'eq', value: 1 }]], 'plain');
    expect(isMalformedFilterError(err)).toBe(true);
  });
});

describe('what this adapter emits passes the server’s own gate', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  /**
   * The real contract is not a literal shape, it is "the server accepts this".
   * `isFilterAST` is the function the protocol gates on, so assert against it
   * directly rather than restating what it happens to accept today — a filter
   * it rejects is a 400 (objectstack#4121), and was an unfiltered query before
   * that (objectstack#3948).
   */
  const TRANSLATABLE: Array<[string, unknown]> = [
    ['a single rule', [{ field: 'stage', operator: 'eq', value: 'won' }]],
    ['several rules', [
      { field: 'stage', operator: 'contains', value: 'w' },
      { field: 'amount', operator: 'less_than_or_equal', value: 9 },
    ]],
    ['rules under `and` beside a tuple', [
      'and', [{ field: 'stage', operator: 'before', value: '2024-01-01' }], ['amount', '>', 1],
    ]],
    ['rules inside a legacy flat array', [
      [{ field: 'stage', operator: 'is_null', value: true }], ['amount', '>', 1],
    ]],
    ['a mixed rule/tuple array', [{ field: 'stage', operator: 'eq', value: 'won' }, ['a', '>', 1]]],
  ];

  for (const [name, input] of TRANSLATABLE) {
    for (const route of ['plain', 'expand'] as const) {
      it(`${name} → accepted by isFilterAST (${route})`, async () => {
        expect(isFilterAST(await filterOnWire(input, route))).toBe(true);
      });
    }
  }
});

describe('the two routes agree on shapes that are neither form', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  /**
   * The inline copy of the sniff omitted the `!== null` guard that this one
   * had, so `[null]` threw a TypeError on the plain route and was handled on
   * the `$expand` route — the same stored filter, decided by whether the view
   * happened to expand a lookup.
   */
  bothRoutes(
    'does not crash on a null entry',
    [null],
    (wire) => expect(wire).toEqual([null]),
  );

  bothRoutes(
    'leaves a nested legacy AST alone',
    [['stage', '=', 'won'], ['amount', '>', 1]],
    (wire) => expect(wire).toEqual([['stage', '=', 'won'], ['amount', '>', 1]]),
  );
});
