/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8447 — the OBJECT (`$`-dialect) matcher executes the operators the
 * spec declares, and refuses the rest instead of waving them through.
 *
 * ## The defect these cases have to be able to see
 *
 * `find()` picks its matcher on nothing but the SHAPE of `$filter` — two arms
 * of one `if`. The array arm (`matchesASTFilter`) refuses an unknown node,
 * excludes the row and logs; the object arm (`matchesFilter`) ended its switch
 * with `default: break`, which adds NO constraint, so an unrecognised operator
 * selected EVERY row in silence. Same file, opposite defaults, and nothing
 * tells an author which dialect their filter took.
 *
 * ## Why every case is a non-empty PROPER subset
 *
 * Two wrong implementations have to fail here, not one:
 *
 * 1. **the bug** — no constraint, so the answer is the full set;
 * 2. **the caricature** — a matcher that answers `false` for everything, so the
 *    answer is the empty set. It is strictly WORSE than the bug and it passes
 *    every assertion whose expected value is `[]`.
 *
 * A row-set equality against a non-empty proper subset of `ROW_IDS` is red for
 * both. The refusal cases below, whose expected row set IS empty, therefore
 * carry the `console.warn` assertion as the half that discriminates: the
 * caricature refuses nothing, so it logs nothing.
 *
 * Both were RUN, not reasoned about:
 *
 * | ablation | red | green |
 * |---|---|---|
 * | the bug — `ValueDataSource.ts` restored to its pre-card bytes | 37 | 24 |
 * | the caricature — `matchesFilter` returns `false` unconditionally | 54 | 7 |
 *
 * The seven survivors of the caricature are named rather than counted, because
 * which ones survive is the finding: the two `{}` cases and the AST-group case
 * never reach `matchesFilter` at all, the `FILTER_OPERATORS` parity guard reads
 * no rows, and the remaining three are the card's own `$nin` / `$startsWith` /
 * `$null` examples — the quotable ones, and they cannot tell this fix from an
 * empty result set. They are kept in §5 and labelled as a scope declaration.
 *
 * Assertions name ROWS (`['a','c']`), never a container shape (objectui#8495).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FILTER_OPERATORS } from '@objectstack/spec/data';
import { ValueDataSource } from '../ValueDataSource';

/**
 * Three rows: two share a `role`, the ages straddle every bound used below, and
 * `nickname` is present / null / absent so the null-ness arms discriminate.
 */
const ROWS = [
  { id: 'a', role: 'admin', age: 30, nickname: 'ace' },
  { id: 'b', role: 'user', age: 25, nickname: null },
  { id: 'c', role: 'admin', age: 20 },
];

/** What the BUG answers for every case below. No expectation may equal it. */
const ROW_IDS = ['a', 'b', 'c'];

async function selectedIds(
  filter: unknown,
  rows: Array<Record<string, unknown>> = ROWS,
): Promise<string[]> {
  const ds = new ValueDataSource({ items: rows });
  const result = await ds.find('rows', { $filter: filter as any });
  return result.data.map((r) => r.id as string);
}

/** Spy that returns the calls, so a case can assert BOTH the rows and the log. */
function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 0. Live controls — the harness itself discriminates
// ---------------------------------------------------------------------------

describe('objectui#8447 — live controls', () => {
  it('the plain-equality arm, which was correct all along, still selects', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ role: 'admin' })).toEqual(['a', 'c']);
    expect(await selectedIds({ age: 25 })).toEqual(['b']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a genuinely matching row still comes back', async () => {
    expect(await selectedIds({ id: 'b' })).toEqual(['b']);
  });

  it('the broken answer is the full set, so every case below discriminates', async () => {
    expect(await selectedIds({})).toEqual(ROW_IDS);
  });
});

// ---------------------------------------------------------------------------
// 1. Every declared operator this matcher executes
// ---------------------------------------------------------------------------

/**
 * One case per EXECUTED member of the spec's `FILTER_OPERATORS`, each paired
 * with the AST spelling of the same question. Both halves matter:
 *
 *   - the row set proves the operator constrains (vs. the bug) and selects
 *     something (vs. the caricature);
 *   - the AST twin proves the two arms of `find()`'s `if` now answer the same
 *     question, which is this card's objective rather than "add the missing
 *     arms" — adding arms alone leaves the next unrecognised spelling on the
 *     permissive side.
 */
const EXECUTED_CASES: Record<
  string,
  { filter: Record<string, unknown>; ast: unknown[]; expected: string[] }
> = {
  $eq: { filter: { role: { $eq: 'admin' } }, ast: ['role', '=', 'admin'], expected: ['a', 'c'] },
  $ne: { filter: { role: { $ne: 'admin' } }, ast: ['role', '!=', 'admin'], expected: ['b'] },
  $gt: { filter: { age: { $gt: 24 } }, ast: ['age', '>', 24], expected: ['a', 'b'] },
  $gte: { filter: { age: { $gte: 25 } }, ast: ['age', '>=', 25], expected: ['a', 'b'] },
  $lt: { filter: { age: { $lt: 25 } }, ast: ['age', '<', 25], expected: ['c'] },
  $lte: { filter: { age: { $lte: 25 } }, ast: ['age', '<=', 25], expected: ['b', 'c'] },
  $in: { filter: { role: { $in: ['admin'] } }, ast: ['role', 'in', ['admin']], expected: ['a', 'c'] },
  $nin: { filter: { role: { $nin: ['admin'] } }, ast: ['role', 'nin', ['admin']], expected: ['b'] },
  $between: {
    filter: { age: { $between: [24, 31] } },
    ast: ['age', 'between', [24, 31]],
    expected: ['a', 'b'],
  },
  $contains: {
    filter: { role: { $contains: 'dmi' } },
    ast: ['role', 'contains', 'dmi'],
    expected: ['a', 'c'],
  },
  $icontains: {
    filter: { role: { $icontains: 'ADMI' } },
    ast: ['role', 'icontains', 'ADMI'],
    expected: ['a', 'c'],
  },
  $notContains: {
    filter: { role: { $notContains: 'dmi' } },
    ast: ['role', 'not_contains', 'dmi'],
    expected: ['b'],
  },
  $startsWith: {
    filter: { role: { $startsWith: 'adm' } },
    ast: ['role', 'starts_with', 'adm'],
    expected: ['a', 'c'],
  },
  $endsWith: {
    filter: { role: { $endsWith: 'min' } },
    ast: ['role', 'ends_with', 'min'],
    expected: ['a', 'c'],
  },
  // `$null` takes its direction from the VALUE, not from the operator name —
  // the lowering `convertFiltersToAST` performs. Both directions are cases.
  $null: {
    filter: { nickname: { $null: true } },
    ast: ['nickname', 'is_null'],
    expected: ['b', 'c'],
  },
};

/** Refused on purpose. Every one carries its reason in the refusal cases below. */
const REFUSED_OPERATORS = ['$exists'];

describe('objectui#8447 — every executed operator constrains', () => {
  it.each(Object.entries(EXECUTED_CASES))(
    '`%s` selects the rows it names rather than every row',
    async (_op, { filter, expected }) => {
      const warn = spyWarn();
      const ids = await selectedIds(filter);
      expect(ids).toEqual(expected);
      // Executed, not refused. The row-set assertion already fails on a
      // refusal; this names WHICH failure it is.
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it('`$null: false` is the other direction of the same operator', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ nickname: { $null: false } })).toEqual(['a']);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(Object.entries(EXECUTED_CASES))(
    '`%s` answers the same rows as its AST twin — the two arms of find() agree',
    async (_op, { filter, ast, expected }) => {
      expect(await selectedIds(filter)).toEqual(await selectedIds(ast));
      // Pinned to the literal set as well, so the case cannot pass by both
      // arms being wrong in the same direction.
      expect(await selectedIds(ast)).toEqual(expected);
    },
  );

  it('the case table covers FILTER_OPERATORS exactly — none drops out unnoticed', () => {
    // A parity guard against spec drift: when a release adds a `$` operator,
    // this goes red instead of the new operator reaching the refusal arm
    // unannounced — or, before this card, selecting every row.
    expect([...FILTER_OPERATORS].sort()).toEqual(
      [...Object.keys(EXECUTED_CASES), ...REFUSED_OPERATORS].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Composition — several operators, several fields
// ---------------------------------------------------------------------------

describe('objectui#8447 — operators compose without losing a constraint', () => {
  it('two operators on ONE field are ANDed', async () => {
    expect(await selectedIds({ age: { $gte: 21, $lte: 29 } })).toEqual(['b']);
  });

  it('an executed operator beside an unexecutable one refuses the whole row', async () => {
    // The failure direction that matters: dropping the unreadable half would
    // WIDEN the answer to `['a','b']`, which is the defect one level down.
    const warn = spyWarn();
    expect(await selectedIds({ age: { $gte: 21, $zzz: 1 } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('two fields are ANDed, mixing the equality arm and the operator arm', async () => {
    expect(await selectedIds({ role: 'admin', age: { $gt: 24 } })).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// 3. Refusal — the arm that used to be `default: break`
// ---------------------------------------------------------------------------

describe('objectui#8447 — what the matcher cannot execute, it refuses', () => {
  it('an unknown operator excludes every row and logs ONCE for the whole find()', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ role: { $zzz: 'admin' } })).toEqual([]);
    // One line for three rows: refusals are collected per `find()`, not per row.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('$zzz');
  });

  it('`$exists` is refused and the refusal prescribes the synonym that works', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ nickname: { $exists: true } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('$exists');
    expect(message).toContain('$null: false');
  });

  it('`$exists: false` prescribes the other direction', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ nickname: { $exists: false } })).toEqual([]);
    expect(String(warn.mock.calls[0]?.[0])).toContain('$null: true');
  });

  it('the prescription `$exists` points at is itself executed', async () => {
    // The refusal is only honest if the alternative works. `$exists: true` is
    // `$null: false` and `$exists: false` is `$null: true`.
    expect(await selectedIds({ nickname: { $null: false } })).toEqual(['a']);
    expect(await selectedIds({ nickname: { $null: true } })).toEqual(['b', 'c']);
  });

  it.each(['$like', '$ilike'])(
    '`%s` — declared by the schema but staged OUT of FILTER_OPERATORS — refuses',
    async (op) => {
      const warn = spyWarn();
      expect(await selectedIds({ role: { [op]: 'adm%' } })).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(op);
    },
  );

  it('`$regex` refuses with the retired-operator prescription, verbatim', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ role: { $regex: 'adm.n' } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('$regex');
    // The spec's own table is what six faces now print, rather than six sentences.
    expect(message).toContain('$icontains');
  });

  it('`$options`, the retired regex-flags companion, refuses too', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ role: { $options: 'i' } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(['$startswith', '$notcontains', '$notin'])(
    'the lowercase alias `%s` is refused, not silently accepted',
    async (op) => {
      // Contract-first (AGENTS.md #0.1): the canonical `$` spellings are
      // camelCase. Growing an alias arm here would fossilise a second dialect
      // in the renderer; refusing is loud and points the author at the spec.
      const warn = spyWarn();
      expect(await selectedIds({ role: { [op]: 'adm' } })).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it('`$ncontains`, the off-spec spelling one widget used to emit, refuses', async () => {
    const warn = spyWarn();
    expect(await selectedIds({ role: { $ncontains: 'dmi' } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a nested relation constraint is refused by NAME rather than ignored', async () => {
    // `{ profile: { verified: true } }` and an operator object are the same
    // SHAPE — the spec says so, which is why `FilterConditionSchema` cannot
    // narrow to a closed vocabulary. This matcher does not descend into
    // relations, so it says which key it could not read.
    const warn = spyWarn();
    expect(await selectedIds({ profile: { verified: true } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('verified');
  });

  it('an empty filter still means "no filter"', async () => {
    const warn = spyWarn();
    expect(await selectedIds({})).toEqual(ROW_IDS);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Combinators — refused as their own case, NOT implemented
// ---------------------------------------------------------------------------

describe('objectui#8447 — `$and` / `$or` / `$not` are refused, and say so', () => {
  it('`$not` moves results: it matched EVERY row before this card', async () => {
    // The one combinator that was fail-OPEN. Its value is an OBJECT
    // (`FilterConditionSchema`), so it entered the operator branch, its inner
    // FIELD names were read as operator names, and each hit `default: break`.
    const warn = spyWarn();
    expect(await selectedIds({ $not: { role: 'admin' } })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('$not');
  });

  it.each(['$and', '$or'])(
    '`%s` keeps excluding every row, but no longer in silence',
    async (op) => {
      // Their value is an ARRAY, so they fell to the simple-equality branch and
      // were already fail-CLOSED. The rows do not move here; the silence does.
      const warn = spyWarn();
      expect(await selectedIds({ [op]: [{ role: 'admin' }] })).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(op);
    },
  );

  it('the AST array dialect is the door that DOES execute a group', async () => {
    // The refusal names this as the alternative, so it has to be true.
    expect(await selectedIds(['or', ['role', '=', 'user'], ['age', '>', 28]])).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// 5. The card's own measured examples
// ---------------------------------------------------------------------------

/**
 * ⚠️ SCOPE DECLARATION, NOT PROOF.
 *
 * These are the four readings objectui#8447 was filed with, reproduced on the
 * two rows it used. Three of the four expect an EMPTY result, so a matcher that
 * answered `false` for everything — strictly worse than the bug — passes them.
 * MEASURED, not predicted: under that caricature exactly these three stayed
 * green and the fourth (`$exists`, which asserts the refusal was LOGGED) went
 * red. They are kept because they are the card's own words and someone will
 * look for them, not because they measure the fix. The discriminating cases
 * are §1-§4.
 */
describe('objectui#8447 — the card’s measured examples (scope declaration)', () => {
  const CARD_ROWS = [
    { id: 'n', score: 5 },
    { id: 's', score: '5' },
  ];

  it('`$nin [5, "5"]` selects neither row', async () => {
    expect(await selectedIds({ score: { $nin: [5, '5'] } }, CARD_ROWS)).toEqual([]);
  });

  it('`$startsWith "zzz"` selects neither row', async () => {
    expect(await selectedIds({ score: { $startsWith: 'zzz' } }, CARD_ROWS)).toEqual([]);
  });

  it('`$null true` selects neither row — both have the key', async () => {
    expect(await selectedIds({ score: { $null: true } }, CARD_ROWS)).toEqual([]);
  });

  it('`$exists false` selects neither row, and now logs why', async () => {
    // The one of the four that DOES discriminate against the caricature: it
    // refuses, and a matcher that answers `false` for everything refuses
    // nothing and logs nothing.
    const warn = spyWarn();
    expect(await selectedIds({ score: { $exists: false } }, CARD_ROWS)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('the complements of the first three DO select — the fix is not "exclude everything"', async () => {
    expect(await selectedIds({ score: { $in: [5, '5'] } }, CARD_ROWS)).toEqual(['n', 's']);
    expect(await selectedIds({ score: { $startsWith: '5' } }, CARD_ROWS)).toEqual(['s']);
    expect(await selectedIds({ score: { $null: false } }, CARD_ROWS)).toEqual(['n', 's']);
  });
});
