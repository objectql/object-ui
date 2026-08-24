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
// set — five live, nine tombstoned, none invented, none forgotten. If a key
// is ever added to `TableColumn` without a deliberate decision on the static
// side (live or tombstone), this line goes red.
type _SameKeySet = Expect<Equal<keyof StaticTableColumn, keyof TableColumn>>;

/* ── fixtures ────────────────────────────────────────────────────────────── */

const LIVE_COLUMN = {
  header: 'Amount',
  accessorKey: 'amount',
  className: 'w-32',
  cellClassName: 'text-right',
  width: 120,
};

/** The nine column keys the split retires from the static surface, with the
 *  value an author would plausibly write for each. */
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
  it('narrow zod declares exactly the interface key set: 5 live + 9 tombstones', () => {
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
