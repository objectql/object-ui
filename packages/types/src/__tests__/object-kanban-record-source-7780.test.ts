/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#7780 — `ObjectKanbanSchema.objectName` becomes a PRESENCE RULE on
 * both faces: at least one of `bind`, `data`, `objectName`.
 *
 * ## The defect
 *
 * `packages/plugin-kanban/src/ObjectKanban.tsx` — the component the
 * `object-kanban` registration renders — resolves its rows in four steps:
 *
 *     const boundData = useDataScope(schema.bind);
 *     if (schema.objectName && !boundData && !schema.data) { …fetch… }
 *     const rawData = (hasExternalData ? externalData : undefined)
 *                     || boundData || schema.data || fetchedData;
 *
 * — the pre-fetched `data` PROP, then `bind`, then the inline ROW ARRAY on
 * `schema.data`, and only then a fetch keyed by `schema.objectName`. Every
 * `objectName` read is guarded. Yet both published faces REQUIRED
 * `objectName`, so a `bind`-only or `data`-only board — which renders today —
 * was refused by `ObjectKanbanSchema.safeParse` and by `safeValidateSchema`,
 * and could not be annotated with its own type. Measured on `origin/main`
 * `fff250ff`, both entry paths, pristine dist:
 *
 *     bind only        -> refused at `objectName` (invalid_type)
 *     data only        -> refused at `objectName` (invalid_type)
 *     objectName only  -> accepted
 *     none of the three-> refused at `objectName` (invalid_type)
 *
 * This file pins the post-fix vector — accepted / accepted / accepted /
 * refused ON THE REFINEMENT — and, more to the point, WHY each verdict is what
 * it is.
 *
 * ## ⚠️ NOT the map / gantt / calendar ladder, and that is a boundary
 *
 * objectui#6939 (map, gantt) and objectui#7313 (calendar) fixed the SAME defect
 * CLASS on a DIFFERENT ladder: `data` as a `ViewData` PROVIDER BLOCK →
 * `staticData` → `objectName`, resolved by the shared
 * `resolveRecordSourceConfig` in `@object-ui/core`, refined by
 * `requireRecordSource`. This board:
 *
 *   - has NO `staticData` rung;
 *   - reads `data` as a RAW ROW ARRAY, directly, not through any resolver;
 *   - HAS a `bind` rung the other three never walk;
 *   - calls `resolveRecordSourceConfig` / `getDataConfig` ZERO times.
 *
 * So the predicate is `requireKanbanRecordSource`, written for this ladder, and
 * the last two `it`s below are the CONTROL that keeps it that way: objectui#7651
 * ("Should `ObjectKanban` get a real record-source ladder?") was ruled B and
 * closed `not_planned` on 2026-09-05, refusing a sixth `getDataConfig` producer,
 * a `ViewData` retype of `data`, and a `staticData` rung. This card moved ONE
 * thing — the requiredness of `objectName` — and this file fails if a later
 * change quietly adds a rung under the same heading.
 *
 * ## ⛔ `groupBy` is untouched, and that is pinned too
 *
 * objectui#7322 / PR #7774 made `groupBy` the REQUIRED lane key. Its
 * requiredness measurement deliberately EXCLUDED two readings from counting as
 * a lane-less mode: the `dataSource` json fragment in
 * `content/docs/utilities/data-objectstack.mdx`, and `ListView.tsx`'s
 * runtime-generated node. A presence rule over `bind` / `data` / `objectName`
 * must not incidentally overturn that, so the `groupBy` half of the vector is
 * asserted here alongside the record-source half.
 */
// objectui#8344: the `./zod` barrel must be the FIRST zod module this graph evaluates.
// `base.zod.ts` reads `AnyComponentSchema` as an import binding, so entering at a
// category module puts `BaseSchema` in its temporal dead zone and throws at load.
import '../zod/index.zod.js';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ObjectKanbanSchema, ObjectCalendarSchema } from '../zod/objectql.zod';
import { safeValidateSchema } from '../zod/index.zod';
import { BaseSchema } from '../zod/base.zod';
import type { ObjectKanbanSchema as TsObjectKanbanSchema } from '../objectql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const RENDERER = 'packages/plugin-kanban/src/ObjectKanban.tsx';
const LADDER_CONTROL = 'packages/plugin-calendar/src/ObjectCalendar.tsx';

/**
 * The four documents the card's verdict table is written over. `groupBy` is on
 * every one of them, so `objectName` is the ONE member under test — otherwise
 * a row could go green or red for the lane key's reasons instead.
 */
const DOCUMENTS = {
  bindOnly: { groupBy: 'status', bind: 'app.settings.users' },
  dataOnly: { groupBy: 'status', data: [{ id: 1, status: 'todo' }] },
  objectOnly: { groupBy: 'status', objectName: 'task' },
  none: { groupBy: 'status' },
} as const;
type DocumentName = keyof typeof DOCUMENTS;
const DOCUMENT_NAMES = Object.keys(DOCUMENTS) as DocumentName[];

/** The refinement's message, spelled exactly as the member emits it. */
const REFUSAL_MESSAGE = '`object-kanban` has no record source: declare one of `bind`, `data` or `objectName`';

function doc(name: DocumentName): Record<string, unknown> {
  return { type: 'object-kanban', ...DOCUMENTS[name] };
}

/** Report the issues rather than `false`, so a red run says what broke. */
function reasons(schema: unknown): string[] {
  const r = safeValidateSchema(schema);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

/* ── Type-level: the declaration half ───────────────────────────────────────── */

/**
 * A `bind`-only board annotates. Before this card `TS2741: Property
 * 'objectName' is missing` — which is why the two static fixtures under
 * `packages/plugin-kanban/` still carry an `as never` escape naming this issue.
 */
export const BIND_ONLY_BOARD: TsObjectKanbanSchema = {
  type: 'object-kanban',
  groupBy: 'status',
  bind: 'app.settings.users',
};

/** A `data`-only board annotates — the inline ROW ARRAY, read ahead of the fetch. */
export const DATA_ONLY_BOARD: TsObjectKanbanSchema = {
  type: 'object-kanban',
  groupBy: 'status',
  data: [{ id: 1, status: 'todo' }],
};

/** The object-driven board the plugin page documents keeps annotating. */
export const OBJECT_BOARD: TsObjectKanbanSchema = {
  type: 'object-kanban',
  objectName: 'opportunity',
  groupBy: 'stage',
  limit: 250,
};

/**
 * `groupBy` stayed REQUIRED (objectui#7322). This is the ONE deliberate error
 * in this file, and it is the control that keeps the widening from having
 * reached the lane key: delete `groupBy`'s requiredness and `TS2578` (unused
 * `@ts-expect-error`) reddens `tsconfig.test.json`.
 */
// @ts-expect-error — groupBy is still required on ObjectKanbanSchema (the one deliberate error here)
export const LANELESS_BOARD_STILL_REFUSED: TsObjectKanbanSchema = {
  type: 'object-kanban',
  objectName: 'task',
};

/* ── Runtime pins ───────────────────────────────────────────────────────────── */

describe('objectui#7780 — the four documents, through the member and the published entry point', () => {
  it('`bind` alone validates — the rung `useDataScope(schema.bind)` reads', () => {
    const d = doc('bindOnly');
    expect('objectName' in d).toBe(false);
    expect(ObjectKanbanSchema.safeParse(d).success).toBe(true);
    expect(reasons(d)).toEqual([]);
  });

  it('`data` alone validates — the inline ROW ARRAY, not a provider block', () => {
    const d = doc('dataOnly');
    expect('objectName' in d).toBe(false);
    expect(ObjectKanbanSchema.safeParse(d).success).toBe(true);
    expect(reasons(d)).toEqual([]);
  });

  it('`objectName` alone still validates — the accept set only WIDENED, an empty name included', () => {
    expect(ObjectKanbanSchema.safeParse(doc('objectOnly')).success).toBe(true);
    expect(reasons(doc('objectOnly'))).toEqual([]);
    // Presence is `!== undefined`, not the renderer's truthiness: `objectName:
    // ''` validated before this card (a required `z.string()` accepts '') and
    // must still validate, or the change would narrow something.
    expect(ObjectKanbanSchema.safeParse({ type: 'object-kanban', groupBy: 'status', objectName: '' }).success).toBe(true);
  });

  it('NONE of the three is refused ON THE REFINEMENT — by name, not at `objectName`', () => {
    const result = ObjectKanbanSchema.safeParse(doc('none'));
    expect(result.success).toBe(false);
    if (result.success) return;
    // Exactly one issue, and it is the refinement's — not the `objectName`
    // key-level failure this document used to get, which would make this case
    // green for the wrong reason.
    expect(result.error.issues).toHaveLength(1);
    const issue = result.error.issues[0];
    expect(issue.code).toBe('custom');
    expect(issue.path).toEqual([]);
    expect((issue as { params?: { code?: string } }).params?.code).toBe('RECORD_SOURCE_REQUIRED');
    expect(issue.message).toBe(REFUSAL_MESSAGE);
  });

  it('…and the published entry point agrees on all four, with the same message on the refusal', () => {
    const vector = DOCUMENT_NAMES.map((n) => safeValidateSchema(doc(n)).success);
    expect(vector).toEqual([true, true, true, false]);
    // Non-vacuity: a member that accepted everything would "agree" too.
    expect(new Set(vector).size).toBe(2);
    expect(reasons(doc('none'))).toContain(`: ${REFUSAL_MESSAGE}`);
  });

  it('control: `BaseSchema` accepts all four — the refusal above is the refinement\'s, not the base\'s', () => {
    for (const name of DOCUMENT_NAMES) {
      expect(BaseSchema.safeParse(doc(name)).success).toBe(true);
    }
  });
});

describe('objectui#7780 — `groupBy` requiredness is NOT overturned (objectui#7322 / PR #7774)', () => {
  it.each(DOCUMENT_NAMES)('%s without `groupBy` is still refused AT `groupBy`', (name) => {
    const { groupBy: _dropped, ...rest } = DOCUMENTS[name];
    void _dropped;
    const laneless = { type: 'object-kanban', ...rest };
    const r = ObjectKanbanSchema.safeParse(laneless);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.map((i) => i.path[0])).toContain('groupBy');
    expect(safeValidateSchema(laneless).success).toBe(false);
  });

  it("PR #7774's two EXCLUDED readings stay refused — a record source is not a lane key", () => {
    // The `dataSource` json fragment taught in
    // `content/docs/utilities/data-objectstack.mdx`. `dataSource` is not a rung
    // of this ladder (`ElementDataSourceGate` maps its `object` ONTO
    // `objectName` upstream of the node), so this document has no record source
    // AND no lane key, and is refused for both.
    const fragment = { type: 'object-kanban', dataSource: { object: 'task', filter: { project: 'acme' } } };
    const f = ObjectKanbanSchema.safeParse(fragment);
    expect(f.success).toBe(false);
    if (!f.success) {
      expect(f.error.issues.map((i) => i.path[0])).toContain('groupBy');
    }
    // `ListView.tsx`'s runtime-generated node, in the shape it emits when the
    // view declared no lane field: `groupBy: laneField` with `laneField`
    // undefined. Still refused, at `groupBy`.
    const generated = { type: 'object-kanban', objectName: 'task', groupBy: undefined, cardFields: [] };
    const g = ObjectKanbanSchema.safeParse(generated);
    expect(g.success).toBe(false);
    if (!g.success) expect(g.error.issues.map((i) => i.path[0])).toContain('groupBy');
  });

  it('the retired `groupField` is still refused BY NAME — the tombstone is untouched', () => {
    const r = ObjectKanbanSchema.safeParse({ type: 'object-kanban', objectName: 'task', groupBy: 'status', groupField: 'status' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain('groupField');
  });
});

describe('objectui#7780 — the member is still an object, and NO rung was added (objectui#7651)', () => {
  const shape = () =>
    (ObjectKanbanSchema as unknown as { shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }).shape;

  it('`.shape` is exposed, with `objectName` optional and `groupBy` not', () => {
    // zod 4 attaches a refinement in place; had it wrapped the object, `.shape`
    // would be gone — `object-kanban-group-by-limit-7322.test.ts` reads it, and
    // the parity census in `zod-mirror-parity.test.ts` would read the pair as
    // vacuous.
    expect(Object.keys(shape())).toEqual(expect.arrayContaining(['objectName', 'groupBy', 'groupField', 'limit']));
    expect(shape().objectName.safeParse(undefined).success).toBe(true);
    expect(shape().objectName.safeParse(5).success).toBe(false);
    expect(shape().groupBy.safeParse(undefined).success).toBe(false);
  });

  it('⛔ NO `staticData` rung, and `data` / `bind` are INHERITED, not re-declared — objectui#7651 refused both', () => {
    // `data` and `bind` reach this member through `BaseSchema.extend`, so they
    // appear in `.shape` by inheritance. Membership alone therefore cannot tell
    // "inherited" from "re-declared here"; IDENTITY can. Re-typing `data` to a
    // `ViewData` provider block — or adding a `staticData` rung — is exactly
    // what objectui#7651 ruled out, and either one replaces the entry.
    const base = (BaseSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(shape().data).toBe(base.data);
    expect(shape().bind).toBe(base.bind);
    expect(Object.keys(shape())).not.toContain('staticData');
    // …so the member still admits a RAW ROW ARRAY on `data`, and anything else
    // the base admits — a `ViewData` retype would refuse the string below.
    expect(ObjectKanbanSchema.safeParse({ type: 'object-kanban', groupBy: 'status', data: [{ id: 1 }] }).success).toBe(true);
    expect(shape().data.safeParse('raw').success).toBe(true);
  });

  it('the sibling ladder is NOT this one: `object-calendar` still requires its own three, and refuses a bind-only board', () => {
    // Same document shape, opposite verdict — the two predicates are distinct.
    // A `bind`-only calendar has none of `data` / `staticData` / `objectName`,
    // so `requireRecordSource` refuses it while `requireKanbanRecordSource`
    // accepts the kanban twin.
    const bindOnlyCalendar = { type: 'object-calendar', bind: 'app.settings.users' };
    expect(ObjectCalendarSchema.safeParse(bindOnlyCalendar).success).toBe(false);
    expect(ObjectKanbanSchema.safeParse(doc('bindOnly')).success).toBe(true);
  });
});

describe('objectui#7780 — the declaration names a live read, in the declared order', () => {
  it('the renderer reads bind → inline data → objectName, in that order, on disk', () => {
    const src = readFileSync(join(REPO_ROOT, RENDERER), 'utf8');
    expect(src, `${RENDERER} no longer binds through useDataScope(schema.bind)`)
      .toContain('const boundData = useDataScope(schema.bind);');
    expect(src, `${RENDERER} no longer gates the fetch behind bind and inline data`)
      .toContain('if (schema.objectName && !boundData && !schema.data) {');
    expect(src, `${RENDERER} no longer resolves rawData through the declared ladder`)
      .toContain('const rawData = (hasExternalData ? externalData : undefined) || boundData || schema.data || fetchedData;');
    // Order, not just presence: the gate must precede the resolution it guards.
    expect(src.indexOf('const boundData = useDataScope(schema.bind);'))
      .toBeLessThan(src.indexOf('const rawData = (hasExternalData ? externalData : undefined)'));
  });

  it('⛔ CONTROL: the board still walks NO shared ladder — zero `getDataConfig` / `resolveRecordSourceConfig`', () => {
    const src = readFileSync(join(REPO_ROOT, RENDERER), 'utf8');
    expect(src).not.toContain('getDataConfig');
    expect(src).not.toContain('resolveRecordSourceConfig');
    // The instrument fires: the sibling that DOES walk the shared ladder.
    const control = readFileSync(join(REPO_ROOT, LADDER_CONTROL), 'utf8');
    expect(control).toContain('resolveRecordSourceConfig');
  });
});
