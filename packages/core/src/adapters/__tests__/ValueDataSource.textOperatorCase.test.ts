/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7379 — `ValueDataSource`'s text operators answer the case question
 * the wire answers.
 *
 * ## What was wrong
 *
 * The `contains` / `icontains` / `not_contains` / `starts_with` / `ends_with`
 * arms lower-cased BOTH sides, so `contains` executed `icontains` and the two
 * spellings named one predicate. A `provider: 'value'` list filtered with
 * `contains` returned strictly more rows than the same filter run against a
 * real driver — and both answers look plausible on screen, because nothing
 * errors: the list is just longer.
 *
 * ## Why case-SENSITIVE is the answer, and not this file's opinion
 *
 * `$contains` is contractually case-sensitive (objectstack#4706 Q2 = A) and
 * `$icontains` is its case-insensitive twin, folding ASCII ONLY (Q1 = A). All
 * five backends execute that: `driver-sql`, `driver-sqlite-wasm`,
 * `driver-turso`, `driver-mongodb` and `driver-memory` each import
 * `FILTER_TEXT_CASES` from `@objectstack/spec/data` and answer its
 * `$contains is case-SENSITIVE` rows, as does objectql's `having` matcher. So
 * this adapter was the odd one out among the faces, not a face disagreeing
 * with a document.
 *
 * ## How these cases are written, and why
 *
 * Every assertion is a row-SET equality, never an operator-name check: a
 * matcher that returns every row constructs exactly the right operator string.
 * And each case comes in a PAIR over the SAME fixture — the case-differing row
 * that `contains` must EXCLUDE, and the `icontains` query that must still
 * INCLUDE it. The second half is what rules out an implementation strictly
 * worse than the bug: a matcher answering `[]` for everything satisfies every
 * exclusion on its own. {@link `the fixture discriminates in both directions`}
 * states that requirement as its own case.
 *
 * The fixture mirrors `FILTER_TEXT_ROWS`' first four rows rather than importing
 * the table: enrolling this adapter in `FILTER_TEXT_CASES` means answering ALL
 * of it, including the non-string-value rows this card does not touch, and that
 * table's own rule is that a face's rows join it in the PR that closes the gap.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ValueDataSource } from '../ValueDataSource';

/**
 * Two ASCII rows differing only in case, and two non-ASCII rows differing only
 * in the case of a letter outside ASCII. The first pair catches a fold that
 * fails to happen (`icontains`) or happens when it must not (`contains`); the
 * second catches a fold WIDER than ASCII, which is what `toLowerCase()` gives.
 */
const ROWS = [
  { id: 'upper', name: 'ACME Corp' },
  { id: 'lower', name: 'acme corp' },
  { id: 'accent-upper', name: 'CAFÉ' },
  { id: 'accent-lower', name: 'café' },
];

const ALL_IDS = ['upper', 'lower', 'accent-upper', 'accent-lower'];

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

describe('objectui#7379 — the fixture discriminates in both directions', () => {
  it('an empty filter returns every row, so an exclusion is a real narrowing', async () => {
    const ids = await selectedIds([]);
    expect(ids, 'no filter must select all four rows').toEqual(ALL_IDS);
  });

  it('a matcher answering [] for everything FAILS these cases, not just passes the exclusions', async () => {
    // The guard against an implementation strictly worse than the bug. Every
    // `expected` below is non-empty for at least one member of each pair, and
    // this case says so out loud: `icontains` over the very comparand
    // `contains` must reject has to come back with BOTH ASCII rows.
    const ids = await selectedIds(['name', 'icontains', 'acme']);
    expect(ids.length, 'the inclusion half must be non-empty or the pin is vacuous').toBeGreaterThan(0);
    expect(ids).toEqual(['upper', 'lower']);
  });

  it('an operator that was already case-exact before this card still selects — the live control', async () => {
    // `=` never folded. Green on the broken tree and the fixed one; its job is
    // to prove the rows, the adapter and the id projection work, so a red below
    // is about case semantics rather than the harness.
    expect(await selectedIds(['name', '=', 'ACME Corp'])).toEqual(['upper']);
  });
});

// ---------------------------------------------------------------------------
// 1. `contains` EXCLUDES the case-differing row; `icontains` INCLUDES it
// ---------------------------------------------------------------------------

describe('objectui#7379 — `contains` and `icontains` are two predicates, not two spellings', () => {
  it('a lower-case comparand: `contains` misses the upper-case row, `icontains` takes both', async () => {
    expect(
      await selectedIds(['name', 'contains', 'acme']),
      '`contains` is case-SENSITIVE — ACME Corp must NOT come back',
    ).toEqual(['lower']);
    expect(
      await selectedIds(['name', 'icontains', 'acme']),
      '`icontains` over the SAME fixture must still include the row `contains` dropped',
    ).toEqual(['upper', 'lower']);
  });

  it('an upper-case comparand: the mirror, so neither direction is a lucky count', async () => {
    expect(await selectedIds(['name', 'contains', 'ACME'])).toEqual(['upper']);
    expect(await selectedIds(['name', 'icontains', 'ACME'])).toEqual(['upper', 'lower']);
  });

  it('the two operators cannot silently re-converge: they disagree on this fixture', async () => {
    const exact = await selectedIds(['name', 'contains', 'acme']);
    const folded = await selectedIds(['name', 'icontains', 'acme']);
    expect(exact, 'a re-folded `contains` would equal `icontains` here').not.toEqual(folded);
  });
});

// ---------------------------------------------------------------------------
// 2. The fold is ASCII-ONLY (objectstack#4706 Q1 = A)
// ---------------------------------------------------------------------------

describe('objectui#7379 — `icontains` folds ASCII case only', () => {
  it('É does not fold to é, in either direction', async () => {
    // `toLowerCase()` — what this arm used to use — folds the whole Unicode
    // range and answers both rows to both queries. Three of the five backends
    // are SQLite underneath, whose `lower()` folds ASCII only, so a Unicode
    // promise here is one the wire cannot keep.
    expect(await selectedIds(['name', 'icontains', 'café'])).toEqual(['accent-lower']);
    expect(await selectedIds(['name', 'icontains', 'CAFÉ'])).toEqual(['accent-upper']);
  });

  it('the ASCII letters in the same comparand still fold — the fold happens, it is just narrow', async () => {
    // Both rows share `caf`/`CAF`, so an ASCII fold matches the row whose
    // accented letter agrees and no other. A matcher that folded NOTHING would
    // answer `[]` to the first of these.
    expect(await selectedIds(['name', 'icontains', 'cAf'])).toEqual(['accent-upper', 'accent-lower']);
  });
});

// ---------------------------------------------------------------------------
// 3. The rest of the family — case-sensitive, with no `i` twin to fall back on
// ---------------------------------------------------------------------------

describe('objectui#7379 — the whole `$contains` family is case-sensitive', () => {
  it('`starts_with` is case-sensitive', async () => {
    expect(await selectedIds(['name', 'starts_with', 'ACME'])).toEqual(['upper']);
    expect(await selectedIds(['name', 'starts_with', 'acme'])).toEqual(['lower']);
  });

  it('`ends_with` is case-sensitive', async () => {
    expect(await selectedIds(['name', 'ends_with', 'Corp'])).toEqual(['upper']);
    expect(await selectedIds(['name', 'ends_with', 'corp'])).toEqual(['lower']);
  });

  it('`not_contains` is case-sensitive, and complements `contains` exactly', async () => {
    // The reason `not_contains` could not be left folding: a case-exact
    // `contains` beside a folding `not_contains` lets `ACME Corp` fail the
    // operator AND its negation for the same comparand.
    const positive = await selectedIds(['name', 'contains', 'acme']);
    const negative = await selectedIds(['name', 'not_contains', 'acme']);
    expect(negative).toEqual(['upper', 'accent-upper', 'accent-lower']);
    expect(
      [...positive, ...negative].sort(),
      'every row satisfies exactly one of the two — no row fails both',
    ).toEqual([...ALL_IDS].sort());
  });
});

// ---------------------------------------------------------------------------
// 4. The `$` dialect of the same adapter answers the same way
// ---------------------------------------------------------------------------

describe('objectui#7379 — the `$` dialect agrees with the AST dialect', () => {
  it('`$contains` excludes the case-differing row and `$icontains` includes it', async () => {
    expect(
      await selectedIds({ name: { $contains: 'acme' } }),
      '`$contains` is the case-SENSITIVE spelling',
    ).toEqual(['lower']);
    expect(
      await selectedIds({ name: { $icontains: 'acme' } }),
      '`$icontains` had NO arm before this card, so it selected every row',
    ).toEqual(['upper', 'lower']);
  });

  it('`$icontains` narrows rather than waving every row through', async () => {
    // The specific pre-card answer this replaces: an unrecognised `$` operator
    // reaches `default: break`, which adds no constraint at all.
    const ids = await selectedIds({ name: { $icontains: 'acme' } });
    expect(ids, 'the accented rows contain no ASCII "acme"').not.toEqual(ALL_IDS);
  });

  it('both dialects answer the same rows for the same question', async () => {
    expect(await selectedIds({ name: { $contains: 'ACME' } })).toEqual(
      await selectedIds(['name', 'contains', 'ACME']),
    );
    expect(await selectedIds({ name: { $icontains: 'ACME' } })).toEqual(
      await selectedIds(['name', 'icontains', 'ACME']),
    );
  });
});
