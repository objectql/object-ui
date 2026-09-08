/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8452 — a text operator aimed at a stored value that is NOT a string.
 *
 * ## What was wrong
 *
 * `not_contains` / `$notContains` were written as
 * `typeof value === 'string' && !value.includes(target)`. The leading `typeof`
 * is a TYPE test standing in for the predicate, so a row whose `score` is the
 * number `5` failed `contains '5'` (correct — a number cannot contain a
 * substring) AND failed `not_contains '5'` (wrong — for the very same reason it
 * cannot contain it, it does not contain it). One row, excluded from both
 * halves of a partition: no filter answer includes it, and a user who tries the
 * opposite filter to debug it gets the same silence twice.
 *
 * ## Why "the non-string satisfies the negation" is the answer, not this file's opinion
 *
 * objectstack#14079, maintainer ruling 2026-09-05, option A — quoted from the
 * contract that carries it (`filter-text-conformance.ts`, section "A stored
 * value that is not a string"):
 *
 * > The ruling took the type-gate (option A): a stored value that is not a
 * > string never satisfies a positive text operator (`$contains` /
 * > `$startsWith` / `$endsWith` / `$icontains` / `$like` / `$ilike`) and
 * > satisfies `$notContains` — complementarity holds, on every face.
 *
 * `FILTER_TEXT_CASES` (`@objectstack/spec/data`) pins it as five rows over a
 * numeric `score` column, and `driver-memory`'s reference matcher — the face
 * the card was measured on — now answers the PREDICATE:
 * `if (typeof value === 'string' && value.includes(target)) return false;`.
 * This adapter's two arms are the same expression, negated the same way.
 *
 * ⚠️ The POSITIVE operators were already right and are deliberately re-pinned
 * here rather than left alone: option A is a rule about the whole family, and
 * the cheapest way to break the family is to "fix" the negation by making the
 * type test disappear from its siblings too. Their rows below are the class
 * guard, not decoration.
 *
 * ## How these cases are written, and why
 *
 * Every assertion is a row-SET equality over a fixture that holds BOTH a
 * numeric and a string `score`, because each half alone is satisfiable by an
 * implementation strictly worse than the bug:
 *
 *   - the EXCLUSION half alone (`contains` returns few rows) is satisfied by a
 *     matcher answering `[]` to everything;
 *   - the INCLUSION half alone (`not_contains` returns the numeric rows) is
 *     satisfied by `case 'not_contains': return true` — the caricature that
 *     restores the partition by making the operator mean nothing.
 *
 * So the load-bearing cases are the STRING ones: `s5` must be the only row
 * `contains '5'` returns, and the only row `not_contains '5'` withholds.
 *
 * The fixture mirrors `FILTER_TEXT_ROWS`' `score` column rather than importing
 * `FILTER_TEXT_CASES`: enrolling this adapter in that table means answering ALL
 * of it, and the table's own rule 2 is that a face's rows join it in the PR
 * that closes the gap, not before. That enrolment is filed separately.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ValueDataSource } from '../ValueDataSource';

/**
 * One column, eight stored values, chosen so that every wrong answer is a
 * VISIBLY different id set rather than a different count:
 *
 * | row     | stored     | what it catches |
 * |---|---|---|
 * | `n5`    | `5`        | the card's cell: fails `contains '5'` and `not_contains '5'` both |
 * | `n50`   | `50`       | a COERCING backend: `String(50)` contains `'5'` and ends with `'0'` |
 * | `n0`    | `0`        | a guard written as a TRUTHINESS test rather than a `typeof` one |
 * | `s5`    | `'5'`      | the load-bearing string: the ONLY row a positive operator may return |
 * | `sx`    | `'x'`      | a string the positive operator misses, so the negation is not vacuous |
 * | `bool`  | `false`    | a non-string that is not a number either — the rule is about strings |
 * | `nul`   | `null`     | present, no value |
 * | `gone`  | key absent | absent, no value |
 */
const ROWS = [
  { id: 'n5', score: 5 },
  { id: 'n50', score: 50 },
  { id: 'n0', score: 0 },
  { id: 's5', score: '5' },
  { id: 'sx', score: 'x' },
  { id: 'bool', score: false },
  { id: 'nul', score: null },
  { id: 'gone' },
];

const ALL_IDS = ['n5', 'n50', 'n0', 's5', 'sx', 'bool', 'nul', 'gone'];

/** Every row except the one string that does contain the comparand. */
const ALL_BUT_S5 = ['n5', 'n50', 'n0', 'sx', 'bool', 'nul', 'gone'];

async function selectedIds(filter: unknown): Promise<string[]> {
  const ds = new ValueDataSource({ items: ROWS });
  const result = await ds.find('rows', { $filter: filter as any });
  return result.data.map((r) => r.id as string);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 0. The harness discriminates — in BOTH directions
// ---------------------------------------------------------------------------

describe('objectui#8452 — the fixture discriminates in both directions', () => {
  it('an empty filter returns every row, so an exclusion is a real narrowing', async () => {
    expect(await selectedIds([]), 'no filter must select all eight rows').toEqual(ALL_IDS);
  });

  it('an operator that never read the value TYPE still selects — the live control', async () => {
    // `=` carries no `typeof` guard, so it is green on the broken tree and on
    // the fixed one. Its job is to prove the rows, the adapter and the id
    // projection all work, so a red below is about the text operators rather
    // than about the harness.
    expect(await selectedIds(['score', '=', 5])).toEqual(['n5']);
    expect(await selectedIds(['score', '=', '5'])).toEqual(['s5']);
  });

  it('the inclusion half is non-empty and the exclusion half is not everything', async () => {
    // Stated as its own case so neither `[]` for everything nor `ALL_IDS` for
    // everything can pass this file.
    const positive = await selectedIds(['score', 'contains', '5']);
    const negative = await selectedIds(['score', 'not_contains', '5']);
    expect(positive.length, 'a matcher answering [] to everything fails here').toBeGreaterThan(0);
    expect(negative, 'a matcher answering every row to everything fails here').not.toEqual(ALL_IDS);
  });
});

// ---------------------------------------------------------------------------
// 1. The card's cell: the operator and its negation partition the fixture
// ---------------------------------------------------------------------------

describe('objectui#8452 — `not_contains` over a non-string stored value', () => {
  it('a number satisfies `not_contains`, exactly as it fails `contains`', async () => {
    expect(
      await selectedIds(['score', 'contains', '5']),
      'a number cannot contain a substring — only the STRING "5" may come back',
    ).toEqual(['s5']);
    expect(
      await selectedIds(['score', 'not_contains', '5']),
      'the numeric rows were dropped from the negation too — the defect',
    ).toEqual(ALL_BUT_S5);
  });

  it('every row satisfies exactly one of the two — no row fails both', async () => {
    const positive = await selectedIds(['score', 'contains', '5']);
    const negative = await selectedIds(['score', 'not_contains', '5']);
    expect(
      [...positive, ...negative].sort(),
      'a row missing from both halves is the defect objectstack#14079 ruled on',
    ).toEqual([...ALL_IDS].sort());
    expect(
      positive.filter((id) => negative.includes(id)),
      'and no row may satisfy both halves either',
    ).toEqual([]);
  });

  it('the partition holds for a comparand only a STRING row matches', async () => {
    // `x` appears in no coerced number, so this comparand separates "the
    // negation admits non-strings" from "the negation admits everything".
    expect(await selectedIds(['score', 'contains', 'x'])).toEqual(['sx']);
    expect(await selectedIds(['score', 'not_contains', 'x'])).toEqual(
      ['n5', 'n50', 'n0', 's5', 'bool', 'nul', 'gone'],
    );
  });

  it('`not_contains` still EXCLUDES a real string that contains the comparand', async () => {
    // The caricature guard, spelled as its own case: `return true` for every
    // value restores the partition and makes the operator mean nothing.
    const negative = await selectedIds(['score', 'not_contains', '5']);
    expect(negative, 'the string "5" DOES contain "5" and must be withheld').not.toContain('s5');
  });
});

// ---------------------------------------------------------------------------
// 2. The positive family keeps the type gate — the class guard
// ---------------------------------------------------------------------------

describe('objectui#8452 — a positive text operator never matches a non-string', () => {
  it('`contains` does not coerce the stored number to text', async () => {
    // A coercing backend answers ['n5','n50','s5'] here.
    expect(await selectedIds(['score', 'contains', '5'])).toEqual(['s5']);
  });

  it('`starts_with` does not coerce', async () => {
    expect(await selectedIds(['score', 'starts_with', '5'])).toEqual(['s5']);
  });

  it('`ends_with` does not coerce — the storage-class tell', async () => {
    // `0` is the comparand the coercion shows up on: `String(50)` and
    // `String(0)` both end with it, and a SQLite REAL column renders every
    // value with a trailing `0`. No STORED STRING in this fixture ends with
    // `0`, so the declared answer is empty.
    expect(await selectedIds(['score', 'ends_with', '0'])).toEqual([]);
    expect(await selectedIds(['score', 'ends_with', '5'])).toEqual(['s5']);
  });

  it('`icontains` applies the guard before the fold, not instead of it', async () => {
    expect(await selectedIds(['score', 'icontains', '5'])).toEqual(['s5']);
    expect(await selectedIds(['score', 'icontains', 'X'])).toEqual(['sx']);
  });
});

// ---------------------------------------------------------------------------
// 3. The `$` dialect of the same adapter answers the same way
// ---------------------------------------------------------------------------

describe('objectui#8452 — the `$` dialect agrees with the AST dialect', () => {
  it('`$notContains` is satisfied by every non-string stored value', async () => {
    expect(await selectedIds({ score: { $contains: '5' } })).toEqual(['s5']);
    expect(await selectedIds({ score: { $notContains: '5' } })).toEqual(ALL_BUT_S5);
  });

  it('`$notContains` still withholds the string that contains the comparand', async () => {
    expect(await selectedIds({ score: { $notContains: '5' } })).not.toContain('s5');
  });

  it('the `$` positive family keeps its type gate too', async () => {
    expect(await selectedIds({ score: { $startsWith: '5' } })).toEqual(['s5']);
    expect(await selectedIds({ score: { $endsWith: '0' } })).toEqual([]);
    expect(await selectedIds({ score: { $icontains: '5' } })).toEqual(['s5']);
  });

  it('both dialects answer the same rows for the same question', async () => {
    expect(await selectedIds({ score: { $notContains: '5' } })).toEqual(
      await selectedIds(['score', 'not_contains', '5']),
    );
    expect(await selectedIds({ score: { $contains: '5' } })).toEqual(
      await selectedIds(['score', 'contains', '5']),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. A no-value row satisfies the negation — the same expression, stated
// ---------------------------------------------------------------------------

describe('objectui#8452 — a row with no value is on the negation side', () => {
  it('a null and an absent key both satisfy `not_contains`', async () => {
    // Not a separate rule and not a separate code path: `null` and `undefined`
    // are non-strings, so the one predicate covers them. It is pinned because
    // the platform ruled the same cell separately (objectstack#13166 —
    // `$ne` / `$nin` / `$notContains` admit a no-value row) and the two answers
    // must not drift apart here.
    const negative = await selectedIds(['score', 'not_contains', '5']);
    expect(negative).toContain('nul');
    expect(negative).toContain('gone');
  });

  it('and neither of them satisfies the positive operator', async () => {
    const positive = await selectedIds(['score', 'contains', '5']);
    expect(positive).not.toContain('nul');
    expect(positive).not.toContain('gone');
  });
});
