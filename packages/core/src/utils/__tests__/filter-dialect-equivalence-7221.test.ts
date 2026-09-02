/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * One authored view filter, two lowered dialects — do they select the same rows?
 * The MEASUREMENT objectui#7221 asked for, recorded so the answer cannot drift.
 *
 * objectui#7210 watched one page load of a `type: 'gantt'` list view put two
 * filters on the wire from one authored filter:
 *
 * ```
 * paged      [["visible_from","is_not_null"],["due_date","is_not_null"]]
 * unbounded  ["and",["visible_from","isnotnull",null],["due_date","isnotnull",null]]
 * ```
 *
 * objectui#7221 filed the obvious question — nobody had checked that
 * `['and', A, B]` and `[A, B]` select the same rows through every adapter — and
 * asked for a measurement rather than a repair. This file is the `ValueDataSource`
 * half of that measurement; `data-objectstack/src/filter-dialect-wire-7221.test.ts`
 * is the wire half.
 *
 * ## The answer, in one line
 *
 * On the card's own filter the two dialects agree — and they agree because
 * `matchesASTFilter` evaluates NEITHER of them. Change the operator to one the
 * in-memory matcher implements and they part: the flat dialect applies no filter
 * at all while the `and`-wrapped one filters correctly. So the equivalence the
 * card hoped to establish does NOT hold in general, and the case it was observed
 * on is the accidentally-benign one.
 *
 * ## Why the flat dialect is inert here
 *
 * `matchesASTFilter` (`../../adapters/ValueDataSource.ts`) recognises exactly two
 * node shapes: a logical `['and'|'or', ...children]` head, and a THREE-element
 * comparison `[field, operator, value]`. A legacy flat array of condition nodes —
 * `[[…], […]]`, the implicit-AND shape `toFilterNode` returns for a lone source —
 * matches neither, so it reaches the closing `return true` and every row passes.
 * The same fall-through swallows it as a CHILD of an `and`, which is the shape
 * `ElementDataSourceGate` produces from two surviving sources.
 *
 * Two separate reasons the card's own filter is inert, and both are recorded
 * below: the flat shape is unread AS A SHAPE, and `is_not_null` / `isnotnull` are
 * unimplemented AS OPERATORS (the `switch` has no null-ness arm, so its `default`
 * returns true for the wrapped dialect too).
 *
 * ## Reading a red in this file
 *
 * - An `it.fails` case going RED means the divergence was repaired — the two
 *   dialects now agree. That is the good day; delete the `.fails` and keep the
 *   assertion.
 * - A plain case going red means the measured behaviour moved. Re-measure before
 *   changing the expectation: these numbers are the evidence objectui#7221's
 *   severity was graded on.
 *
 * ⛔ No product code is changed by this card. Which dialect wins is a ruling, not
 * a test's decision.
 */

import { describe, it, expect } from 'vitest';
import { toFilterNode, mergeFilterNodes } from '../filter-converter';
import { ValueDataSource } from '../../adapters/ValueDataSource';

/** The authored view filter of the card, as a spec `ViewFilterRule[]`. */
const AUTHORED_RULES = [
  { field: 'visible_from', operator: 'is_not_null' },
  { field: 'due_date', operator: 'is_not_null' },
];

/**
 * Dialect A — the flat, implicit-AND array. What `buildEffectiveFilter` forwards
 * when the authored filter is the only surviving source, and byte-for-byte the
 * `paged` filter objectui#7210 saw.
 */
const DIALECT_A = [
  ['visible_from', 'is_not_null'],
  ['due_date', 'is_not_null'],
];

/**
 * Dialect B — the `and`-wrapped, 3-tuple form, byte-for-byte the `unbounded`
 * filter objectui#7210 saw. Measured provenance (see the wire pin): this is what
 * `@object-ui/data-objectstack` produces from an UNLOWERED `ViewFilterRule[]`,
 * not what `mergeFilterNodes` produces — the `null` slot is `entry.value` being
 * `undefined` and surviving `JSON.stringify` as `null`.
 */
const DIALECT_B = [
  'and',
  ['visible_from', 'isnotnull', null],
  ['due_date', 'isnotnull', null],
];

// ---------------------------------------------------------------------------
// 1. Lowering — what `mergeFilterNodes` actually produces
// ---------------------------------------------------------------------------

describe('objectui#7221 — the lowering, measured rather than assumed', () => {
  it('lowers a ViewFilterRule[] to 2-tuples, inventing no value slot', () => {
    // The card guessed the rules might become 3-tuples with a `null` value slot.
    // They do not: `viewFilterRuleToNode` emits a value only when the rule
    // carries one, and the spec's own canonical spelling `is_not_null` survives.
    expect(toFilterNode(AUTHORED_RULES)).toEqual(DIALECT_A);
  });

  it('passes the already-lowered array through unchanged', () => {
    expect(toFilterNode(DIALECT_A)).toEqual(DIALECT_A);
  });

  it('returns a lone surviving source as-is, so one source reaches the wire FLAT', () => {
    expect(mergeFilterNodes(AUTHORED_RULES)).toEqual(DIALECT_A);
    expect(mergeFilterNodes(undefined, AUTHORED_RULES)).toEqual(DIALECT_A);
    expect(mergeFilterNodes(DIALECT_A, undefined)).toEqual(DIALECT_A);
  });

  it('wraps the authored array WHOLE as one child — one source, not one per rule', () => {
    // This is the shape `ElementDataSourceGate` hands the gantt when both the
    // element's own filter and the composed view/binding filter survive. The
    // authored array stays a single nested child; it is NOT spread.
    expect(mergeFilterNodes(DIALECT_A, ['owner', '=', 'me'])).toEqual([
      'and',
      DIALECT_A,
      ['owner', '=', 'me'],
    ]);
  });

  it('never produces dialect B — that spelling is not this function’s', () => {
    // Two surviving sources or one, the `isnotnull` spelling and the `null` value
    // slot never appear. The card attributed dialect B to `mergeFilterNodes`;
    // the measurement puts it at the adapter instead.
    const twoSources = JSON.stringify(mergeFilterNodes(AUTHORED_RULES, ['owner', '=', 'me']));
    const oneSource = JSON.stringify(mergeFilterNodes(AUTHORED_RULES));
    expect(twoSources).not.toContain('isnotnull');
    expect(oneSource).not.toContain('isnotnull');
    expect(JSON.stringify(DIALECT_B)).toContain('isnotnull');
  });
});

// ---------------------------------------------------------------------------
// 2. Row sets — the card's own filter, every edge value
// ---------------------------------------------------------------------------

/** One row per edge value, plus a row that carries no keys at all. */
const EDGE_VALUES: Array<readonly [string, unknown]> = [
  ['null', null],
  ['undefined', undefined],
  ['empty-string', ''],
  ['zero', 0],
  ['false', false],
  ['NaN', NaN],
  ['array', []],
  ['object', {}],
  ['real', '2026-01-01'],
];

const EDGE_ROWS: Array<Record<string, unknown>> = [
  ...EDGE_VALUES.map(([id, value]) => ({ id, visible_from: value, due_date: value })),
  { id: 'missing-key' },
];

const ALL_EDGE_IDS = EDGE_ROWS.map((r) => r.id as string);

async function selectedIds(
  filter: unknown,
  rows: Array<Record<string, unknown>> = EDGE_ROWS,
): Promise<string[]> {
  const ds = new ValueDataSource({ items: rows });
  const result = await ds.find('tasks', { $filter: filter as any });
  return result.data.map((r) => r.id as string);
}

describe('objectui#7221 — row sets through ValueDataSource, the card’s filter', () => {
  it('dialect A selects EVERY row, including the ones the filter exists to exclude', async () => {
    // The measured behaviour of path A, on its own. A flat array is not a shape
    // `matchesASTFilter` reads, so nothing is excluded — not the null row, not
    // the row that has no such key.
    expect(await selectedIds(DIALECT_A)).toEqual(ALL_EDGE_IDS);
  });

  it('dialect B selects EVERY row too — for a different reason', async () => {
    // Path B's shape IS read: `and` recurses, each child is a 3-element
    // comparison node. It is the OPERATOR that is unimplemented — the `switch`
    // has no `isnotnull` arm and its `default` returns true.
    expect(await selectedIds(DIALECT_B)).toEqual(ALL_EDGE_IDS);
  });

  it('so the two dialects agree here — at "no filter applied", on both sides', async () => {
    expect(await selectedIds(DIALECT_A)).toEqual(await selectedIds(DIALECT_B));
  });

  it('the null-ness operators never read their value slot, in any spelling', async () => {
    // The card asked specifically whether the matcher reads the value slot for
    // the null-ness operators. It does not — but only because it does not reach
    // the value at all. Filler, `null`, or an absent slot: same rows.
    const rows = [
      { id: 'null-row', visible_from: null },
      { id: 'real-row', visible_from: '2026-01-01' },
    ];
    const both = ['null-row', 'real-row'];
    expect(await selectedIds(['visible_from', 'isnotnull', null], rows)).toEqual(both);
    expect(await selectedIds(['visible_from', 'isnotnull', 'FILLER'], rows)).toEqual(both);
    expect(await selectedIds(['visible_from', 'is_not_null'], rows)).toEqual(both);
    expect(await selectedIds(['and', ['visible_from', 'isnotnull', null]], rows)).toEqual(both);
  });
});

// ---------------------------------------------------------------------------
// 3. Row sets — where the two dialects part
// ---------------------------------------------------------------------------

/** Three rows and an operator pair `matchesASTFilter` genuinely implements. */
const CONTROL_ROWS = [
  { id: 'a', role: 'admin', age: 30 },
  { id: 'b', role: 'user', age: 25 },
  { id: 'c', role: 'admin', age: 20 },
];

/** Dialect A's shape, carrying operators the matcher implements. */
const CONTROL_A = [
  ['role', '=', 'admin'],
  ['age', '>', 24],
];

/** Dialect B's shape, same two conditions. */
const CONTROL_B = ['and', ['role', '=', 'admin'], ['age', '>', 24]];

/** The gate's two-source output: an authored array nested inside an `and`. */
const CONTROL_GATE_TWO_SOURCE = ['and', CONTROL_A, ['id', '!=', 'zzz']];

/** The same three conditions with nothing nested — what the gate would emit if it spread. */
const CONTROL_GATE_FLATTENED = ['and', ['role', '=', 'admin'], ['age', '>', 24], ['id', '!=', 'zzz']];

describe('objectui#7221 — the dialects on an operator the matcher implements', () => {
  it('dialect A’s shape applies NO filter — every row comes back', async () => {
    expect(await selectedIds(CONTROL_A, CONTROL_ROWS)).toEqual(['a', 'b', 'c']);
  });

  it('a single-rule flat array is inert too — it is the SHAPE, not the count', async () => {
    expect(await selectedIds([['role', '=', 'admin']], CONTROL_ROWS)).toEqual(['a', 'b', 'c']);
  });

  it('dialect B’s shape filters correctly — one row of three', async () => {
    expect(await selectedIds(CONTROL_B, CONTROL_ROWS)).toEqual(['a']);
  });

  it('the gate’s two-source shape loses its nested authored rules', async () => {
    // Only the sibling tuple child is evaluated; the nested flat child is
    // swallowed by the same fall-through.
    expect(await selectedIds(CONTROL_GATE_TWO_SOURCE, CONTROL_ROWS)).toEqual(['a', 'b', 'c']);
    expect(await selectedIds(CONTROL_GATE_FLATTENED, CONTROL_ROWS)).toEqual(['a']);
  });

  it.fails(
    'the two dialects select the same rows — diverges — objectui#7221',
    async () => {
      // GREEN today BECAUSE IT FAILS: dialect A returns a,b,c and dialect B
      // returns a. Remove the `.fails` the day one lowered form is agreed on and
      // `matchesASTFilter` reads it.
      expect(await selectedIds(CONTROL_A, CONTROL_ROWS))
        .toEqual(await selectedIds(CONTROL_B, CONTROL_ROWS));
    },
  );

  it.fails(
    'nesting an authored array under `and` preserves its rules — diverges — objectui#7221',
    async () => {
      // The gate's own output versus the same conditions unnested.
      expect(await selectedIds(CONTROL_GATE_TWO_SOURCE, CONTROL_ROWS))
        .toEqual(await selectedIds(CONTROL_GATE_FLATTENED, CONTROL_ROWS));
    },
  );
});
