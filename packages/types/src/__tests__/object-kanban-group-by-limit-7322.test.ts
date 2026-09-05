/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#7322 — `ObjectKanbanSchema.groupBy` / `.limit` declared and
 * `.groupField` RETIRED, on both faces.
 *
 * ## The defect
 *
 * `packages/plugin-kanban/src/ObjectKanban.tsx` — the component the
 * `object-kanban` registration renders — reads `schema.groupBy` at thirteen
 * sites (lane materialisation, card moves, their effect deps) and
 * `schema.limit` at two (`$top: schema.limit ?? DEFAULT_KANBAN_LIMIT` and the
 * effect deps). `groupField` has ZERO read sites anywhere under
 * `packages/plugin-kanban/`. Yet the declaration in `../objectql.ts` REQUIRED
 * `groupField` and declared neither `groupBy` nor `limit`, and the zod mirror in
 * `../zod/objectql.zod.ts` restated it. Measured on `53ded82b` from source:
 * the documented, tested, working shape — `{ type: 'object-kanban',
 * objectName, groupBy, limit }` — FAILED `ObjectKanbanSchema.safeParse` and
 * `safeValidateSchema` on the missing `groupField`, while a `groupField`-only
 * node parsed green and rendered a board that grouped nothing. `groupBy` and
 * `limit` only ever reached the renderer through `BaseSchema`'s
 * `[key: string]: any` and `.passthrough()` — admitted, never examined.
 *
 * ## What this file pins, and the shapes it borrows
 *
 * The declare half is `chat-message-avatar-keys-7295.test.ts` /
 * `checkbox-wrapper-class-6938.test.ts`: membership is asserted on the mirror's
 * OWN `.shape`, never on parse acceptance (under `.passthrough()` acceptance
 * cannot tell "declared" from "admitted unexamined"); the type-level pins use
 * invariant equality so an undeclared key — which resolves to `any` through
 * the index signature — reads as a failure rather than a match; and the CONTROL
 * is a key the renderer does NOT read, derived from its source, which stays
 * undeclared on both faces and is still admitted unexamined. That is the half
 * that keeps this from being a widening.
 *
 * The retire half is `TimelineSchema.timeScale` (objectui#6355): `?: never` on
 * the TS face and `retirementTombstone()` on the mirror, BOTH halves, so the
 * retired spelling is refused BY NAME on each face rather than deleted into the
 * index signature where it would type-check green and go on doing nothing.
 *
 * ## Node-local, and the second control that proves it
 *
 * `groupField` is NOT a dead key in general. The VIEW-LEVEL kanban config's
 * `groupField` is a live legacy alias of the spec's `groupByField`:
 * `normalize-list-view.ts` maps it and `ListView` / `ObjectView` read it. Those
 * sites are pinned OFF DISK below as a control — if one stops reading the alias
 * this file turns red, because the retirement's stated boundary moved.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ObjectKanbanSchema } from '../zod/objectql.zod';
import { safeValidateSchema } from '../zod/index.zod';
import type { ObjectKanbanSchema as TsObjectKanbanSchema } from '../objectql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const READER = 'packages/plugin-kanban/src/ObjectKanban.tsx';
const MIRROR = 'packages/types/src/zod/objectql.zod.ts';
const DOC = 'content/docs/plugins/plugin-kanban.mdx';

const DECLARED = ['groupBy', 'limit'] as const;
type Declared = (typeof DECLARED)[number];
const RETIRED = 'groupField';

/**
 * Exact source text of the reads, as they stand today. Line numbers drift and
 * live in the docblocks' prose only; the READ is the fact.
 */
const READ_TEXT: Record<Declared, readonly string[]> = {
  groupBy: [
    'if (!schema.objectName || !schema.groupBy) return col;',
    'if (schema.groupBy && objectDef?.fields?.[schema.groupBy]?.options) {',
    'const groupBy = schema.groupBy;',
  ],
  limit: ['$top: schema.limit ?? DEFAULT_KANBAN_LIMIT'],
};
/** The default the `limit` docblock names. */
const DEFAULT_LIMIT_TEXT = 'export const DEFAULT_KANBAN_LIMIT = 100;';

/**
 * A plausible lane-key spelling the renderer never reads (the read set below
 * is derived, not asserted). It stays undeclared on both faces — the proof that
 * the change declares the keys the renderer honours and nothing else.
 */
const CONTROL_KEY = 'laneField';
/** A declared-keys-only control of the read set: read, declared, untouched. */
const READ_CONTROL_KEY = 'objectName';

/**
 * The VIEW-LEVEL `groupField` alias sites, off disk. `groupField` is LIVE at
 * every one of them; the tombstone is on the `object-kanban` NODE only.
 */
const VIEW_LEVEL_ALIAS_SITES: ReadonlyArray<readonly [file: string, text: string]> = [
  ['packages/core/src/utils/normalize-list-view.ts', "kanban: { groupField: 'groupByField', cardFields: 'columns' }"],
  ['packages/plugin-list/src/ListView.tsx', 'schema.kanban?.groupByField || schema.kanban?.groupField || schema.options?.kanban?.groupField'],
  ['packages/plugin-view/src/ObjectView.tsx', 'kanbanCfg.groupField ||'],
];
/** …and the same alias, still DECLARED on the view-level config in this very mirror file. */
const VIEW_LEVEL_ALIAS_MIRROR_TEXT = "groupField: z.string().optional().describe('Deprecated alias for groupByField')";

/** The documented row-cap node; every assertion below is a delta on it. */
const NODE = { type: 'object-kanban', objectName: 'opportunity', groupBy: 'stage' } as const;

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** The canonical `any` detector: only `any` absorbs `1 &` down to something `0` extends. */
type IsAny<T> = 0 extends (1 & T) ? true : false;
/** An object with no keys is assignable to `Pick<T, K>` only when `K` is optional on `T`. */
type IsOptional<T, K extends keyof T> = Record<string, never> extends Pick<T, K> ? true : false;

// `groupBy`: declared `string`, REQUIRED, not `any`. Were the member removed
// the indexed access would fall back to the index signature and resolve to
// `any`, and `Equal<any, string>` is false.
export type _GroupByIsString = Expect<Equal<TsObjectKanbanSchema['groupBy'], string>>;
export type _GroupByIsNotAny = Expect<Equal<IsAny<TsObjectKanbanSchema['groupBy']>, false>>;
export type _GroupByIsRequired = Expect<Equal<IsOptional<TsObjectKanbanSchema, 'groupBy'>, false>>;
// `limit`: declared `number`, optional, not `any`.
export type _LimitIsNumberOrUndefined = Expect<Equal<TsObjectKanbanSchema['limit'], number | undefined>>;
export type _LimitIsNotAny = Expect<Equal<IsAny<TsObjectKanbanSchema['limit']>, false>>;
export type _LimitIsOptional = Expect<IsOptional<TsObjectKanbanSchema, 'limit'>>;
// `groupField`: a `?: never` tombstone — the only value it admits is absence.
// Deleting the member instead would make this `any` (index signature) and the
// pin red, which is the point: the tombstone is load-bearing.
export type _GroupFieldIsTombstone = Expect<Equal<TsObjectKanbanSchema['groupField'], undefined>>;
export type _GroupFieldIsNotAny = Expect<Equal<IsAny<TsObjectKanbanSchema['groupField']>, false>>;
// The control key is NOT declared: it resolves to `any` through the index
// signature, exactly as `groupBy` and `limit` did before this card. Declaring
// it turns this red — which is the point.
export type _ControlKeyFallsThroughToIndexSignature = Expect<IsAny<TsObjectKanbanSchema['laneField']>>;

// The TS face accepts the documented shape on a literal — the exact node the
// doc page's row-cap block now annotates.
const literal: TsObjectKanbanSchema = { ...NODE, limit: 250 };
// …REFUSES the retired spelling on a literal (a string is not `never`). This
// directive goes unused — and the type-check goes red with TS2578 — the moment
// the tombstone is deleted or widened back to `string`.
// @ts-expect-error — `groupField` is RETIRED on this node (objectui#7322); author `groupBy`
const retiredLiteral: TsObjectKanbanSchema = { ...NODE, groupField: 'stage' };
// …and REFUSES a lane-less node (TS2741): `groupBy` is required, as the retired
// `groupField` was. Making it optional turns this directive unused.
// @ts-expect-error — `groupBy` is required: a board is a grouping of records by one field
const lanelessLiteral: TsObjectKanbanSchema = { type: 'object-kanban', objectName: 'opportunity' };

/* ── Off-disk derivations ─────────────────────────────────────────────────── */

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** Every `schema.KEY` read in the renderer, off disk. */
function rendererReads(): Set<string> {
  const src = readRepo(READER);
  return new Set([...src.matchAll(/\bschema\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

function shapeKeys(): string[] {
  return Object.keys((ObjectKanbanSchema as unknown as { shape: Record<string, unknown> }).shape);
}

interface Issue {
  path?: readonly (string | number)[];
  message?: string;
  /** zod 4 `invalid_union`: the issues of every option that was tried. */
  errors?: readonly (readonly Issue[])[];
}

/**
 * Every issue as `path` + `message`, with the nested option errors of an
 * `invalid_union` flattened in: `AnyComponentSchema` is a plain `z.union`, so
 * a refusal inside the `object-kanban` arm surfaces as one root
 * `invalid_union` issue whose `errors` carry the per-arm paths.
 */
function issueEntries(issues: readonly Issue[], prefix: readonly (string | number)[] = []): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  for (const issue of issues) {
    const path = [...prefix, ...(issue.path ?? [])];
    out.push({ path: path.join('.'), message: issue.message ?? '' });
    for (const nested of issue.errors ?? []) out.push(...issueEntries(nested, path));
  }
  return out;
}

function issuePaths(issues: readonly Issue[]): string[] {
  return issueEntries(issues).map((e) => e.path);
}

/* ── The reads ────────────────────────────────────────────────────────────── */

describe('objectui#7322 — the renderer reads `groupBy` and `limit`, which is the fact the declarations record', () => {
  it('the batch is exactly the two keys the card measured as read-but-undeclared', () => {
    // Non-vacuity for every per-key assertion below, and the card's own
    // bound: the other undeclared reads on this renderer are not this card.
    expect(DECLARED).toHaveLength(2);
  });

  it.each(DECLARED)('`%s` is still read, as the exact text the docblocks cite', (key) => {
    const src = readRepo(READER);
    for (const text of READ_TEXT[key]) {
      expect(src, `${READER} no longer reads \`schema.${key}\` as \`${text}\``).toContain(text);
    }
  });

  it('the default the `limit` docblock names is still the renderer\'s', () => {
    expect(readRepo(READER)).toContain(DEFAULT_LIMIT_TEXT);
  });

  it('the read set, derived from the renderer, contains both keys and the read control — and NOT the retired key or the control key', () => {
    const reads = rendererReads();
    for (const key of DECLARED) expect(reads.has(key), `renderer no longer reads schema.${key}`).toBe(true);
    // The positive control: the query that returns zero for `groupField` is
    // the same query that returns `objectName`, so the zero is a reading.
    expect(reads.has(READ_CONTROL_KEY)).toBe(true);
    // The retirement's premise: nothing on this node ever read `groupField`.
    // If the renderer starts reading it, the tombstone is wrong and this turns
    // red BEFORE anyone re-authors the key.
    expect(reads.has(RETIRED)).toBe(false);
    // Non-vacuity for the control key: if the renderer ever starts reading
    // `laneField`, this turns red and the control must be re-chosen, not
    // declared on the way past.
    expect(reads.has(CONTROL_KEY)).toBe(false);
  });
});

/* ── The zod mirror: declared keys ────────────────────────────────────────── */

describe('objectui#7322 — the zod mirror declares `groupBy` and `limit`', () => {
  it.each(DECLARED)('`%s` is a member of the mirror shape (membership cannot be read off acceptance under passthrough)', (key) => {
    expect(shapeKeys()).toContain(key);
  });

  it('accepts the documented shape and `limit` SURVIVES the parse', () => {
    const r = ObjectKanbanSchema.safeParse({ ...NODE, limit: 250 });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).groupBy).toBe('stage');
      expect((r.data as Record<string, unknown>).limit).toBe(250);
    }
  });

  it('…and through the published union entry point, so the `object-kanban` arm is the one reached', () => {
    const r = safeValidateSchema({ ...NODE, limit: 250 });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).groupBy).toBe('stage');
      expect((r.data as Record<string, unknown>).limit).toBe(250);
    }
  });

  it('`limit` is optional: the node without it parses green on both entry paths', () => {
    expect(ObjectKanbanSchema.safeParse(NODE).success).toBe(true);
    expect(safeValidateSchema(NODE).success).toBe(true);
  });

  it('`groupBy` is REQUIRED: a lane-less node is refused AT `groupBy` on both entry paths', () => {
    // The retired contract required a lane field too; this is the
    // required-ness carried across, not a new constraint.
    const laneless = { type: 'object-kanban', objectName: 'opportunity' };
    const r = ObjectKanbanSchema.safeParse(laneless);
    expect(r.success).toBe(false);
    if (!r.success) expect(issuePaths(r.error.issues as readonly Issue[])).toContain('groupBy');
    const u = safeValidateSchema(laneless);
    expect(u.success).toBe(false);
    if (!u.success) expect(issuePaths(u.error.issues as readonly Issue[])).toContain('groupBy');
  });

  it.each([
    ['groupBy', 42],
    ['limit', 'twenty'],
    ['limit', 0],
    ['limit', 1.5],
  ] as const)('refuses a wrong-typed `%s` (%j) AT the key — the enforcement mirroring adds', (key, value) => {
    // Before this card every one of these rode `.passthrough()` unexamined.
    // This is the verdict that moves, and it moves toward refusal.
    const r = ObjectKanbanSchema.safeParse({ ...NODE, [key]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(issuePaths(r.error.issues as readonly Issue[])).toContain(key);
  });
});

/* ── The zod mirror: the retired key ──────────────────────────────────────── */

describe('objectui#7322 — the zod mirror REFUSES `groupField` by name', () => {
  it('`groupField` STAYS a member of the mirror shape (a tombstone is present on both halves to be audible)', () => {
    // Deleting it would make an authored `groupField` pass through in silence
    // — the before-state, on a key that never grouped anything.
    expect(shapeKeys()).toContain(RETIRED);
  });

  it('a `groupField`-authored node is refused AT `groupField`, and the message names `groupBy`', () => {
    const r = ObjectKanbanSchema.safeParse({ type: 'object-kanban', objectName: 'task', groupField: 'status', groupBy: 'status' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const hit = issueEntries(r.error.issues as readonly Issue[]).find((e) => e.path === RETIRED);
      expect(hit, JSON.stringify(r.error.issues)).toBeDefined();
      expect(hit?.message).toContain('RETIRED (objectui#7322)');
      expect(hit?.message).toContain('`groupBy`');
    }
  });

  it('…and through the published union entry point, with the same path and the same remedy', () => {
    const r = safeValidateSchema({ type: 'object-kanban', objectName: 'task', groupField: 'status', groupBy: 'status' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const hit = issueEntries(r.error.issues as readonly Issue[]).find((e) => e.path === RETIRED);
      expect(hit, JSON.stringify(r.error.issues)).toBeDefined();
      expect(hit?.message).toContain('`groupBy`');
    }
  });

  it('the old declared shape — `groupField` alone — is refused too; it never grouped anything', () => {
    const r = ObjectKanbanSchema.safeParse({ type: 'object-kanban', objectName: 'task', groupField: 'status' });
    expect(r.success).toBe(false);
    if (!r.success) expect(issuePaths(r.error.issues as readonly Issue[])).toContain(RETIRED);
  });

  it('absent stays valid: a node that never wrote `groupField` is untouched', () => {
    const r = ObjectKanbanSchema.safeParse(NODE);
    expect(r.success).toBe(true);
    if (r.success) expect(RETIRED in (r.data as Record<string, unknown>)).toBe(false);
  });
});

/* ── The controls ─────────────────────────────────────────────────────────── */

describe('objectui#7322 — the control key stays undeclared, so nothing outside the three keys moved', () => {
  it('is ABSENT from the mirror shape', () => {
    expect(shapeKeys()).not.toContain(CONTROL_KEY);
  });

  it('the SAME wrong-typed value under the control key is still admitted unexamined', () => {
    // The before-state of `groupBy` and `limit`, kept on purpose on a key that
    // is not read: `.passthrough()` admits it, of any type, and it survives.
    // This is the proof the mirror's unknown-key policy is byte-for-byte what
    // it was — neither `.strict()` nor a strip was reached for on the way past
    // (`BaseSchema`'s index signature is objectui#5155, not this card).
    const r = ObjectKanbanSchema.safeParse({ ...NODE, [CONTROL_KEY]: 42 });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as Record<string, unknown>)[CONTROL_KEY]).toBe(42);
  });

  it('the type-level bindings above are referenced, so lint keeps them', () => {
    expect(literal.groupBy).toBe('stage');
    expect(literal.limit).toBe(250);
    expect(retiredLiteral.objectName).toBe('opportunity');
    expect(lanelessLiteral.type).toBe('object-kanban');
  });
});

describe('objectui#7322 — the tombstone is NODE-LOCAL: the view-level `groupField` alias is live', () => {
  it.each(VIEW_LEVEL_ALIAS_SITES)('%s still reads the view-level alias', (file, text) => {
    // If a site stops reading `groupField`, the retirement's stated boundary
    // has moved and the docblocks on both faces are wrong: re-derive, do not
    // widen the tombstone on the way past.
    expect(readRepo(file), `${file} no longer reads the view-level \`groupField\` alias as \`${text}\``).toContain(text);
  });

  it('the view-level alias is still DECLARED on `KanbanConfig` in the same mirror file', () => {
    expect(readRepo(MIRROR)).toContain(VIEW_LEVEL_ALIAS_MIRROR_TEXT);
  });
});

/* ── The doc page — triage's completion signal ────────────────────────────── */

describe('objectui#7322 — the row-cap block on the plugin docs page is annotated `ObjectKanbanSchema`', () => {
  const src = readRepo(DOC);

  it('carries the annotation and its import, in a `tsx` fence the doc-snippet gate compiles against the built dist', () => {
    expect(src).toContain("import type { ObjectKanbanSchema } from '@object-ui/types'");
    expect(src).toContain('const board: ObjectKanbanSchema = {');
    expect(src).not.toContain('const board = {');
  });

  it('the block still authors the documented shape — `groupBy` and `limit`, never `groupField`', () => {
    const start = src.indexOf('const board: ObjectKanbanSchema = {');
    const end = src.indexOf('```', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    expect(block).toContain("groupBy: 'stage'");
    expect(block).toMatch(/^\s+limit: 250,/m);
    expect(block).not.toContain(RETIRED);
  });
});
