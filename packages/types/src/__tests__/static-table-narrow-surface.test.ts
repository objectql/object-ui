/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The static `table` surface is the NARROW split, and it refuses the rich
 * keys LOUDLY (objectui#5474, maintainer ruling 2026-08-22: Option C — split
 * the types).
 *
 * Before the split, `TableSchema.columns` shared the rich `TableColumn` that
 * `data-table` honours, so 11 declared keys were accepted, type-checked, and
 * did nothing on the static renderer — `hoverable` / `striped` even carried
 * `@default` annotations and reference-page teaching describing behaviour
 * that did not exist. The ruling keeps `TableColumn` rich for `data-table`
 * and gives the static renderer its own declared subset
 * (`StaticTableColumn`), so declared = enforced holds per renderer.
 *
 * The retired keys are ADR-0049 TOMBSTONES (`?: never` on the interface,
 * `z.never().optional()` on the Zod twin — the convention `crud.ts` `confirm`
 * set), NOT deletions: a deleted key would be silently STRIPPED by zod's
 * non-strict objects, which is the same silence one layer over. The ruling
 * records loud refusal as the intended outcome for existing schemas that
 * authored these keys — do not soften these pins into strips.
 *
 * Three-sided pin:
 *   1. the narrow surface REFUSES every retired key, naming it in the error
 *      path (the loud half);
 *   2. the rich surface still ACCEPTS the same keys (the ruling's "TableColumn
 *      remains the rich shared shape" half — a narrowing there is a different
 *      defect this file must catch too);
 *   3. the two column shapes declare the SAME key set (tombstones included),
 *      so a column migrating between `table` and `data-table` never meets an
 *      unknown key — checked at type level and against the zod shapes.
 *
 * The behaviour half — that the renderer reads exactly the narrow live set —
 * is pinned in `packages/components/src/renderers/complex/__tests__/`
 * `table-declared-equals-enforced.test.tsx`.
 *
 * The `@ts-expect-error` directives are REAL enforcement: this package
 * type-checks its tests through `tsconfig.test.json`, so re-widening either
 * declaration fails the build on the unused directive (same mechanism as
 * `accordion-item-authorable-keys.test.ts`).
 */

import { describe, it, expect } from 'vitest';
import type { StaticTableColumn, TableColumn, TableSchema } from '../data-display';
import {
  StaticTableColumnSchema,
  TableColumnSchema,
  TableSchema as TableZod,
  DataTableSchema as DataTableZod,
} from '../zod/data-display.zod';

/* ── type-level pins ─────────────────────────────────────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// Side 3, type level: the narrow shape declares exactly the rich shape's key
// set — five live, fourteen tombstoned, none invented, none forgotten. If a
// key is ever added to `TableColumn` without a deliberate decision on the
// static side (live or tombstone), this line goes red. (`headerIcon` was the
// first key to arrive through that gate — added rich by objectui#6424,
// tombstoned here — then #6425's three declared field-meta overrides, and now
// `fitContent`, objectui#6424's second key.)
type _SameKeySet = Expect<Equal<keyof StaticTableColumn, keyof TableColumn>>;

// The DECLARATION itself, read directly off the interface — no object literal
// anywhere, so excess-property freshness plays no part. If `fitContent` were
// undeclared, `TableColumn['fitContent']` would not resolve and this line
// would not compile; if it were declared at a different type, `Equal` fails.
// This is the pin a fresh-literal test cannot give: a literal is refused for
// an undeclared key AND accepted for a declared one, so it measures freshness
// and declaration together, while this measures only the declaration
// (objectui#6424, maintainer ruling 2026-08-28, Option A).
type _FitContentDeclaredRich = Expect<Equal<TableColumn['fitContent'], boolean | undefined>>;
// The static twin's tombstone, same freshness-free route: `?: never` (never
// `undefined`-only, never absent). Absence would make this line fail to
// compile, which is the lockstep rule's whole point.
type _FitContentTombstonedStatic = Expect<Equal<StaticTableColumn['fitContent'], undefined>>;

/* ── fixtures ────────────────────────────────────────────────────────────── */

const LIVE_COLUMN = {
  header: 'Amount',
  accessorKey: 'amount',
  className: 'w-32',
  cellClassName: 'text-right',
  width: 120,
};

/** The fourteen keys the narrow surface refuses, with the value an author
 *  would plausibly write for each: nine the #5474 split retired, plus the five
 *  that joined the RICH shape later and are tombstoned here under the lockstep
 *  rule — `headerIcon` and `fitContent` (objectui#6424's two keys) and the
 *  three field-meta overrides objectui#6425 declared (`format` / `options` /
 *  `currency`). The static renderer reads none of them: its measured read set
 *  is the five live keys, and it has no auto-width pass for `fitContent` to
 *  opt out of. */
const RETIRED_COLUMN_KEYS: Record<string, unknown> = {
  minWidth: 80,
  align: 'right',
  fixed: 'left',
  type: 'currency',
  sortable: true,
  filterable: true,
  resizable: true,
  editable: false,
  cell: () => 'x',
  headerIcon: 'lucide:hash',
  fitContent: true,
  format: '$0,0',
  options: [{ value: 'tech', label: 'Technology' }],
  currency: 'EUR',
};

/** Every key the rich `TableColumn` interface declares. `satisfies` keeps the
 *  list honest against renames; the `Equal` pin keeps it EXHAUSTIVE — a key
 *  added to the interface without a deliberate mirror decision fails
 *  type-check here before the zod parity test can even run (objectui#5821). */
const RICH_COLUMN_KEYS = [
  'header',
  'accessorKey',
  'className',
  'cellClassName',
  'width',
  'minWidth',
  'align',
  'fixed',
  'type',
  'sortable',
  'filterable',
  'resizable',
  'editable',
  'cell',
  'headerIcon',
  'fitContent',
  'format',
  'options',
  'currency',
] as const satisfies readonly (keyof TableColumn)[];
type _RichKeyListExhaustive = Expect<Equal<(typeof RICH_COLUMN_KEYS)[number], keyof TableColumn>>;

const STATIC_TABLE = {
  type: 'table',
  caption: 'Recent Orders',
  columns: [{ header: 'Amount', accessorKey: 'amount' }],
  data: [{ amount: '$1,200' }],
};

/* ── zod shape introspection (zod 4; see object-view-spec-parity.test.ts) ── */

function shapeOf(schema: unknown): Record<string, unknown> {
  const carrier = schema as { shape?: unknown; _def?: { shape?: unknown } };
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return (resolved ?? {}) as Record<string, unknown>;
}

/** Unwrap ONE `.optional()` hop — a tombstone is never deeper than one. */
function isTombstoned(schema: unknown, key: string): boolean {
  const member = shapeOf(schema)[key] as { unwrap?: () => unknown } | undefined;
  const inner = typeof member?.unwrap === 'function' ? member.unwrap() : member;
  const def = (inner as { _def?: { type?: string }; def?: { type?: string } } | undefined);
  return (def?._def?.type ?? def?.def?.type) === 'never';
}

const liveKeys = (schema: unknown) =>
  Object.keys(shapeOf(schema)).filter((k) => !isTombstoned(schema, k));
const tombstonedKeys = (schema: unknown) =>
  Object.keys(shapeOf(schema)).filter((k) => isTombstoned(schema, k));

/* ── 1. the narrow surface refuses, loudly ───────────────────────────────── */

describe('static `table` — the narrow zod surface refuses the retired keys (objectui#5474)', () => {
  it('accepts the narrow live column and a fully-live static table (control)', () => {
    expect(StaticTableColumnSchema.safeParse(LIVE_COLUMN).success).toBe(true);
    expect(TableZod.safeParse(STATIC_TABLE).success).toBe(true);
  });

  for (const [key, value] of Object.entries(RETIRED_COLUMN_KEYS)) {
    it(`REFUSES a column authoring \`${key}\`, and names the key in the error path`, () => {
      const result = StaticTableColumnSchema.safeParse({
        header: 'Amount',
        accessorKey: 'amount',
        [key]: value,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Loud and addressed: the rejection points AT the authored key. A
        // silent strip would have parsed green — that is the pre-split defect,
        // and the ruling explicitly accepts the loud refusal instead.
        expect(result.error.issues.map((i) => String(i.path[0]))).toContain(key);
      }
    });
  }

  for (const key of ['hoverable', 'striped'] as const) {
    it(`REFUSES a static table authoring \`${key}\` — the documented-as-working pair`, () => {
      const result = TableZod.safeParse({ ...STATIC_TABLE, [key]: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((i) => String(i.path[0]))).toContain(key);
      }
    });
  }

  it('REFUSES the retired keys inside `columns`, not only at top level', () => {
    const result = TableZod.safeParse({
      ...STATIC_TABLE,
      columns: [{ header: 'Amount', accessorKey: 'amount', align: 'right', sortable: true }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('columns.0.align');
      expect(paths).toContain('columns.0.sortable');
    }
  });
});

/* ── 2. the rich surface is untouched ────────────────────────────────────── */

describe('rich `TableColumn` — NOT narrowed by the split (ruling scope, objectui#5474)', () => {
  it('the rich zod column still accepts every interactive key it declares', () => {
    // `editable` included since objectui#5821: the rich ZOD mirror declares
    // it now, closing the drift the split had to leave tracked separately.
    const result = TableColumnSchema.safeParse({
      header: 'Amount',
      accessorKey: 'amount',
      ...RETIRED_COLUMN_KEYS,
    });
    expect(result.success).toBe(true);
  });

  it('`editable: false` SURVIVES the rich parse — a locked column stays locked (objectui#5821)', () => {
    // Acceptance alone cannot pin this: a non-strict z.object() ACCEPTS an
    // undeclared key and silently STRIPS it, and the renderer treats absence
    // as editable (`col.editable !== false`, data-table.tsx) — so before the
    // mirror declared `editable`, this exact parse succeeded green while
    // re-opening the locked column. The pin is the key surviving into the
    // parsed OUTPUT, not the parse succeeding.
    const result = TableColumnSchema.safeParse({
      header: 'Amount',
      accessorKey: 'amount',
      editable: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('editable' in result.data).toBe(true);
      expect(result.data.editable).toBe(false);
    }
  });

  it('the #6425 trio SURVIVES the rich parse — declared, not silently stripped', () => {
    // Same discipline as `editable: false` above and `headerIcon` in
    // `data-table-declared-column-keys.test.tsx` (objectui#6424): a non-strict
    // z.object() ACCEPTS an undeclared key and silently STRIPS it, so this
    // exact parse was green BEFORE objectui#6425 declared the keys — while the
    // authored override vanished from the output. Acceptance cannot
    // distinguish the fix from the defect; survival into the parsed OUTPUT
    // can. `value` is an object sentinel: it rides `z.any()`, so it must
    // survive BY IDENTITY, which also pins that the mirror is not coercing.
    const valueSentinel = { code: 'tech' };
    const authored = {
      header: 'Amount',
      accessorKey: 'amount',
      format: '$0,0',
      options: [{ value: valueSentinel, label: 'Technology', color: 'blue' }],
      currency: 'EUR',
    };
    const result = TableColumnSchema.safeParse(authored);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('$0,0');
      expect(result.data.currency).toBe('EUR');
      expect(result.data.options).toEqual(authored.options);
      expect(result.data.options?.[0]?.value).toBe(valueSentinel);
    }
  });

  it('`data-table` columns still parse with the rich keys authored', () => {
    const result = DataTableZod.safeParse({
      type: 'data-table',
      columns: [{ header: 'Amount', accessorKey: 'amount', align: 'right', sortable: true }],
      data: [{ amount: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it('the rich zod column carries NO tombstones — the split retired nothing there', () => {
    expect(tombstonedKeys(TableColumnSchema)).toEqual([]);
  });
});

/* ── 3. the two shapes stay in lockstep ──────────────────────────────────── */

describe('the split itself — narrow = rich key set, live = the measured read set', () => {
  it('narrow zod declares exactly the interface key set: 5 live + 14 tombstones', () => {
    expect(liveKeys(StaticTableColumnSchema).sort()).toEqual(
      ['accessorKey', 'cellClassName', 'className', 'header', 'width'].sort(),
    );
    expect(tombstonedKeys(StaticTableColumnSchema).sort()).toEqual(
      Object.keys(RETIRED_COLUMN_KEYS).sort(),
    );
  });

  it('the rich zod mirror declares exactly the interface key set — nothing silently strippable (objectui#5821)', () => {
    expect(Object.keys(shapeOf(TableColumnSchema)).sort()).toEqual([...RICH_COLUMN_KEYS].sort());
  });

  it('the static table zod tombstones exactly `hoverable` and `striped`', () => {
    expect(tombstonedKeys(TableZod).sort()).toEqual(['hoverable', 'striped']);
  });
});

/* ── the tsc half of the tombstones ──────────────────────────────────────── */

describe('interface tombstones — authoring a retired key is a tsc error', () => {
  it('refuses `hoverable` on a TableSchema literal', () => {
    const schema: TableSchema = {
      type: 'table',
      columns: [{ header: 'Amount', accessorKey: 'amount' }],
      data: [],
      // @ts-expect-error `hoverable` is a tombstone (objectui#5474) — the
      // static renderer never implemented it; use data-table.
      hoverable: true,
    };
    expect(schema.type).toBe('table');
  });

  it('refuses `align` on a StaticTableColumn literal', () => {
    const column: StaticTableColumn = {
      header: 'Amount',
      accessorKey: 'amount',
      // @ts-expect-error `align` is a tombstone (objectui#5474) — right-align
      // via `cellClassName: 'text-right'`, or use data-table.
      align: 'right',
    };
    expect(column.header).toBe('Amount');
  });

  it('accepts `fitContent` on a rich TableColumn, and REFUSES it on the static twin (#6424)', () => {
    // Both halves of the ruled declaration at the tsc layer. The static half
    // carries the directive; the rich half deliberately does NOT, so a later
    // narrowing of `TableColumn` fails here rather than passing silently.
    const rich: TableColumn = {
      header: 'Actions',
      accessorKey: '_actions',
      fitContent: true,
    };
    const narrow: StaticTableColumn = {
      header: 'Actions',
      accessorKey: '_actions',
      // @ts-expect-error `fitContent` is tombstoned on the narrow surface
      // (objectui#6424, under #5474's lockstep rule) — the static renderer
      // has no auto-width pass to opt out of; use data-table.
      fitContent: true,
    };
    expect(rich.fitContent).toBe(true);
    expect(narrow.header).toBe('Actions');
  });

  it('FRESHNESS-FREE: the tombstone refuses a NON-FRESH value too, and the rich READ compiles (#6424)', () => {
    // Why this test exists on top of the one above. At a FRESH object literal
    // an undeclared key and a `?: never` tombstone are indistinguishable —
    // both are tsc errors, by excess-property checking. Route the same value
    // through a variable and the two come apart: excess properties on a
    // NON-FRESH value are structurally fine, so an undeclared key would be
    // ACCEPTED here and the directive below would go unused (a red build in
    // this package, which type-checks its tests). Only a real tombstone
    // refuses it. The literal pins the authoring surface; this pins the
    // declaration.
    const authored = { header: 'Actions', accessorKey: '_actions', fitContent: true };

    // @ts-expect-error `fitContent: boolean` is not assignable to the
    // tombstoned `fitContent?: never` — the refusal survives widening, so it
    // is the tombstone doing the work, not literal freshness.
    const narrow: StaticTableColumn = authored;

    // The rich side, freshness-free in the other direction: assigning a wider
    // object is legal whether or not the key is declared, so the pin is the
    // READ — `column.fitContent` only compiles if `TableColumn` DECLARES it,
    // and the annotation pins the declared type while it is at it.
    const column: TableColumn = authored;
    const fit: boolean | undefined = column.fitContent;

    expect(fit).toBe(true);
    expect(narrow.accessorKey).toBe('_actions');
  });

  it('still accepts the interactive keys on the RICH TableColumn (control)', () => {
    // No directive here on purpose: if the rich interface ever narrows, this
    // literal stops compiling — which is exactly the regression the ruling
    // forbids ("TableColumn remains the rich shared shape").
    const column: TableColumn = {
      header: 'Amount',
      accessorKey: 'amount',
      align: 'right',
      sortable: true,
      cell: (value) => value,
    };
    expect(column.align).toBe('right');
  });
});
