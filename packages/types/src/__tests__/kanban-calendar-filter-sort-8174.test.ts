/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#8174 — `ObjectKanbanSchema.filter`, `ObjectCalendarSchema.filter`
 * and `ObjectCalendarSchema.sort` declared, on both faces.
 *
 * ## The defect
 *
 * `filter` had FOUR faces and only three of them named it. `@objectstack/spec`
 * declares it (`ComponentPropsMap['object-kanban']`,
 * `ComponentPropsMap['object-calendar']`); both plugins' registration `inputs`
 * publish it; both renderers READ it — `plugin-kanban/src/ObjectKanban.tsx`
 * lowers `schema.filter` onto `$filter` at its `dataSource.find` call, and
 * `plugin-calendar/src/ObjectCalendar.tsx` does the same and additionally
 * lowers `schema.sort` onto `$orderby` through `convertSortToQueryParams`. The
 * declaration face of `@object-ui/types` named none of them: an authored value
 * reached the renderer through `BaseSchema`'s `[key: string]: any` on the TS
 * side and through `.passthrough()` on the mirror — admitted, never examined.
 *
 * That is verbatim the reasoning objectui#7322 used to move `groupBy` and
 * `limit` into `ObjectKanbanSchema`, one key over on the same interface.
 *
 * ## What declaring buys — and what it does NOT, measured not assumed
 *
 * objectui#7927 measured the ceiling: `BaseSchema` ends in `[key: string]: any`,
 * so no annotation on any node schema can catch a MISSPELLED key. That ceiling
 * is real and this card does not lift it — `filtr` stays admitted on both
 * faces, and the control assertions below PIN that, so nobody reads this file as
 * claiming more than it does.
 *
 * What the ceiling does not cap is the VALUE dimension, and that is the half
 * this file pins:
 *
 * - TS: the member narrows `any` to `any[]` / `SortConfig[]`. `filter: 'a = b'`
 *   and `sort: 'name asc'` were assignable through the index signature and are
 *   now type errors. Each `@ts-expect-error` below goes UNUSED — TS2578, a hard
 *   type-check failure — the moment its member is deleted, which is what makes
 *   these pins rather than restatements.
 * - Mirror: under `.passthrough()` a DECLARED key is value-validated where an
 *   undeclared one rides through unexamined, and this mirror reaches
 *   `safeValidateSchema` through `AnyComponentSchema`, so the refusal reaches
 *   the CLI's `validate` / `check`.
 *
 * The `sort` half carries the sharpest case. objectui#8221 retired the legacy
 * string clause: `convertSortToQueryParams` no longer admits a string in its
 * signature and, when one arrives anyway, reports the retired spelling and
 * returns `undefined`. So `sort: 'name asc'` on an `object-calendar` node
 * type-checked green, parsed green, and then silently produced an UNSORTED
 * calendar. Declaring the member is what makes that retirement audible at the
 * authoring boundary; the core-side behaviour is pinned off disk below so the
 * docblock's claim cannot rot.
 *
 * ## Instruments, borrowed from `object-kanban-group-by-limit-7322.test.ts`
 *
 * Membership is asserted on the mirror's OWN `.shape`, never on parse
 * acceptance (under `.passthrough()` acceptance cannot tell "declared" from
 * "admitted unexamined"). Type-level pins use invariant equality, so a member
 * that fell back to the index signature reads as `any` and therefore as a
 * failure. And every claim carries a CONTROL that is asserted to stay
 * undeclared — including the deliberate absence of `sort` on the kanban board,
 * which is measured off the renderer rather than assumed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ComponentPropsMap } from '@objectstack/spec/ui';

import { ObjectCalendarSchema, ObjectKanbanSchema, safeValidateSchema } from '../zod/index.zod';
import type {
  ObjectCalendarSchema as TsObjectCalendarSchema,
  ObjectKanbanSchema as TsObjectKanbanSchema,
  SortConfig,
} from '../objectql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const KANBAN_READER = 'packages/plugin-kanban/src/ObjectKanban.tsx';
const CALENDAR_READER = 'packages/plugin-calendar/src/ObjectCalendar.tsx';
const SORT_QUERY = 'packages/core/src/utils/sort-query.ts';

/**
 * A key neither renderer reads and neither face declares. It is the non-vacuity
 * control for every "declared" assertion below: it must stay `any` on the TS
 * face and stay out of both mirror shapes, while still being ADMITTED — which
 * is the objectui#7927 ceiling, pinned rather than claimed away.
 */
const CONTROL_KEY = 'whereClause';
/** A declared-keys-only control of the read census: read, declared, untouched. */
const READ_CONTROL_KEY = 'objectName';
/** The misspelling objectui#7927's ceiling still admits. Pinned, not fixed here. */
const MISSPELLING = 'filtr';

/** The documented nodes; every assertion below is a delta on one of them. */
const KANBAN_NODE = { type: 'object-kanban', objectName: 'opportunity', groupBy: 'stage' } as const;
const CALENDAR_NODE = { type: 'object-calendar', objectName: 'event' } as const;

/** A well-formed value for each declared member. */
const FILTER_VALUE = [['status', '=', 'open']];
const SORT_VALUE: SortConfig[] = [{ field: 'start_date', order: 'asc' }];

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** The canonical `any` detector: only `any` absorbs `1 &` down to something `0` extends. */
type IsAny<T> = 0 extends (1 & T) ? true : false;
/** An object with no keys is assignable to `Pick<T, K>` only when `K` is optional on `T`. */
type IsOptional<T, K extends keyof T> = Record<string, never> extends Pick<T, K> ? true : false;

// `filter` on BOTH interfaces: declared `any[]`, optional, not `any`. Delete
// either member and the indexed access falls back to `[key: string]: any`,
// making `IsAny` true and `Equal<any, any[] | undefined>` false.
export type _KanbanFilterIsArray = Expect<Equal<TsObjectKanbanSchema['filter'], any[] | undefined>>;
export type _KanbanFilterIsNotAny = Expect<Equal<IsAny<TsObjectKanbanSchema['filter']>, false>>;
export type _KanbanFilterIsOptional = Expect<IsOptional<TsObjectKanbanSchema, 'filter'>>;
export type _CalendarFilterIsArray = Expect<Equal<TsObjectCalendarSchema['filter'], any[] | undefined>>;
export type _CalendarFilterIsNotAny = Expect<Equal<IsAny<TsObjectCalendarSchema['filter']>, false>>;
export type _CalendarFilterIsOptional = Expect<IsOptional<TsObjectCalendarSchema, 'filter'>>;
// `sort` on the CALENDAR only: declared `SortConfig[]`, optional, not `any`.
export type _CalendarSortIsSortConfigArray = Expect<Equal<TsObjectCalendarSchema['sort'], SortConfig[] | undefined>>;
export type _CalendarSortIsNotAny = Expect<Equal<IsAny<TsObjectCalendarSchema['sort']>, false>>;
export type _CalendarSortIsOptional = Expect<IsOptional<TsObjectCalendarSchema, 'sort'>>;
// …and DELIBERATELY not on the kanban board, whose renderer issues no
// `$orderby`. It still falls through to the index signature. Declaring it turns
// this red — which is the point: this card declares what is read, nothing more.
export type _KanbanSortStaysUndeclared = Expect<IsAny<TsObjectKanbanSchema['sort']>>;
// The control key is undeclared on both, exactly as `filter` was before this
// card. Same instrument, opposite verdict.
export type _KanbanControlKeyFallsThrough = Expect<IsAny<TsObjectKanbanSchema['whereClause']>>;
export type _CalendarControlKeyFallsThrough = Expect<IsAny<TsObjectCalendarSchema['whereClause']>>;
// objectui#7927's ceiling, pinned rather than claimed away: a MISSPELLED key
// still resolves to `any` and still type-checks. This card does not fix that,
// and this line is what stops anyone reading it as if it had.
export type _MisspellingStillAdmitted = Expect<IsAny<TsObjectCalendarSchema['filtr']>>;

// The TS face ACCEPTS the documented shapes on a literal…
const kanbanLiteral: TsObjectKanbanSchema = { ...KANBAN_NODE, filter: FILTER_VALUE };
const calendarLiteral: TsObjectCalendarSchema = { ...CALENDAR_NODE, filter: FILTER_VALUE, sort: SORT_VALUE };

// …and REFUSES wrong-typed values that the index signature used to admit. Each
// directive goes unused — TS2578, a hard failure — if its member is deleted.
// @ts-expect-error — `filter` is `any[]`; a string clause is not a JSON-Rules filter
const kanbanBadFilter: TsObjectKanbanSchema = { ...KANBAN_NODE, filter: 'status = open' };
// @ts-expect-error — `filter` is `any[]`; a string clause is not a JSON-Rules filter
const calendarBadFilter: TsObjectCalendarSchema = { ...CALENDAR_NODE, filter: 'status = open' };
// @ts-expect-error — the legacy string `sort` clause is RETIRED (objectui#8221); author `[{ field, order }]`
const calendarRetiredSort: TsObjectCalendarSchema = { ...CALENDAR_NODE, sort: 'start_date asc' };
// @ts-expect-error — `order` is `'asc' | 'desc'`; the member is `SortConfig[]`, not `any[]`
const calendarBadSortOrder: TsObjectCalendarSchema = { ...CALENDAR_NODE, sort: [{ field: 'start_date', order: 'sideways' }] };

/* ── Off-disk derivations ─────────────────────────────────────────────────── */

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** Every `schema.KEY` read in a renderer, off disk. */
function rendererReads(rel: string): Set<string> {
  return new Set([...readRepo(rel).matchAll(/\bschema\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

function shapeKeys(schema: unknown): string[] {
  return Object.keys((schema as { shape: Record<string, unknown> }).shape);
}

function specShapeKeys(type: string): string[] {
  const entry = (ComponentPropsMap as unknown as Record<string, any>)[type];
  const def = entry._def;
  const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
  return Object.keys(shape);
}

interface Issue {
  path?: readonly (string | number)[];
  message?: string;
  /** zod 4 `invalid_union`: the issues of every option that was tried. */
  errors?: readonly (readonly Issue[])[];
}

function issuePaths(issues: readonly Issue[], prefix: readonly (string | number)[] = []): string[] {
  const out: string[] = [];
  for (const issue of issues) {
    const path = [...prefix, ...(issue.path ?? [])];
    out.push(path.join('.'));
    for (const nested of issue.errors ?? []) out.push(...issuePaths(nested, path));
  }
  return out;
}

/* ── The reads: the fact the declarations record ──────────────────────────── */

describe('objectui#8174 — the renderers read these keys, which is what the declarations record', () => {
  it('the kanban renderer reads `filter` and lowers it onto `$filter`', () => {
    const reads = rendererReads(KANBAN_READER);
    expect(reads.has('filter'), `${KANBAN_READER} no longer reads schema.filter`).toBe(true);
    // The positive control: the query that returns a verdict for `sort` below
    // is the same query that returns `objectName`, so that verdict is a reading.
    expect(reads.has(READ_CONTROL_KEY)).toBe(true);
    expect(readRepo(KANBAN_READER)).toContain('$filter: schema.filter');
  });

  it('…and reads NO `sort`: the board groups records into lanes and issues no `$orderby`', () => {
    // The measured premise for leaving `sort` off `ObjectKanbanSchema`. If the
    // board ever starts ordering, this turns red BEFORE the declaration faces
    // fork again.
    expect(rendererReads(KANBAN_READER).has('sort')).toBe(false);
  });

  it('the calendar renderer reads BOTH, and lowers them onto `$filter` / `$orderby`', () => {
    const reads = rendererReads(CALENDAR_READER);
    expect(reads.has('filter'), `${CALENDAR_READER} no longer reads schema.filter`).toBe(true);
    expect(reads.has('sort'), `${CALENDAR_READER} no longer reads schema.sort`).toBe(true);
    expect(reads.has(READ_CONTROL_KEY)).toBe(true);
    const src = readRepo(CALENDAR_READER);
    expect(src).toContain('$filter: schema.filter');
    expect(src).toContain('$orderby: convertSortToQueryParams(schema.sort)');
  });

  it('neither renderer reads the control key, so its undeclared verdict stays non-vacuous', () => {
    expect(rendererReads(KANBAN_READER).has(CONTROL_KEY)).toBe(false);
    expect(rendererReads(CALENDAR_READER).has(CONTROL_KEY)).toBe(false);
  });

  it('the retired string `sort` clause is still retired in core, so the `sort` docblock stays true', () => {
    // objectui#8221. This is what makes an undeclared string `sort` produce an
    // UNSORTED calendar rather than an error — the reason declaring the member
    // is worth more than editor completion.
    const src = readRepo(SORT_QUERY);
    expect(src).toContain('sort: QuerySortEntry[] | undefined | null,');
    expect(src).toContain('reportRetiredSortSpelling(sort as unknown as string);');
  });
});

/* ── The upstream contract: the spec already declares these ───────────────── */

describe('objectui#8174 — the declarations agree with `@objectstack/spec`, which is the producer contract', () => {
  it('the spec declares `filter` on both blocks, and `sort` on the calendar only', () => {
    const kanban = specShapeKeys('object-kanban');
    const calendar = specShapeKeys('object-calendar');
    expect(kanban).toContain('filter');
    // The spec is the reason `sort` is absent from the kanban interface: it is
    // not declared upstream either, so declaring it here would be this repo
    // inventing a key (Commandment #0).
    expect(kanban).not.toContain('sort');
    expect(calendar).toContain('filter');
    expect(calendar).toContain('sort');
    // Non-vacuity: the same extraction that returns those verdicts returns a
    // key both blocks certainly declare.
    expect(kanban).toContain(READ_CONTROL_KEY);
    expect(calendar).toContain(READ_CONTROL_KEY);
  });
});

/* ── The zod mirrors ──────────────────────────────────────────────────────── */

describe('objectui#8174 — the mirrors declare what the interfaces declare', () => {
  it('membership, read off the mirror shapes (acceptance cannot tell declared from admitted under passthrough)', () => {
    expect(shapeKeys(ObjectKanbanSchema)).toContain('filter');
    expect(shapeKeys(ObjectKanbanSchema)).not.toContain('sort');
    expect(shapeKeys(ObjectCalendarSchema)).toContain('filter');
    expect(shapeKeys(ObjectCalendarSchema)).toContain('sort');
    // The control stays out of both, which is what keeps the four assertions
    // above from being satisfied by a shape that simply contains everything.
    expect(shapeKeys(ObjectKanbanSchema)).not.toContain(CONTROL_KEY);
    expect(shapeKeys(ObjectCalendarSchema)).not.toContain(CONTROL_KEY);
  });

  it('accepts the documented shapes, and the values SURVIVE the parse', () => {
    const k = ObjectKanbanSchema.safeParse({ ...KANBAN_NODE, filter: FILTER_VALUE });
    expect(k.success, JSON.stringify(k.error?.issues)).toBe(true);
    if (k.success) expect((k.data as Record<string, unknown>).filter).toEqual(FILTER_VALUE);

    const c = ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, filter: FILTER_VALUE, sort: SORT_VALUE });
    expect(c.success, JSON.stringify(c.error?.issues)).toBe(true);
    if (c.success) {
      expect((c.data as Record<string, unknown>).filter).toEqual(FILTER_VALUE);
      expect((c.data as Record<string, unknown>).sort).toEqual(SORT_VALUE);
    }
  });

  it('…and through the published union entry point, so the right arms are the ones reached', () => {
    expect(safeValidateSchema({ ...KANBAN_NODE, filter: FILTER_VALUE }).success).toBe(true);
    expect(safeValidateSchema({ ...CALENDAR_NODE, filter: FILTER_VALUE, sort: SORT_VALUE }).success).toBe(true);
  });

  it('both members stay OPTIONAL: the nodes without them parse green — this adds no requiredness', () => {
    expect(ObjectKanbanSchema.safeParse(KANBAN_NODE).success).toBe(true);
    expect(ObjectCalendarSchema.safeParse(CALENDAR_NODE).success).toBe(true);
    expect(safeValidateSchema(KANBAN_NODE).success).toBe(true);
    expect(safeValidateSchema(CALENDAR_NODE).success).toBe(true);
  });

  it.each([
    ['object-kanban', 'filter', 'status = open'],
    ['object-kanban', 'filter', 42],
    ['object-calendar', 'filter', 'status = open'],
    // The objectui#8221 string clause. Undeclared, it parsed green here and was
    // then dropped by `convertSortToQueryParams`, drawing an unsorted calendar.
    ['object-calendar', 'sort', 'start_date asc'],
    ['object-calendar', 'sort', [{ field: 'start_date', order: 'sideways' }]],
    ['object-calendar', 'sort', [{ order: 'asc' }]],
  ] as const)('%s refuses a wrong-typed `%s` (%j) AT the key — the verdict declaring MOVES', (type, key, value) => {
    // Before this card every one of these rode `.passthrough()` unexamined.
    const node = type === 'object-kanban' ? KANBAN_NODE : CALENDAR_NODE;
    const arm = type === 'object-kanban' ? ObjectKanbanSchema : ObjectCalendarSchema;
    const r = arm.safeParse({ ...node, [key]: value });
    expect(r.success).toBe(false);
    if (!r.success) {
      // The refusal must land ON the key (or inside it, e.g. `sort.0.field`) —
      // not merely somewhere in the node — which is what distinguishes value
      // validation from an unrelated refusal.
      const paths = issuePaths(r.error.issues as readonly Issue[]);
      expect(paths.some((p) => p.split('.').includes(key)), JSON.stringify(paths)).toBe(true);
    }
    // …and the same refusal through `safeValidateSchema`, which is the path the
    // CLI's `validate` / `check` reach.
    expect(safeValidateSchema({ ...node, [key]: value }).success).toBe(false);
  });

  it('the objectui#7927 ceiling is UNCHANGED: a misspelled key is still admitted on both mirrors', () => {
    // This card buys value validation, not misspelling detection. Pinning the
    // ceiling here is what stops the change being read as more than it is — and
    // turns red if `.passthrough()` is ever tightened, which would be #7927's
    // job and would need this file revisited.
    expect(ObjectKanbanSchema.safeParse({ ...KANBAN_NODE, [MISSPELLING]: FILTER_VALUE }).success).toBe(true);
    expect(ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, [MISSPELLING]: FILTER_VALUE }).success).toBe(true);
    expect(ObjectKanbanSchema.safeParse({ ...KANBAN_NODE, [CONTROL_KEY]: FILTER_VALUE }).success).toBe(true);
  });
});

/* ── Keep the type-level consts referenced (they are the pins) ─────────────── */

describe('objectui#8174 — the TS face accepts the documented nodes', () => {
  it('the accepted literals carry the values they were authored with', () => {
    expect(kanbanLiteral.filter).toEqual(FILTER_VALUE);
    expect(calendarLiteral.filter).toEqual(FILTER_VALUE);
    expect(calendarLiteral.sort).toEqual(SORT_VALUE);
    // The refused literals exist only so their `@ts-expect-error` directives do;
    // referencing them keeps `noUnusedLocals` off this file's back.
    expect([kanbanBadFilter, calendarBadFilter, calendarRetiredSort, calendarBadSortOrder]).toHaveLength(4);
  });
});
