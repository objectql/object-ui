/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#7313 — `ObjectCalendarSchema` declares the record-source ladder its
 * renderer already reads, on both faces, in the shape objectui#6939 landed on
 * `object-map` / `object-gantt` (PR #7471).
 *
 * ## The defect
 *
 * `ObjectCalendar` resolves its records through the shared ladder —
 * `resolveRecordSourceConfig(schema)` in `@object-ui/core`
 * (`packages/core/src/utils/record-source.ts`): `data`, then `staticData`, then
 * `objectName`, `null` when none is present. The published interface REQUIRED
 * `objectName` and declared neither `data` nor `staticData`; the mirror did the
 * same (no `requireRecordSource`). So the two static-data examples
 * `content/docs/plugins/plugin-calendar.mdx` teaches rendered correctly, were
 * refused by `safeValidateSchema`, and could not be annotated with their own
 * type (`TS2741: Property 'objectName' is missing`).
 *
 * Measured on `origin/main` at `91f92768` (identical to the dispatch base
 * `4dfdcc3c` on both faces), pristine dist, four documents through
 * `ObjectCalendarSchema.safeParse`:
 *
 *     staticData only  -> refused at `objectName` (invalid_type)
 *     data only        -> refused at `objectName` (invalid_type)
 *     none of the three-> refused at `objectName` (invalid_type)
 *     objectName only  -> accepted
 *
 * `ObjectGanttSchema` on the same four: accepted / accepted / refused ON THE
 * REFINEMENT / accepted. This file pins that the calendar now agrees with the
 * gantt verdict-for-verdict, and WHY each verdict is what it is.
 *
 * ## What this file pins — the VALIDATOR and DECLARATION halves
 *
 * The render half needs no new pin: the renderer never changed. The read it
 * performs is pinned off disk below, so a later rewrite of the ladder cannot
 * leave this declaration describing a read that no longer exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ObjectCalendarSchema, ObjectGanttSchema, safeValidateSchema } from '../zod/index.zod';
import { BaseSchema } from '../zod/base.zod';
import type {
  ObjectCalendarSchema as TsObjectCalendarSchema,
  ObjectGanttSchema as TsObjectGanttSchema,
  ObjectKanbanSchema as TsObjectKanbanSchema,
  ViewData,
} from '../objectql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const RENDERER = 'packages/plugin-calendar/src/ObjectCalendar.tsx';
const LADDER = 'packages/core/src/utils/record-source.ts';
const DOC_PAGE = 'content/docs/plugins/plugin-calendar.mdx';

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;
/** `Partial< Pick< T, K > >` is assignable to `Pick< T, K >` exactly when `K` is optional on `T`. */
type IsOptionalKey< T, K extends keyof T > = Partial< Pick< T, K > > extends Pick< T, K > ? true : false;

/**
 * `objectName` is OPTIONAL and still `string`. Both directions bite: required
 * again -> `string` is not `string | undefined` -> red; member DELETED -> the
 * key resolves through `BaseSchema`'s index signature to `any`, and
 * `Equal< any, … >` is false -> red.
 */
export type _CalendarObjectNameIsOptionalString =
  Expect< Equal< TsObjectCalendarSchema['objectName'], string | undefined > >;
export type _CalendarObjectNameIsOptionalKey =
  Expect< IsOptionalKey< TsObjectCalendarSchema, 'objectName' > >;

/**
 * `data` is DECLARED, optional, and `ViewData` — not `any`. Deleting the member
 * does NOT fall through to the index signature: it lands on the INHERITED
 * `BaseSchema.data?: any` (a declared member wins over an index signature), and
 * `Equal< any, ViewData | undefined >` is false -> red. That is the whole
 * reason the member is declared here rather than left to the base.
 */
export type _CalendarDataIsOptionalViewData =
  Expect< Equal< TsObjectCalendarSchema['data'], ViewData | undefined > >;
export type _CalendarDataIsOptionalKey =
  Expect< IsOptionalKey< TsObjectCalendarSchema, 'data' > >;

/** `staticData` is DECLARED and optional; deleted, it would resolve to `any`. */
export type _CalendarStaticDataIsOptionalAnyArray =
  Expect< Equal< TsObjectCalendarSchema['staticData'], any[] | undefined > >;
export type _CalendarStaticDataIsOptionalKey =
  Expect< IsOptionalKey< TsObjectCalendarSchema, 'staticData' > >;

/** One concept, one type: the calendar's three keys are the gantt's three keys. */
export type _CalendarDataMatchesGantt =
  Expect< Equal< TsObjectCalendarSchema['data'], TsObjectGanttSchema['data'] > >;
export type _CalendarStaticDataMatchesGantt =
  Expect< Equal< TsObjectCalendarSchema['staticData'], TsObjectGanttSchema['staticData'] > >;
export type _CalendarObjectNameMatchesGantt =
  Expect< Equal< TsObjectCalendarSchema['objectName'], TsObjectGanttSchema['objectName'] > >;

/**
 * The document the plugin page teaches under "With Static Data". It did not
 * compile before this card — `objectName` was a required member, and an index
 * signature cannot rescue a MISSING required key — so this annotation is a real
 * compile-time pin.
 */
export const STATIC_DATA_DOCUMENT: TsObjectCalendarSchema = {
  type: 'object-calendar',
  staticData: [{ id: 1, title: 'Team Meeting', startDate: '2024-01-15T10:00:00' }],
};

/** …and the `data`-authored one, typed against the declared `ViewData`. */
export const DATA_DOCUMENT: TsObjectCalendarSchema = {
  type: 'object-calendar',
  data: { provider: 'value', items: [{ id: 1, title: 'Team Meeting' }] },
};

/**
 * CLASS BOUNDARY, recorded without touching it (triage boundary 3 on
 * objectui#7313): `ObjectKanbanSchema` still REQUIRES `objectName`. Its
 * renderer reads `schema.data` ahead of the fetch and guards every
 * `objectName` read, so it carries the same defect class — but that block is
 * objectui#7322's, and this control only says where the class currently ends.
 * When a card moves the kanban's `objectName` to optional, this directive is
 * the line that card deletes.
 */
// @ts-expect-error — objectName is still required on ObjectKanbanSchema (the one deliberate error here)
export const KANBAN_STILL_REQUIRES_OBJECT_NAME: TsObjectKanbanSchema = {
  type: 'object-kanban',
  groupField: 'status',
};

/* ── Runtime pins ─────────────────────────────────────────────────────────── */

/**
 * The four documents the card's verdict table is written over. `data` uses
 * the value provider — the config `staticData` is folded into, so the two
 * accepted-without-`objectName` rows exercise different keys but one route.
 */
const DOCUMENTS = {
  staticOnly: { staticData: [{ id: 1, title: 'Team Meeting', startDate: '2024-01-15T10:00:00' }] },
  dataOnly: { data: { provider: 'value', items: [{ id: 1, title: 'Team Meeting' }] } },
  none: {},
  objectOnly: { objectName: 'events' },
} as const;
type DocumentName = keyof typeof DOCUMENTS;
const DOCUMENT_NAMES = Object.keys(DOCUMENTS) as DocumentName[];

/** The refinement's message, spelled exactly as the map/gantt members emit it. */
const REFUSAL_MESSAGE = '`object-calendar` has no record source: declare one of `data`, `staticData` or `objectName`';

function withType(type: string, name: DocumentName): Record<string, unknown> {
  return { type, ...DOCUMENTS[name] };
}

/** Report the issues rather than `false`, so a red run says what broke. */
function reasons(schema: unknown): string[] {
  const r = safeValidateSchema(schema);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('objectui#7313 — the four documents, through the member and the published entry point', () => {
  it('`staticData` alone validates — the route the plugin page documents twice', () => {
    const doc = withType('object-calendar', 'staticOnly');
    expect('objectName' in doc).toBe(false);
    expect(ObjectCalendarSchema.safeParse(doc).success).toBe(true);
    expect(reasons(doc)).toEqual([]);
  });

  it('`data` alone validates', () => {
    const doc = withType('object-calendar', 'dataOnly');
    expect(ObjectCalendarSchema.safeParse(doc).success).toBe(true);
    expect(reasons(doc)).toEqual([]);
  });

  it('`objectName` alone still validates — the accept set only WIDENED, an empty name included', () => {
    expect(ObjectCalendarSchema.safeParse(withType('object-calendar', 'objectOnly')).success).toBe(true);
    expect(reasons(withType('object-calendar', 'objectOnly'))).toEqual([]);
    // Presence is `!== undefined`, not the renderer's truthiness: `objectName:
    // ''` validated before this card (a required `z.string()` accepts '') and
    // must still validate, or the change would narrow something.
    expect(ObjectCalendarSchema.safeParse({ type: 'object-calendar', objectName: '' }).success).toBe(true);
  });

  it('NONE of the three is refused ON THE REFINEMENT — by name, not at `objectName`', () => {
    const result = ObjectCalendarSchema.safeParse(withType('object-calendar', 'none'));
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

  it('…and the published entry point refuses it too, with the same message', () => {
    const r = safeValidateSchema({ type: 'object-calendar' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.map((i) => i.message)).toContain(REFUSAL_MESSAGE);
  });
});

describe('objectui#7313 — parity with `ObjectGanttSchema`, verdict for verdict', () => {
  const verdicts = (member: { safeParse: (v: unknown) => { success: boolean } }, type: string) =>
    DOCUMENT_NAMES.map((name) => member.safeParse(withType(type, name)).success);

  it('the two members agree on all four documents, and the vector is not vacuous', () => {
    const calendar = verdicts(ObjectCalendarSchema, 'object-calendar');
    const gantt = verdicts(ObjectGanttSchema, 'object-gantt');
    expect(calendar).toEqual(gantt);
    // Non-vacuity: a pair that accepted everything, or refused everything,
    // would "agree" too. The vector must carry BOTH verdicts, and in the
    // positions the card's table names.
    expect(new Set(calendar).size).toBe(2);
    expect(calendar).toEqual([true, true, false, true]);
  });

  it('the refusal is the same issue on both members, differing only in the member name', () => {
    const c = ObjectCalendarSchema.safeParse({ type: 'object-calendar' });
    const g = ObjectGanttSchema.safeParse({ type: 'object-gantt' });
    expect(c.success).toBe(false);
    expect(g.success).toBe(false);
    if (c.success || g.success) return;
    const strip = (m: string) => m.replace(/`object-(calendar|gantt)`/, '`object-MEMBER`');
    expect(strip(c.error.issues[0].message)).toBe(strip(g.error.issues[0].message));
    expect((c.error.issues[0] as { params?: { code?: string } }).params?.code)
      .toBe((g.error.issues[0] as { params?: { code?: string } }).params?.code);
  });

  it('control: `BaseSchema` accepts all four — the refusal above is the refinement\'s, not the base\'s', () => {
    // `BaseSchema` is `.passthrough()` with no record-source refinement, so it
    // takes every one of these documents. Only the member refuses `none`.
    for (const name of DOCUMENT_NAMES) {
      expect(BaseSchema.safeParse(withType('object-calendar', name)).success).toBe(true);
    }
  });
});

describe('objectui#7313 — `data` and `staticData` are DECLARED, not passthrough holes', () => {
  it('a wrong-typed `data` is refused AT the key; `objectName` is supplied so only `data` is under test', () => {
    const r = ObjectCalendarSchema.safeParse({ type: 'object-calendar', objectName: 'events', data: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain('data');
    expect(ObjectCalendarSchema.safeParse({ type: 'object-calendar', objectName: 'events', data: { provider: 'object', object: 'events' } }).success).toBe(true);
  });

  it('a wrong-typed `staticData` is refused AT the key', () => {
    const r = ObjectCalendarSchema.safeParse({ type: 'object-calendar', objectName: 'events', staticData: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain('staticData');
  });

  it('control: `BaseSchema` alone would have admitted both — delete either member and its refusal becomes this', () => {
    expect(BaseSchema.safeParse({ type: 'object-calendar', objectName: 'events', data: 'nope' }).success).toBe(true);
    expect(BaseSchema.safeParse({ type: 'object-calendar', objectName: 'events', staticData: 'nope' }).success).toBe(true);
  });

  it('the object stayed an object: `.shape` is exposed, with the three keys in it and `objectName` optional', () => {
    // zod 4 attaches a refinement in place; had it wrapped the object, `.shape`
    // would be gone and the parity census in `zod-mirror-parity.test.ts` would
    // read the pair as vacuous.
    const shape = (ObjectCalendarSchema as unknown as { shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }).shape;
    expect(Object.keys(shape)).toEqual(expect.arrayContaining(['objectName', 'data', 'staticData']));
    expect(shape.objectName.safeParse(undefined).success).toBe(true);
    expect(shape.objectName.safeParse(5).success).toBe(false);
  });
});

describe('objectui#7313 — the declaration names a live read, in the declared order', () => {
  it('the renderer resolves its records through the shared ladder', () => {
    const src = readFileSync(join(REPO_ROOT, RENDERER), 'utf8');
    expect(src, `${RENDERER} no longer calls resolveRecordSourceConfig(schema)`).toContain('resolveRecordSourceConfig(schema)');
  });

  it('the ladder reads `data`, then `staticData`, then `objectName` — the order the refinement rests on', () => {
    const src = readFileSync(join(REPO_ROOT, LADDER), 'utf8');
    const body = src.slice(src.indexOf('export function resolveRecordSourceConfig'));
    const data = body.indexOf('if (schema.data)');
    const staticData = body.indexOf('if (schema.staticData)');
    const objectName = body.indexOf('if (schema.objectName)');
    expect(data).toBeGreaterThan(-1);
    expect(staticData).toBeGreaterThan(data);
    expect(objectName).toBeGreaterThan(staticData);
  });

  it('the two static-data examples on the plugin page carry the annotation (the card\'s completion signal)', () => {
    const page = readFileSync(join(REPO_ROOT, DOC_PAGE), 'utf8');
    expect(page).toContain("const schema: ObjectCalendarSchema = {\n  type: 'object-calendar',\n  staticData: [");
    expect(page).toContain("const valueProviderCalendar: ObjectCalendarSchema = {\n  type: 'object-calendar',\n  staticData: [");
    // No bare `object-calendar` literal is left unannotated on the page.
    expect(page.match(/^const \w+ = \{\n\s+type: 'object-calendar'/gm)).toBeNull();
  });
});
