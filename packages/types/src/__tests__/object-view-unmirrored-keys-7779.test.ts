/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#7779 — `ObjectViewSchema`'s ten unmirrored declared keys, closed
 * nine-for-ten under maintainer ruling B (2026-09-06: liveness first, then
 * mirror-or-retire per key), with `listViews` left in the parity ledger by
 * measurement.
 *
 * ## The defect
 *
 * `ObjectViewSchema` in `../objectql.ts` declared ten keys its Zod mirror in
 * `../zod/objectql.zod.ts` never did (objectui#7279's `UnmirroredDeclared`
 * reading). `BaseSchema` is `.passthrough()`, so a document authoring any of
 * them passed the validator UNEXAMINED while the published type invited the
 * author to write it: `defaultViewType: 'tree'`, `navigation: 'page'`,
 * `searchableFields: 'name'` all parsed green and rendered with the key
 * ignored — declared, not enforced.
 *
 * ## What this file pins, and the shapes it borrows
 *
 * The mirror half is `object-kanban-group-by-limit-7322.test.ts`: membership is
 * asserted on the mirror's OWN `.shape`, never on parse acceptance (under
 * `.passthrough()` acceptance cannot tell "declared" from "admitted
 * unexamined"); every mirrored key carries an accepted-and-survives assertion
 * AND a wrong-typed refusal AT the key — the pairing that makes the pin a
 * reading rather than a tolerance; and the read set is DERIVED off the renderer
 * with a positive control, so a zero is a reading.
 *
 * The by-reference half is `spec-subschema-parity.test.ts`: the three spec keys
 * are pinned by IDENTITY against the spec slot (`SpecListViewSchema.shape.*`),
 * not against a copy, so a spec-side change moves them; the two view-switcher
 * keys the same way against the sibling `ViewSwitcherSchema` slots the renderer
 * forwards them into verbatim.
 *
 * The retire half is `TimelineSchema.timeScale` (objectui#6355) /
 * `ObjectKanbanSchema.groupField` (objectui#7322): `?: never` on the TS face and
 * `retirementTombstone()` on the mirror, BOTH halves, so the retired spelling is
 * refused BY NAME on each face rather than deleted into the index signature.
 *
 * ## The one that stayed, and why it is pinned too
 *
 * `listViews` is NOT mirrored. The ruling's own fallback clause fires on the
 * measurement below: the declaration's value is the local `NamedListView` — 47
 * declared top-level members, of which the renderer reads six (`label`, `type`,
 * `columns`, `filter`, `sort`, `options`), leaving 41 that a key-for-key local
 * mirror would enforce unread. The renderer reads a SEVENTH key off a named
 * view, `data`, which is NOT a declared member of `NamedListView`: it arrives
 * through an `as any` cast on the named-view config in the renderer
 * (`(currentNamedViewConfig as any)?.data`), which is why the read set below
 * has seven entries while the arithmetic subtracts only six. The spec's
 * `ViewSchema.listViews` is a record of the STRICT `ObjectListViewSchema`, and
 * the spec value refuses the named views this package's docs teach. Both facts
 * are asserted against the SPEC schema here, so the day the spec relaxes (or
 * the renderer's read set moves) the measurement — and the stop — is re-taken
 * rather than remembered.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ListViewSchema as SpecListViewSchema,
  ObjectListViewSchema as SpecObjectListViewSchema,
  NavigationConfigSchema as SpecNavigationConfigSchema,
  ViewSchema as SpecViewSchema,
} from '@objectstack/spec/ui';

import { ObjectViewSchema } from '../zod/objectql.zod';
import { ViewSwitcherSchema } from '../zod/views.zod';
import { safeValidateSchema } from '../zod/index.zod';
import type { ObjectViewSchema as TsObjectViewSchema, NamedListView } from '../objectql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
/** The `object-view` NODE renderer — registered by `plugin-view/src/index.tsx`. */
const READER = 'packages/plugin-view/src/ObjectView.tsx';
/** The switcher the renderer composes; it reads the two forwarded keys. */
const SWITCHER = 'packages/plugin-view/src/ViewSwitcher.tsx';
const REGISTRATION = 'packages/plugin-view/src/index.tsx';
const MIRROR = 'packages/types/src/zod/objectql.zod.ts';
const DECLARATION = 'packages/types/src/objectql.ts';
const README = 'packages/plugin-view/README.md';
const DOC = 'content/docs/plugins/plugin-view.mdx';

const SPEC_REFERENCED = ['navigation', 'searchableFields', 'filterableFields'] as const;
const SIBLING_REFERENCED = ['allowCreateView', 'viewActions'] as const;
const LOCAL_LITERALS = ['defaultViewType', 'defaultListView', 'showViewSwitcher'] as const;
const MIRRORED = [...SPEC_REFERENCED, ...SIBLING_REFERENCED, ...LOCAL_LITERALS] as const;
type Mirrored = (typeof MIRRORED)[number];
const RETIRED = 'viewTabBar';
const LEDGERED = 'listViews';

/**
 * Exact source text of the reads, as they stand today. Line numbers drift and
 * live in the docblocks' prose only; the READ is the fact.
 */
const READ_TEXT: Record<Mirrored, ReadonlyArray<readonly [file: string, text: string]>> = {
  navigation: [[READER, 'const navigationConfig: ViewNavigationConfig | undefined = schema.navigation;']],
  searchableFields: [[READER, 'searchableFields: activeView?.searchableFields ?? (schema as any).searchableFields,']],
  filterableFields: [[READER, 'filterableFields: activeView?.filterableFields ?? (schema as any).filterableFields,']],
  allowCreateView: [
    [READER, 'allowCreateView: schema.allowCreateView,'],
    [SWITCHER, 'const createViewButton = schema.allowCreateView ? ('],
  ],
  viewActions: [
    [READER, 'viewActions: schema.viewActions,'],
    [SWITCHER, '{schema.viewActions.map((action, idx) => {'],
  ],
  defaultViewType: [[READER, "return schema.defaultViewType || 'grid';"]],
  defaultListView: [[READER, 'if (schema.defaultListView && namedListViews?.[schema.defaultListView]) {']],
  showViewSwitcher: [[READER, 'const showViewSwitcherToggle = schema.showViewSwitcher === true;']],
};

/** The registration's editable-props meta names the three local literals too. */
const REGISTRATION_TEXT: readonly string[] = [
  "{ name: 'defaultViewType', type: 'enum', enum: ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map'] },",
  "{ name: 'defaultListView', type: 'string' },",
  "{ name: 'showViewSwitcher', type: 'boolean' },",
];

/** A declared-keys-only control of the read set: read, declared, untouched. */
const READ_CONTROL_KEY = 'objectName';
/**
 * A plausible view-chrome spelling the renderer never reads. It stays undeclared
 * on both faces — the proof that this change declares the keys the card measured
 * and nothing else.
 */
const CONTROL_KEY = 'viewSwitcherPosition';

/** The seven `NamedListView` members the renderer reads off a named view. */
const NAMED_VIEW_READS = ['columns', 'data', 'filter', 'label', 'options', 'sort', 'type'] as const;

/** The documented node; every assertion below is a delta on it. */
const NODE = { type: 'object-view', objectName: 'accounts' } as const;

/** One value per mirrored key that the declaration admits — the accept leg. */
const ACCEPTED: Record<Mirrored, unknown> = {
  navigation: { mode: 'drawer', view: 'summary_view' },
  searchableFields: ['name', 'email'],
  filterableFields: ['status'],
  allowCreateView: true,
  viewActions: [{ type: 'share', icon: 'share-2' }, { type: 'delete' }],
  defaultViewType: 'kanban',
  defaultListView: 'all',
  showViewSwitcher: true,
};

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** The canonical `any` detector: only `any` absorbs `1 &` down to something `0` extends. */
type IsAny<T> = 0 extends (1 & T) ? true : false;

type ViewKind = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';

// `defaultViewType`: the declaration's SEVEN-value union, optional, not `any`.
export type _DefaultViewTypeIsSevenUnion = Expect<Equal<TsObjectViewSchema['defaultViewType'], ViewKind | undefined>>;
export type _DefaultViewTypeIsNotAny = Expect<Equal<IsAny<TsObjectViewSchema['defaultViewType']>, false>>;
// `viewTabBar`: a `?: never` tombstone — the only value it admits is absence.
// Deleting the member instead would make this `any` (index signature) and the
// pin red, which is the point: the tombstone is load-bearing.
export type _ViewTabBarIsTombstone = Expect<Equal<TsObjectViewSchema['viewTabBar'], undefined>>;
export type _ViewTabBarIsNotAny = Expect<Equal<IsAny<TsObjectViewSchema['viewTabBar']>, false>>;
// `listViews`: STILL the declaration's local value — this card moved neither face.
export type _ListViewsIsTheLocalRecord = Expect<Equal<TsObjectViewSchema['listViews'], Record<string, NamedListView> | undefined>>;
// The control key is NOT declared: it resolves to `any` through the index
// signature, exactly as the ten did on the zod side before this card.
export type _ControlKeyFallsThroughToIndexSignature = Expect<IsAny<TsObjectViewSchema['viewSwitcherPosition']>>;

// The TS face accepts the documented shape on a literal.
export const literal: TsObjectViewSchema = { ...NODE, ...(ACCEPTED as Record<Mirrored, never>) };
// …REFUSES the retired spelling on a literal (an object is not `never`). This
// directive goes unused — and the type-check goes red with TS2578 — the moment
// the tombstone is deleted or widened back to `ViewTabBarConfig`.
// @ts-expect-error — `viewTabBar` is RETIRED on this node (objectui#7779); it was never read
export const retiredLiteral: TsObjectViewSchema = { ...NODE, viewTabBar: { showAddButton: true } };
// …and REFUSES the host-only view kind: `tree` is not authorable here (objectui#5321).
// @ts-expect-error — `defaultViewType` is the seven-value union; `tree` is host composition only
export const hostOnlyLiteral: TsObjectViewSchema = { ...NODE, defaultViewType: 'tree' };

/* ── Off-disk derivations ─────────────────────────────────────────────────── */

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** Every `schema.KEY` / `(schema as any).KEY` read in a source file, off disk. */
function schemaReads(rel: string): Set<string> {
  const src = readRepo(rel);
  return new Set([...src.matchAll(/\bschema(?: as any\))?\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

/** Every `currentNamedViewConfig?.KEY` read in the renderer — the named-view read set. */
function namedViewReads(): string[] {
  const src = readRepo(READER);
  return [...new Set([...src.matchAll(/currentNamedViewConfig(?: as any\))?\?\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))].sort();
}

/** Top-level members of `NamedListView`, counted off the declaration source. */
function namedListViewMemberCount(): number {
  const src = readRepo(DECLARATION);
  const start = src.indexOf('export interface NamedListView {');
  expect(start, 'NamedListView is no longer declared where this pin reads it').toBeGreaterThan(-1);
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end);
  return [...body.matchAll(/^ {2}[A-Za-z_$][\w$]*\??:/gm)].length;
}

function shapeKeys(schema: unknown): string[] {
  return Object.keys((schema as { shape: Record<string, unknown> }).shape);
}

function shapeMember(schema: unknown, key: string): unknown {
  return (schema as { shape: Record<string, unknown> }).shape[key];
}

interface Issue {
  path?: readonly (string | number)[];
  message?: string;
  code?: string;
  /** zod 4 `invalid_union`: the issues of every option that was tried. */
  errors?: readonly (readonly Issue[])[];
}

/**
 * Every issue as `path` + `message`, with the nested option errors of an
 * `invalid_union` flattened in: `AnyComponentSchema` is a plain `z.union`, so
 * a refusal inside the `object-view` arm surfaces as one root `invalid_union`
 * issue whose `errors` carry the per-arm paths.
 */
function issueEntries(issues: readonly Issue[], prefix: readonly (string | number)[] = []): Array<{ path: string; message: string; code: string }> {
  const out: Array<{ path: string; message: string; code: string }> = [];
  for (const issue of issues) {
    const path = [...prefix, ...(issue.path ?? [])];
    out.push({ path: path.join('.'), message: issue.message ?? '', code: issue.code ?? '' });
    for (const nested of issue.errors ?? []) out.push(...issueEntries(nested, path));
  }
  return out;
}

function issuePaths(issues: readonly Issue[]): string[] {
  return issueEntries(issues).map((e) => e.path);
}

/** Does any issue sit AT the key or below it (`key`, `key.0`, `key.mode`)? */
function refusedAt(issues: readonly Issue[], key: string): boolean {
  return issuePaths(issues).some((p) => p === key || p.startsWith(`${key}.`));
}

/* ── The reads ────────────────────────────────────────────────────────────── */

describe('objectui#7779 — the renderer reads the eight mirrored keys, which is the fact the mirror records', () => {
  it('the batch is exactly the eight keys the card mirrored, in its three dispositions', () => {
    // Non-vacuity for every per-key assertion below, and the card's own bound.
    expect(SPEC_REFERENCED).toHaveLength(3);
    expect(SIBLING_REFERENCED).toHaveLength(2);
    expect(LOCAL_LITERALS).toHaveLength(3);
    expect(MIRRORED).toHaveLength(8);
    expect(new Set<string>(MIRRORED).size).toBe(8);
  });

  it.each(MIRRORED)('`%s` is still read, as the exact text the docblocks cite', (key) => {
    for (const [file, text] of READ_TEXT[key]) {
      expect(readRepo(file), `${file} no longer reads \`${key}\` as \`${text}\``).toContain(text);
    }
  });

  it('the registration still exposes the three local literals as editable props', () => {
    const src = readRepo(REGISTRATION);
    for (const text of REGISTRATION_TEXT) expect(src).toContain(text);
  });

  it('the read set, derived from the renderer and the switcher, contains every mirrored key and the read control — and NOT the retired key or the control key', () => {
    const reads = new Set([...schemaReads(READER), ...schemaReads(SWITCHER)]);
    for (const key of MIRRORED) expect(reads.has(key), `renderer no longer reads schema.${key}`).toBe(true);
    // The positive control: the query that returns zero for `viewTabBar` is
    // the same query that returns `objectName`, so the zero is a reading.
    expect(reads.has(READ_CONTROL_KEY)).toBe(true);
    // The retirement's premise: nothing on this node ever read `viewTabBar`.
    // If the renderer starts reading it, the tombstone is wrong and this turns
    // red BEFORE anyone re-authors the key.
    expect(reads.has(RETIRED)).toBe(false);
    // Non-vacuity for the control key: if the renderer ever starts reading it,
    // this turns red and the control must be re-chosen, not declared on the
    // way past.
    expect(reads.has(CONTROL_KEY)).toBe(false);
  });

  it('`viewTabBar` reaches the tab bar only as a component PROP from the host, never off the node', () => {
    // The boundary the retirement's docblock states: `ViewTabBar` takes
    // `config?: ViewTabBarConfig` as a prop; the node renderer renders no tab
    // bar itself (ADR-0053, host owns the switcher).
    expect(readRepo('packages/plugin-view/src/ViewTabBar.tsx')).toContain('config?: ViewTabBarConfig;');
    expect(readRepo(READER)).not.toMatch(/<ViewTabBar\b/);
    expect(readRepo(READER)).not.toMatch(/\bviewTabBar\b/);
  });
});

/* ── The zod mirror: membership ───────────────────────────────────────────── */

describe('objectui#7779 — the zod mirror declares the eight keys and the tombstone, and NOT `listViews`', () => {
  it.each([...MIRRORED, RETIRED])('`%s` is a member of the mirror shape (membership cannot be read off acceptance under passthrough)', (key) => {
    expect(shapeKeys(ObjectViewSchema)).toContain(key);
  });

  it('`listViews` is STILL not a member — the ruling\'s fallback clause, pinned so the ledger entry cannot go stale unnoticed', () => {
    expect(shapeKeys(ObjectViewSchema)).not.toContain(LEDGERED);
  });

  it('the control key is undeclared on the mirror too', () => {
    expect(shapeKeys(ObjectViewSchema)).not.toContain(CONTROL_KEY);
  });
});

/* ── By reference: the spec slots and the sibling slots ───────────────────── */

describe('objectui#7779 — the three spec-modelled keys are the spec\'s own slots BY REFERENCE', () => {
  it.each(SPEC_REFERENCED)('`%s` IS `SpecListViewSchema.shape.%s` — the same object, not a copy', (key) => {
    expect(
      shapeMember(ObjectViewSchema, key),
      `ObjectViewSchema.${key} must be SpecListViewSchema.shape.${key} by reference — a local ` +
        'restatement is the drift objectui#4588 measured; if the spec slot is wrong, fix the spec',
    ).toBe(shapeMember(SpecListViewSchema, key));
  });

  it.each(SPEC_REFERENCED)('`%s` is also the slot `ObjectListViewSchema` carries under that name (the spec models it on both view faces)', (key) => {
    // Not identity — the spec builds the two objects separately — but the same
    // accept set on the probes below, which is what "models it" means.
    const a = shapeMember(SpecListViewSchema, key) as { safeParse(v: unknown): { success: boolean } };
    const b = shapeMember(SpecObjectListViewSchema, key) as { safeParse(v: unknown): { success: boolean } };
    for (const probe of [undefined, ACCEPTED[key], 'page', 42, ['a'], { mode: 'bogus' }]) {
      expect(a.safeParse(probe).success, `${key} disagrees on ${JSON.stringify(probe)}`).toBe(b.safeParse(probe).success);
    }
  });

  it('`navigation` parses exactly as the spec\'s `NavigationConfigSchema` does (the slot is that schema, optional)', () => {
    const slot = shapeMember(ObjectViewSchema, 'navigation') as { safeParse(v: unknown): { success: boolean; data?: unknown } };
    // The spec declares `mode: NavigationModeSchema.default('page')`, so a
    // config that lets the mode default is legal authored metadata — the exact
    // input the hand copy of objectui#4588 refused.
    const defaulted = slot.safeParse({ view: 'summary_view' });
    expect(defaulted.success).toBe(true);
    expect((defaulted.data as { mode?: string }).mode).toBe('page');
    for (const probe of [{ mode: 'drawer' }, { mode: 'bogus' }, 'page', { mode: 'page', bogus: 1 }, undefined]) {
      expect(slot.safeParse(probe).success, JSON.stringify(probe)).toBe(SpecNavigationConfigSchema.optional().safeParse(probe).success);
    }
    // A string is refused at `navigation`, an unknown mode at `navigation.mode`:
    // the spec's strict object, not a local `z.any()`.
    expect(SpecNavigationConfigSchema.safeParse({ mode: 'bogus' }).success).toBe(false);
    expect(SpecNavigationConfigSchema.safeParse({ mode: 'page', bogus: 1 }).success).toBe(false);
  });

  it('the spec describes `filterableFields` as the legacy shorthand — the deprecation the mirror now inherits by reference', () => {
    const slot = shapeMember(ObjectViewSchema, 'filterableFields') as { description?: string };
    expect(slot.description).toMatch(/legacy shorthand for userFilters\.fields/i);
  });
});

describe('objectui#7779 — `allowCreateView` / `viewActions` are the sibling `ViewSwitcherSchema` slots BY REFERENCE', () => {
  it.each(SIBLING_REFERENCED)('`%s` IS `ViewSwitcherSchema.shape.%s` — one shape for the key the renderer forwards verbatim', (key) => {
    expect(shapeMember(ObjectViewSchema, key)).toBe(shapeMember(ViewSwitcherSchema, key));
  });

  it('the switcher slot admits exactly the four action types the declaration spells, and refuses a fifth', () => {
    const slot = shapeMember(ObjectViewSchema, 'viewActions') as { safeParse(v: unknown): { success: boolean } };
    for (const type of ['share', 'settings', 'duplicate', 'delete']) {
      expect(slot.safeParse([{ type }]).success, type).toBe(true);
    }
    expect(slot.safeParse([{ type: 'archive' }]).success).toBe(false);
    expect(slot.safeParse([{ icon: 'x' }]).success).toBe(false);
  });
});

/* ── The accept leg and the refusal leg, per key ──────────────────────────── */

describe('objectui#7779 — each mirrored key is accepted with its declared value and the value SURVIVES the parse', () => {
  it('the documented node with all eight keys parses green, directly and through the union door', () => {
    const doc = { ...NODE, ...ACCEPTED };
    const r = ObjectViewSchema.safeParse(doc);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    const u = safeValidateSchema(doc);
    expect(u.success, u.success ? '' : JSON.stringify(u.error.issues)).toBe(true);
  });

  it.each(MIRRORED)('`%s` survives the parse with its value (spec defaults may be added, nothing is dropped)', (key) => {
    const r = ObjectViewSchema.safeParse({ ...NODE, [key]: ACCEPTED[key] });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (!r.success) return;
    const out = (r.data as Record<string, unknown>)[key];
    if (key === 'navigation') {
      // `NavigationConfigSchema` fills its defaults on parse; the authored
      // members are still there and unchanged.
      expect(out).toMatchObject(ACCEPTED.navigation as Record<string, unknown>);
    } else {
      expect(out).toEqual(ACCEPTED[key]);
    }
  });

  it.each(MIRRORED)('`%s` is optional: the node without it parses green on both entry paths', (key) => {
    const doc: Record<string, unknown> = { ...NODE, ...ACCEPTED };
    delete doc[key];
    expect(ObjectViewSchema.safeParse(doc).success).toBe(true);
    expect(safeValidateSchema(doc).success).toBe(true);
  });
});

describe('objectui#7779 — each mirrored key REFUSES a wrong-typed value AT its key: the enforcement mirroring adds', () => {
  it.each([
    ['navigation', 'page'],
    ['navigation', { mode: 'bogus' }],
    ['searchableFields', 'name'],
    ['searchableFields', [1]],
    ['filterableFields', 'status'],
    ['allowCreateView', 'yes'],
    ['viewActions', 'share'],
    ['viewActions', [{ type: 'archive' }]],
    ['defaultViewType', 'tree'],
    ['defaultViewType', 42],
    ['defaultListView', 7],
    ['showViewSwitcher', 'true'],
  ] as const)('refuses `%s` = %j at the key, directly and through the union door', (key, value) => {
    // Before this card every one of these rode `.passthrough()` unexamined.
    // This is the verdict that moves, and it moves toward refusal.
    const r = ObjectViewSchema.safeParse({ ...NODE, [key]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(refusedAt(r.error.issues as readonly Issue[], key), JSON.stringify(issuePaths(r.error.issues as readonly Issue[]))).toBe(true);
    const u = safeValidateSchema({ ...NODE, [key]: value });
    expect(u.success).toBe(false);
    if (!u.success) expect(refusedAt(u.error.issues as readonly Issue[], key), JSON.stringify(issuePaths(u.error.issues as readonly Issue[]))).toBe(true);
  });

  it('`defaultViewType` admits exactly the seven declared kinds — not the spec\'s nine (`chart` / `tree` are host composition only, objectui#5321)', () => {
    const slot = shapeMember(ObjectViewSchema, 'defaultViewType') as { safeParse(v: unknown): { success: boolean } };
    for (const kind of ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map']) {
      expect(slot.safeParse(kind).success, kind).toBe(true);
    }
    for (const kind of ['chart', 'tree', 'list', 'detail']) {
      expect(slot.safeParse(kind).success, kind).toBe(false);
    }
  });
});

/* ── The zod mirror: the retired key ──────────────────────────────────────── */

describe('objectui#7779 — the zod mirror REFUSES `viewTabBar` by name', () => {
  it('a `viewTabBar`-authored node is refused AT `viewTabBar`, and the message says why and what owns the config now', () => {
    const r = ObjectViewSchema.safeParse({ ...NODE, viewTabBar: { showAddButton: true } });
    expect(r.success).toBe(false);
    if (r.success) return;
    const entries = issueEntries(r.error.issues as readonly Issue[]);
    const hit = entries.find((e) => e.path === RETIRED);
    expect(hit, JSON.stringify(entries)).toBeDefined();
    expect(hit?.message).toContain('RETIRED (objectui#7779)');
    expect(hit?.message).toContain('ViewTabBar');
    expect(hit?.message).toContain('config');
    // A tombstone reports `invalid_type` — the same code a bare `z.never()`
    // reports — so tooling that classifies refusals is unchanged.
    expect(hit?.code).toBe('invalid_type');
  });

  it('…and through the published union entry point', () => {
    const u = safeValidateSchema({ ...NODE, viewTabBar: {} });
    expect(u.success).toBe(false);
    if (!u.success) expect(refusedAt(u.error.issues as readonly Issue[], RETIRED)).toBe(true);
  });

  it('absent stays valid on both entry paths — a node that never wrote the key is untouched', () => {
    expect(ObjectViewSchema.safeParse(NODE).success).toBe(true);
    expect(safeValidateSchema(NODE).success).toBe(true);
  });

  it('the guidance is the SAME string on both author-facing channels (message and describe)', () => {
    const slot = shapeMember(ObjectViewSchema, RETIRED) as { description?: string };
    const r = ObjectViewSchema.safeParse({ ...NODE, viewTabBar: true });
    expect(r.success).toBe(false);
    if (r.success) return;
    const hit = issueEntries(r.error.issues as readonly Issue[]).find((e) => e.path === RETIRED);
    expect(slot.description).toBe(hit?.message);
  });

  it('both faces carry the tombstone, lockstep — off disk, so deleting either half is caught', () => {
    expect(readRepo(DECLARATION)).toContain('viewTabBar?: never;');
    expect(readRepo(DECLARATION)).toContain('RETIRED (objectui#7779)');
    expect(readRepo(MIRROR)).toContain('viewTabBar: retirementTombstone(');
  });
});

/* ── `listViews`: the measurement that keeps it in the ledger ─────────────── */

describe('objectui#7779 — `listViews` stays unmirrored on the ruling\'s fallback clause; the measurement is pinned against the SPEC', () => {
  it('the spec slot `ViewSchema.listViews` is a record whose value is the strict `ObjectListViewSchema`', () => {
    const slot = shapeMember(SpecViewSchema, 'listViews') as { unwrap(): { def?: { type?: string; valueType?: unknown }; _def?: { type?: string; valueType?: unknown } } };
    const inner = slot.unwrap();
    const def = inner.def ?? inner._def;
    expect(def?.type).toBe('record');
    expect(def?.valueType).toBe(SpecObjectListViewSchema);
    // Strict: an unknown key is refused, not stripped — the reason a spec-typed
    // value cannot admit the local `NamedListView` vocabulary.
    const r = SpecObjectListViewSchema.safeParse({ label: 'x', columns: ['a'], options: {} });
    expect(r.success).toBe(false);
    if (!r.success) expect((r.error.issues as readonly Issue[]).some((i) => i.code === 'unrecognized_keys')).toBe(true);
  });

  it('the spec value REFUSES the named views this package\'s docs teach — the behaviour a by-reference mirror would lose', () => {
    // README / plugin-view.mdx: `listViews: { all: { label: 'All Users' } }` —
    // "each needs a `label`", nothing else. The spec requires `columns`.
    const labelOnly = SpecObjectListViewSchema.safeParse({ label: 'All Users' });
    expect(labelOnly.success).toBe(false);
    if (!labelOnly.success) expect(refusedAt(labelOnly.error.issues as readonly Issue[], 'columns')).toBe(true);
    // README: a `filter`-only view with `type: 'grid'` and no `columns`.
    const filtered = SpecObjectListViewSchema.safeParse({ label: 'Under 100', type: 'grid', filter: [{ field: 'price', operator: 'less_than', value: 100 }] });
    expect(filtered.success).toBe(false);
    if (!filtered.success) expect(refusedAt(filtered.error.issues as readonly Issue[], 'columns')).toBe(true);
    // schema-reference.md: an ObjectQL tuple filter and a `default: true` flag.
    const tuple = SpecObjectListViewSchema.safeParse({ label: 'My Deals', columns: ['name'], filter: [['owner', '=', '${currentUser.id}']] });
    expect(tuple.success).toBe(false);
    if (!tuple.success) expect(refusedAt(tuple.error.issues as readonly Issue[], 'filter')).toBe(true);
    const flagged = SpecObjectListViewSchema.safeParse({ label: 'My Deals', columns: ['name'], default: true });
    expect(flagged.success).toBe(false);
    // The control: the shape the schema catalog authors IS accepted, so the
    // refusals above are readings of the dialect, not of the schema being
    // uniformly closed.
    expect(SpecObjectListViewSchema.safeParse({ label: 'Directory', columns: ['name', 'email'] }).success).toBe(true);
  });

  it('the documented shapes the spec refuses are still what the docs teach (the measurement\'s inputs, off disk)', () => {
    expect(readRepo(README)).toContain("listViews: { all: { label: 'All Users' } }");
    expect(readRepo(DOC)).toContain("listViews: { all: { label: 'All Users' } }");
    expect(readRepo('content/docs/api/schema-reference.md')).toContain('"filter": [["owner", "=", "${currentUser.id}"]],');
  });

  it('the renderer reads exactly seven keys off a named view — six of them declared `NamedListView` members, the seventh (`data`) an `as any` cast — of a declaration with far more, the reason a local key-for-key mirror was not the answer either', () => {
    expect(namedViewReads()).toEqual([...NAMED_VIEW_READS]);
    // The tab strip reads `label` off the entries too — same member, second site.
    expect(readRepo(READER)).toContain('{view.label || key}');
    // Six of those seven are declared `NamedListView` members. The seventh,
    // `data`, is not declared at all — it reaches the renderer through an
    // `as any` cast on the named-view config — so the "unread" arithmetic
    // below subtracts six, not seven. Both directions are already pinned
    // without a new assertion: were `data` ever declared, the exact count
    // moves 47 → 48 and fails here; were the cast read dropped,
    // `namedViewReads()` returns six entries and fails above.
    const declared = namedListViewMemberCount();
    // HOW THIS NUMBER IS TAKEN: `namedListViewMemberCount()` above — the two-space
    // indent in its `/^ {2}[A-Za-z_$][\w$]*\??:/gm` regex is what makes it a
    // TOP-LEVEL member count. A looser count that drops that indent anchor also
    // matches nested object-literal lines inside the members' inline types and
    // gives 59 on the same declaration; a hand figure between the two instruments
    // is where the retired "about 52 members" came from. ⛔ Do not re-derive the
    // loose number and quote it beside this one — they measure different things.
    // Pinned EXACT rather than floored: the retired `>= 40` floor permitted the
    // declaration to shed seven members, including a shrink toward the read set,
    // which is exactly the condition that re-opens the `listViews` decision
    // (objectui#7928); and a floor cannot catch growth at all, so the quoted
    // figures could stale silently in either direction.
    expect(
      declared,
      'NamedListView\'s top-level member count moved (was 47). Re-derive it with this file\'s own namedListViewMemberCount() regex, then update the "47 declared / 41 unread" figures in the three files that carry them together — .changeset/object-view-unmirrored-keys-7779.md, packages/types/src/zod/objectql.zod.ts and packages/types/src/__tests__/zod-mirror-parity.test.ts — plus this file\'s own header. A shrink toward the read set also re-opens the listViews decision (objectui#7928).',
    ).toBe(47);
    expect(declared).toBeGreaterThan(NAMED_VIEW_READS.length);
  });

  it('the TS face still declares `listViews` as the local record (neither face moved)', () => {
    expect(readRepo(DECLARATION)).toContain('listViews?: Record<string, NamedListView>;');
  });
});

/* ── Controls: what did NOT move ──────────────────────────────────────────── */

describe('objectui#7779 — neighbouring keys did not move, and the passthrough envelope is untouched', () => {
  it.each(['showSearch', 'showFilters', 'showSort', 'showCreate', 'showRefresh', 'layout', 'operations', 'table', 'form', 'title', 'description'])(
    '`%s` is still a mirror member',
    (key) => {
      expect(shapeKeys(ObjectViewSchema)).toContain(key);
    },
  );

  it('a neighbour still refuses a wrong-typed value the way it did before (`showSearch`, `layout`)', () => {
    const a = ObjectViewSchema.safeParse({ ...NODE, showSearch: 'yes' });
    expect(a.success).toBe(false);
    if (!a.success) expect(refusedAt(a.error.issues as readonly Issue[], 'showSearch')).toBe(true);
    const b = ObjectViewSchema.safeParse({ ...NODE, layout: 'popover' });
    expect(b.success).toBe(false);
    if (!b.success) expect(refusedAt(b.error.issues as readonly Issue[], 'layout')).toBe(true);
  });

  it('the host-composition surface still rides the passthrough (objectui#5097) — this card declared the measured keys and nothing else', () => {
    const r = ObjectViewSchema.safeParse({ ...NODE, wrapHeaders: true, [CONTROL_KEY]: 'left' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).wrapHeaders).toBe(true);
      expect((r.data as Record<string, unknown>)[CONTROL_KEY]).toBe('left');
    }
  });

  it('the mirror still requires the discriminator and the object binding', () => {
    expect(ObjectViewSchema.safeParse({ objectName: 'accounts' }).success).toBe(false);
    expect(ObjectViewSchema.safeParse({ type: 'object-view' }).success).toBe(false);
  });
});

/* ── Docs: the two tables that taught `viewTabBar` as authorable ──────────── */

describe('objectui#7779 — the docs no longer teach `viewTabBar` as an `object-view` node key', () => {
  it.each([README, DOC])('%s lists `ViewTabBarConfig` as the `ViewTabBar` prop, and drops `viewTabBar` from the node row', (file) => {
    const src = readRepo(file);
    const nodeRow = src.split('\n').find((line) => line.startsWith('| `ObjectViewSchema` |'));
    expect(nodeRow, 'the import table lost its ObjectViewSchema row').toBeDefined();
    expect(nodeRow).not.toMatch(/`viewTabBar`,/);
    expect(nodeRow).toContain('`viewTabBar` is retired');
    const configRow = src.split('\n').find((line) => line.startsWith('| `ViewTabBarConfig` |'));
    expect(configRow).toContain('`config` prop of `ViewTabBar`');
  });
});
