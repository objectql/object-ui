/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6459 — the data-table SCHEMA SLOT ObjectGrid fills (the receiver
 * half of the seam whose producer half #6004 typed).
 *
 * ⚠️ THE DEFECT IS TYPE-LEVEL, SO A RENDERING TEST IS BLIND TO IT — same as
 * `columnEmitBoundary-6004.test.ts` next door, and for the same reason: a grid
 * renders identically with `const dataTableSchema: any`. What can fail is a
 * COMPILE, so these pins are compile-time and this file's value is that
 * `tsc -p tsconfig.test.json` reads it (verified with `--listFiles`, not
 * assumed — the package build's program excludes `__tests__`).
 *
 * The mechanism pinned here is DIFFERENT from #6004's. There, `.map()`
 * laundered freshness away and only `?: never` tombstones could refuse; here
 * both writers are literals sitting DIRECTLY in annotated positions, so
 * excess-property checking is the live instrument — PROVIDED the type has no
 * index signature. `BaseSchema`'s `[key: string]: any` (which `DataTableSchema`
 * inherits) makes every key a member, and a check that refuses non-members has
 * nothing to refuse when non-membership cannot exist. `RemoveIndexSignature` in
 * `ObjectGrid.tsx` is what turns the annotation from inert to able-to-fail,
 * and the pins below hold each half of that claim separately.
 */
import { describe, it, expect } from 'vitest';
import type { DataTableSchema, TableColumn } from '@object-ui/types';
import type {
  DeclaredDataTableSchema,
  ObjectGridDataTableSchema,
} from '../ObjectGrid';

/** Compile-time truth assertion, erased at runtime — only `tsc` checks these. */
type Expect<T extends true> = T;

const columns: TableColumn[] = [{ header: 'Name', accessorKey: 'name' }];

describe('objectui#6459 — the schema slot annotation is an instrument, not a decoration', () => {
  /**
   * ⭐ THE ROOT CAUSE, PINNED: a bare `DataTableSchema` annotation refuses
   * NOTHING. This assignment MUST COMPILE — the bogus key is written out
   * longhand in a FRESH literal, the strongest position excess-property
   * checking ever has, and the inherited `[key: string]: any` still admits it.
   * Measured on the real seam before the fix was shaped (`tsc --noEmit`
   * exit 0, zero diagnostics, with `bogusKeyForProbe6459: true` injected into
   * the flat literal under a bare annotation). If this ever goes red,
   * TypeScript or `BaseSchema` changed underneath and the docblock above
   * `RemoveIndexSignature` in `ObjectGrid.tsx` needs re-measuring.
   */
  it('a bare `DataTableSchema` annotation accepts a bogus key even at a fresh literal (the blind instrument)', () => {
    const blind: DataTableSchema = {
      type: 'data-table',
      columns,
      data: [],
      bogusKeyRefusedNowhere: 'admitted by the index signature',
    };
    expect(blind.type).toBe('data-table');
  });

  /**
   * …and the index signature is exactly what separates the two types: present
   * on `DataTableSchema`, stripped from the seam type. If `@object-ui/types`
   * ever removes the signature from `BaseSchema`, the first line goes red —
   * a useful red: the local stripping machinery becomes redundant that day.
   */
  it('the strip is real: `string` indexes `DataTableSchema` but not the seam type', () => {
    type _UpstreamHasIndex = Expect<string extends keyof DataTableSchema ? true : false>;
    type _SeamHasNone = Expect<string extends keyof ObjectGridDataTableSchema ? false : true>;
    expect(true).toBe(true);
  });

  /**
   * THE SAME SHAPE, against the seam type: REFUSED. One cause only — with the
   * index signature stripped the key is a non-member, and the literal is fresh,
   * so TS2353 names it. This is the "shown able to fail" the card demanded.
   */
  it('the seam type refuses a bogus key written out in a fresh literal', () => {
    const refused: ObjectGridDataTableSchema = {
      type: 'data-table',
      columns,
      data: [],
      // @ts-expect-error objectui#6459 — undeclared key, refused once the index signature is stripped.
      bogusKeyRefusedHere: true,
    };
    expect(refused.type).toBe('data-table');
  });

  /**
   * The group-table writer is the same instrument: `buildGroupTableSchema`
   * returns a literal contextually typed by the annotation, so a longhand key
   * is fresh there too, and the spread it carries comes from the already
   * checked `const` — every key entering the spread was refused or admitted at
   * ITS literal. Pinned in the writer's exact shape (spread + longhand keys in
   * an annotated arrow return).
   */
  it('the seam type refuses a bogus key in the grouped writer shape (spread + longhand)', () => {
    const base: ObjectGridDataTableSchema = { type: 'data-table', columns, data: [] };
    const build = (): ObjectGridDataTableSchema => ({
      ...base,
      pagination: false,
      // @ts-expect-error objectui#6459 — longhand keys stay fresh in an annotated return literal.
      bogusGroupKey: 1,
    });
    expect(build().pagination).toBe(false);
  });

  /**
   * ⭐ THE INSTRUMENT'S BOUNDARY, pinned so nobody mistakes this for
   * tombstone-grade coverage. This assignment MUST COMPILE: the value is
   * NON-FRESH (it has a declared type of its own), and assignability admits
   * extra members — that is structural typing, not a defect. A key RETIRED by
   * ruling still needs a `?: never` tombstone (see
   * `ObjectGridRetiredOptionsTombstone`); the open census cannot be
   * tombstoned, because a tombstone needs the key's name. If this ever goes
   * red, TypeScript tightened and both docblocks need re-measuring.
   */
  it('a bogus key riding a non-fresh value is admitted (assignability, the known boundary)', () => {
    const staged: { type: 'data-table'; columns: TableColumn[]; data: unknown[]; smuggled?: string } = {
      type: 'data-table',
      columns,
      data: [],
      smuggled: 'assignability admits extra members',
    };
    const slot: ObjectGridDataTableSchema = staged;
    expect(slot.type).toBe('data-table');
  });

  /**
   * The two schema-level keys that were the whole census, measured on
   * `38a123cac` by diffing the 46 flat-literal keys (+ the 8 group-literal
   * keys) against `DataTableSchema` + `BaseSchema` declared members.
   *
   * ⚠️ They are no longer HELD, and this assertion is why nobody noticed:
   * objectui#6882 (2026-08-30) DECLARED both on `DataTableSchema`, and the
   * assertion below stays green either way. It pins that the seam ACCEPTS the
   * two keys — true while they are held here, equally true once they arrive
   * through `DeclaredDataTableSchema`. An acceptance pin cannot express a hold's
   * ENTRY CONDITION, so this suite could never have gone red at the moment of
   * loss. Re-derived by objectui#7196; the diff now leaves ZERO undeclared keys,
   * and `ObjectGrid.tsx`'s `ObjectGridDataTableSchemaHolds` carries the full
   * record. The guard that WOULD have caught it is the column-level twin's:
   * `columnHoldsExpiry-6424.test.ts` asserts `TableColumn` does not declare
   * `pinned`. Filed by #7196 as a separate finding, ⛔ deliberately not a rider.
   *
   * The assertion itself keeps its value unchanged: both keys must remain
   * writable at this seam, whichever side declares them.
   */
  it('accepts both schema-level keys — renderCellEditor and cellClassName', () => {
    const held: ObjectGridDataTableSchema = {
      type: 'data-table',
      columns,
      data: [],
      cellClassName: 'px-3 py-1',
      renderCellEditor: (ctx) => (ctx.column ? null : null),
    };
    expect(held.cellClassName).toBe('px-3 py-1');
  });

  /**
   * The strip is HOMOMORPHIC — declared members survive with their exact
   * shapes: required stays required (`columns`), optional stays optional and
   * typed (`singleClickEdit`). A strip that dropped or widened members would
   * compile the seam annotation trivially and check nothing.
   */
  it('declared members survive the strip with modifiers intact', () => {
    type _ColumnsSurvive = Expect<DeclaredDataTableSchema['columns'] extends TableColumn[] ? true : false>;
    type _SingleClickTyped = Expect<
      DeclaredDataTableSchema['singleClickEdit'] extends boolean | undefined ? true : false
    >;
    // @ts-expect-error objectui#6459 — `columns` is required; the mapped type must not have made it optional.
    const missing: ObjectGridDataTableSchema = { type: 'data-table', data: [] };
    expect(missing.type).toBe('data-table');
  });
});
