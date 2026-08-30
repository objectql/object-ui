/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6882 — `DataTableSchema` DECLARES the two schema-level keys
 * `data-table.tsx` has always read: `renderCellEditor` and `cellClassName`
 * (maintainer ruling 2026-08-30, option A).
 *
 * ## Why this pin is compile-time, and why a runtime pin would measure nothing
 *
 * The enforcement being added is a TYPE declaration. `data-table` behaves
 * IDENTICALLY before and after it: both keys were already read on the
 * production path — `renderCellEditor` through an `(schema as any)` cast,
 * `cellClassName` by destructuring into every body cell's class — so no render
 * changes, no runtime value changes, and a rendering test is blind to the whole
 * change. What can fail is a COMPILE. Same reading as
 * `plugin-grid/src/__tests__/dataTableSchemaSlot-6459.test.ts` next door.
 *
 * ## ⚠️ The index signature is what makes the naive pin vacuous
 *
 * `DataTableSchema extends BaseSchema`, and `BaseSchema` carries
 * `[key: string]: any`. So `DataTableSchema['renderCellEditor']` resolves to
 * `any` whether or not the key is declared, and every "is this key there?"
 * spelling written over the raw type answers `true` for EVERY string —
 * including `bogusKeyNobodyDeclared`. A pin written that way is green before
 * the fix, green after it, and measures nothing.
 *
 * `Declared<>` below strips the signature so NON-MEMBERSHIP can exist, which is
 * the only state in which a membership question has an answer.
 *
 * ## ⚠️ …and `extends` alone is vacuous a second way
 *
 * `Expect<X extends true ? true : false>` is satisfied by `never` (assignable
 * to everything) and by `any`. `Equal<>` below is the invariant
 * (function-parameter-identity) comparison instead, so neither passes.
 *
 * ## How the DIRECTION is proved, rather than asserted
 *
 * Four `@ts-expect-error` directives below are the load-bearing half. TypeScript
 * reports an UNUSED `@ts-expect-error` as an error (TS2578), so each of them is
 * a claim that the instrument REFUSES something:
 *
 *   - `Expect<false>` must be refused → the assertion helper has teeth;
 *   - `Equal<never, true>` and `Equal<any, true>` must resolve `false` → the
 *     comparison is invariant, not `extends`-shaped;
 *   - `IsDeclaredOn<'…probe…'>` must resolve `false` → the strip really removed
 *     the index signature, so a non-member is answerable.
 *
 * Break any part of the instrument — make `Expect` accept anything, make
 * `Equal` bivariant, make `Declared` a no-op — and this file goes RED on the
 * now-unused directive rather than quietly passing. That is the property the
 * positive assertions borrow their meaning from.
 */
import { describe, it, expect } from 'vitest';
import type { DataTableSchema } from '../data-display.js';

/**
 * `T` with its string/number index signatures removed — the same shape
 * `plugin-grid`'s `RemoveIndexSignature` uses at the seam, restated here so
 * this package's pin does not depend on a downstream package.
 */
type Declared<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/** Invariant type equality. `A extends B` is NOT this: `never` and `any` pass that. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** The only assertion form used here — its constraint is what refuses `false`. */
type Expect<T extends true> = T;

/** Is `K` a DECLARED member of `DataTableSchema` (index signature stripped)? */
type IsDeclaredOn<K extends PropertyKey> = K extends keyof Declared<DataTableSchema> ? true : false;

/* ── Direction proofs: a broken instrument makes THIS file red ─────────────── */

// @ts-expect-error objectui#6882 — `Expect` must refuse `false`. Widen its constraint and this directive goes unused (TS2578).
type _ExpectRefusesFalse = Expect<false>;

// @ts-expect-error objectui#6882 — `never` must NOT read as equal to `true`. An `extends`-shaped comparison would let it through.
type _EqualRefusesNever = Expect<Equal<never, true>>;

// @ts-expect-error objectui#6882 — `any` must NOT read as equal to `true`, for the same reason.
type _EqualRefusesAny = Expect<Equal<any, true>>;

// @ts-expect-error objectui#6882 — a key nothing declares must answer `false`. If `Declared<>` stopped stripping `[key: string]: any`, this would answer `true` and the directive would go unused.
type _UndeclaredKeyIsRefused = Expect<IsDeclaredOn<'bogusKeyNobodyDeclares6882'>>;

/* ── The assertions the card is about ─────────────────────────────────────── */

/** RED before objectui#6882's declaration, green after. */
type _RenderCellEditorIsDeclared = Expect<IsDeclaredOn<'renderCellEditor'>>;
/** RED before objectui#6882's declaration, green after. */
type _CellClassNameIsDeclared = Expect<IsDeclaredOn<'cellClassName'>>;

/**
 * The context object `data-table.tsx` actually passes to the injected editor,
 * transcribed from its call site. Declaring the key with any other shape is a
 * different (and false) statement about the renderer, so the shape is pinned,
 * not just the membership.
 */
type CellEditorContext = {
  column: any;
  row: any;
  value: any;
  stage: (v: any) => void;
  commit: (v?: any) => void;
  cancel: () => void;
};

type _RenderCellEditorShape = Expect<
  Equal<
    Declared<DataTableSchema>['renderCellEditor'],
    ((ctx: CellEditorContext) => React.ReactNode) | undefined
  >
>;

/** Matches `TableColumn.cellClassName` and `BaseSchema.className` — both `string`. */
type _CellClassNameShape = Expect<Equal<Declared<DataTableSchema>['cellClassName'], string | undefined>>;

describe('objectui#6882 — DataTableSchema declares the two keys data-table reads', () => {
  /**
   * The runtime half exists only so the compile-time pins above have a file
   * vitest also runs; the assertions that matter are erased before this runs.
   * It does carry one honest statement: an author writing both keys produces an
   * ordinary `DataTableSchema` value, no cast anywhere.
   */
  it('an author can write both keys on a plain DataTableSchema value', () => {
    const authored: DataTableSchema = {
      type: 'data-table',
      columns: [{ header: 'Name', accessorKey: 'name' }],
      data: [],
      cellClassName: 'px-3 py-1',
      renderCellEditor: ({ value }) => (value == null ? null : null),
    };

    expect(authored.cellClassName).toBe('px-3 py-1');
    expect(typeof authored.renderCellEditor).toBe('function');
  });
});
