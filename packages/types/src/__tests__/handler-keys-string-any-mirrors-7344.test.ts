/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The 8 `on*` handler keys that PR #7339's census could not see — four
 * declared the handler-expression STRING dialect (`z.string()`), three declared
 * `z.any()`, one declared `z.function()` in a multi-line spelling — now REFUSE
 * BY NAME (objectui#7344).
 *
 * ## The rulings this executes
 *
 *   - objectui#6182 (maintainer, 2026-08-25, batch 4, 「同意」, option A): the
 *     handler-expression string dialect is NOT a supported authoring form, on
 *     either face. Its consequence clause sends the `z.string()` handler mirrors
 *     into objectui#6124's per-key sweep "with the same treatment".
 *   - objectui#6124 (maintainer, 2026-08-30, 「批次 #8 同意」; PR #7339): the
 *     treatment's SHAPE. zod face: a named refusal arm (`handlerKeyRefusal`,
 *     `../zod/tombstone.zod.ts`), no expression arm, no declarative-object arm.
 *     TypeScript face, measured per key: a function type only where a runtime
 *     consumer reads the key as a function, else `?: never`.
 *
 * ## Why #7339 missed these
 *
 * Its census anchored on `on*: z.function(` — one line, one spelling. The four
 * `z.string()` sites and the three `z.any()` sites never matched; the eighth,
 * `CalendarViewSchema.onEventClick`, WAS `z.function()` but spelled over three
 * lines (`z` ⏎ `.function()` ⏎ `.optional()`). Two of the three families were
 * worse than the one #7339 fixed: an authored string parsed GREEN on all seven
 * (the mirror was WIDER than the declaration — objectui#7069's direction) and
 * then reached a slot that calls it, throwing `onBack is not a function` at
 * click (the objectui#4453 shape: an authored string handler that runs nothing
 * and is refused nowhere).
 *
 * ## Per-key measurement (the TypeScript disposition), on `origin/main` @ `d88e20f55`
 *
 * RUNTIME SLOT — a host-supplied function REACHES a renderer:
 *   - `views.zod.ts#DetailViewSchema.onBack` — `detail-view`'s registration
 *     (`plugin-detail/src/index.tsx`) spreads the node's keys onto `DetailView`
 *     (`{...props}` after `SchemaRenderer`'s `...componentProps`), whose
 *     `handleBack` CALLS `onBack()` when set (`DetailView.tsx`). The TS twin
 *     declared `string`; the consumer's own prop is `() => void`, so the twin
 *     now declares what the renderer invokes.
 *   - `crud.zod.ts#DetailSchema.onBack` — `ComponentRegistry.register('detail',
 *     DetailView)` (`plugin-detail/src/index.tsx`), the same `handleBack`.
 *   - `crud.zod.ts#ActionSchema.onClick` — `ActionRunner.ts` `await
 *     action.onClick()` (two sites); `action-menu.tsx`, `containers.tsx`,
 *     `record-quick-actions.tsx` all `typeof action.onClick === 'function'`.
 *   - `complex.zod.ts#CalendarViewSchema.onEventClick` — `calendar-view`'s
 *     `pickHostCallbacks` forwards it when it is a function
 *     (`calendar-view-renderer.tsx`), the sibling of `onViewChange`'s arm.
 *
 * RETIRED — nothing reads the key (`?: never` on the TypeScript face):
 *   - `app.zod.ts#AppActionSchema.onClick` — `AppComponentSchema.actions[]` has
 *     no reader in `@object-ui/layout`, `@object-ui/app-shell` or the console;
 *     zero references to `AppAction` outside `packages/types`.
 *   - `reports.zod.ts#ReportBuilderSchema.onSave` / `.onCancel` — no renderer is
 *     registered for `report-builder` (control on the same tree:
 *     `register('detail-view'` and `register('report-designer'` both resolve).
 *   - `crud.zod.ts#CRUDDialogSchema.onClose` — no renderer is registered for
 *     `crud-dialog`; zero references to `CRUDDialogSchema` outside
 *     `packages/types` and the docs index.
 *
 * NONE read the key as a STRING and dispatched it — the third class the card
 * reserved for the decision box did not occur on this tree.
 *
 * ## Excluded by ruling, verified by describe text
 *
 * `views.zod.ts` still declares three `on*: z.string()` keys — `onViewChange`
 * (`ViewSwitcherSchema`), `onChange` (`FilterUISchema`), `onChange`
 * (`SortUISchema`). They are event NAMES dispatched on `window` (PR #6899), not
 * handler expressions; each `.describe()` says so verbatim, and the census below
 * pins that wording as the reason the three survive the anchor.
 *
 * ## Predictions, written before the first run (red-first)
 *
 * On the unmodified tree (`origin/main` @ `d88e20f55`):
 *   - the single-line census finds 10 sites, not the 3 event-name keys; the
 *     multi-line census finds 1 (`complex.zod.ts` `onEventClick`), not 0;
 *   - no site carries the objectui#6124 guidance in its description;
 *   - an authored STRING parses GREEN on the seven `z.string()` / `z.any()`
 *     sites and is refused with `invalid_type` (not `custom`) on `onEventClick`;
 *   - a live function parses GREEN on the `z.any()` three and on `onEventClick`,
 *     and is refused with `invalid_type` on the `z.string()` four;
 *   - the whole-document counter-probe parses `onBack: 'goBack'` GREEN;
 *   - `tsc -p tsconfig.test.json` reports TS2344 on every `RetiredIsNever` and
 *     `StringIsGone` line, and on `KeepsFunction<DetailViewSchema['onBack']>`.
 * The `{}`-parses-green probes and the instrument controls are GREEN before and
 * after — they pin the instrument, not this change.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';

import { AppActionSchema as AppActionZod } from '../zod/app.zod';
import { CalendarViewSchema as CalendarViewZod } from '../zod/complex.zod';
import {
  ActionSchema as ActionZod,
  CRUDDialogSchema as CRUDDialogZod,
  DetailSchema as DetailZod,
} from '../zod/crud.zod';
import { ReportBuilderSchema as ReportBuilderZod } from '../zod/reports.zod';
import {
  DetailViewSchema as DetailViewZod,
  FilterUISchema as FilterUIZod,
  SortUISchema as SortUIZod,
  ViewSwitcherSchema as ViewSwitcherZod,
} from '../zod/views.zod';

import type { AppAction } from '../app';
import type { CalendarViewSchema } from '../complex';
import type { ActionSchema, CRUDDialogSchema, DetailSchema } from '../crud';
import type { ReportBuilderSchema } from '../reports';
import type { DetailViewSchema } from '../views';

/* ── The census, as data ─────────────────────────────────────────────────── */

type Site = readonly [file: string, schema: string, key: string, mirror: z.ZodType];

/** The object that DECLARES `key` behind a mirror. `crud.zod.ts#ActionSchema`
 *  is a `z.lazy` (its `chain` recurses), so the member lives one `unwrap()`
 *  down; every other mirror here IS the object. Same helper as the #6124 pin. */
const objectOf = (mirror: z.ZodType, key: string): z.ZodObject<z.ZodRawShape> => {
  const inner = mirror instanceof z.ZodLazy ? mirror.unwrap() : mirror;
  const obj = inner as z.ZodObject<z.ZodRawShape>;
  if (!(key in obj.shape)) throw new Error(`mirror does not declare \`${key}\``);
  return obj;
};

/** The four keys whose function value REACHES a renderer (channels above). */
const RUNTIME_SLOT: readonly Site[] = [
  ['views.zod.ts', 'DetailViewSchema', 'onBack', DetailViewZod],
  ['crud.zod.ts', 'ActionSchema', 'onClick', ActionZod],
  ['crud.zod.ts', 'DetailSchema', 'onBack', DetailZod],
  ['complex.zod.ts', 'CalendarViewSchema', 'onEventClick', CalendarViewZod],
];

/** The four keys NO renderer reads. */
const RETIRED: readonly Site[] = [
  ['app.zod.ts', 'AppActionSchema', 'onClick', AppActionZod],
  ['reports.zod.ts', 'ReportBuilderSchema', 'onSave', ReportBuilderZod],
  ['reports.zod.ts', 'ReportBuilderSchema', 'onCancel', ReportBuilderZod],
  ['crud.zod.ts', 'CRUDDialogSchema', 'onClose', CRUDDialogZod],
];

const ALL_SITES: readonly Site[] = [...RUNTIME_SLOT, ...RETIRED];

/** The three `on*: z.string()` keys that SURVIVE the census — event names, not
 *  handlers — with the mirror that declares each, so the exclusion is pinned to
 *  its reason (the describe text) and not to a line number. */
const EVENT_NAME_KEYS: readonly Site[] = [
  ['views.zod.ts', 'ViewSwitcherSchema', 'onViewChange', ViewSwitcherZod],
  ['views.zod.ts', 'FilterUISchema', 'onChange', FilterUIZod],
  ['views.zod.ts', 'SortUISchema', 'onChange', SortUIZod],
];
const EVENT_NAME_WORDING = 'an event NAME, not a callback or a handler expression';

const ZOD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'zod');
/** EVERY mirror module — objectui#6182's close condition runs over the whole
 *  directory, not the nine files #7339's census listed (that list is what let
 *  these eight through). */
const MIRROR_FILES = readdirSync(ZOD_DIR)
  .filter((f) => f.endsWith('.zod.ts'))
  .sort();
const readMirror = (file: string) => readFileSync(join(ZOD_DIR, file), 'utf8');

/** objectui#6182's anchor, single-line: the key, then `z.` and one of the three
 *  constructors on the same line. Anchored at line start so the spelling cannot
 *  match mid-identifier (`buttonLabel`, `actionUrl`). */
const ON_KEY_SINGLE_LINE = /^\s*(on[A-Z][A-Za-z]*): z\.(function|string|any)\(/gm;
/** The multi-line spelling that hid `onEventClick`: `on*: z` ending the line,
 *  `.function(` opening the next. */
const ON_KEY_MULTI_LINE_FUNCTION = /^\s*(on[A-Z][A-Za-z]*): z[ \t]*\r?\n\s*\.function\(/gm;
/** Control for the multi-line instrument: the same two-line shape on a NON-handler
 *  key with any constructor (`startDateField: z` ⏎ `.string()`, `buttonVariant: z`
 *  ⏎ `.enum(`). Fires on this tree; a regex that could not see line breaks
 *  would report 0 here too. */
const MULTI_LINE_CONTROL = /^\s*[a-z][A-Za-z]*: z[ \t]*\r?\n\s*\.(enum|string|any|union|number|boolean)\(/gm;

const describeOf = (mirror: z.ZodType, key: string): string | undefined =>
  (objectOf(mirror, key).shape[key] as { description?: string } | undefined)?.description;

/** One key, isolated: `.pick()` keeps the member's own declaration and drops
 *  the rest, so a refusal can only be about the key under test. */
const pickKey = (mirror: z.ZodType, key: string) =>
  objectOf(mirror, key).pick({ [key]: true } as Record<string, true>);

/** The handler-expression string dialect, in the spellings the corpus taught:
 *  a bare handler name (`content/docs/core/report-schema.mdx` `onSave:
 *  'handleSaveReport'`) and an inline call (`examples/schema-catalog`
 *  `onClick: "toast(\"…\")"`). */
const AUTHORED_STRINGS = ['handleSaveReport', 'toast("Hello from ObjectUI!")'] as const;
const AUTHORED_ACTION_OBJECT = { action: 'toast', title: 'Saved', variant: 'success' };
const LIVE_FUNCTION = () => undefined;

/* ── Census: objectui#6182's close condition, both anchors ───────────────── */

describe('census: the only on*: z.(function|string|any) lines left in packages/types/src/zod are the three event-name keys (objectui#6182 close condition)', () => {
  it('the single-line anchor returns exactly the three event-name keys', () => {
    const hits = MIRROR_FILES.flatMap((file) =>
      [...readMirror(file).matchAll(ON_KEY_SINGLE_LINE)].map((m) => `${file}#${m[1]}: z.${m[2]}(`),
    );
    expect(hits.sort()).toEqual([
      'views.zod.ts#onChange: z.string(',
      'views.zod.ts#onChange: z.string(',
      'views.zod.ts#onViewChange: z.string(',
    ]);
  });

  it('the multi-line anchor returns 0, and its control still fires on the same files', () => {
    const hits = MIRROR_FILES.flatMap((file) =>
      [...readMirror(file).matchAll(ON_KEY_MULTI_LINE_FUNCTION)].map((m) => `${file}#${m[1]}`),
    );
    expect(hits).toEqual([]);
    const control = MIRROR_FILES.flatMap((file) =>
      [...readMirror(file).matchAll(MULTI_LINE_CONTROL)].map((m) => `${file}: ${m[0].trim()}`),
    );
    expect(control.length).toBeGreaterThan(0);
  });

  it.each(EVENT_NAME_KEYS)('%s %s.%s survives the anchor BECAUSE its describe text says it is an event name (PR #6899)', (_file, _schema, key, mirror) => {
    expect(describeOf(mirror, key)).toContain(EVENT_NAME_WORDING);
    // Still the string it always was — this card does not touch the three.
    expect(pickKey(mirror, key).safeParse({ [key]: 'view-changed' }).success).toBe(true);
  });

  it('the census read the whole mirror directory, not a hand-listed subset', () => {
    // Every file this card edits is in the population, and so is the one that
    // held the multi-line site. A directory read cannot drift the way #7339's
    // nine-file list did.
    for (const file of ['app.zod.ts', 'complex.zod.ts', 'crud.zod.ts', 'reports.zod.ts', 'views.zod.ts']) {
      expect(MIRROR_FILES).toContain(file);
    }
    expect(MIRROR_FILES.length).toBeGreaterThanOrEqual(12);
  });

  it('8 sites are ledgered, 4 runtime slots + 4 retired, with no key filed twice', () => {
    expect(RUNTIME_SLOT).toHaveLength(4);
    expect(RETIRED).toHaveLength(4);
    const ids = ALL_SITES.map(([file, schema, key]) => `${file}#${schema}.${key}`);
    expect(new Set(ids).size).toBe(8);
  });

  it.each(ALL_SITES)('%s %s.%s is DECLARED on the mirror shape, with the objectui#6124 guidance as its description', (_file, _schema, key, mirror) => {
    // `.shape`, not `safeParse`: under `.passthrough()` a DELETED key still
    // parses green (the value rides through), so a parse-based declaration pin
    // stays green through the very deletion it exists to catch.
    expect(objectOf(mirror, key).shape[key]).toBeDefined();
    expect(describeOf(mirror, key)).toContain('objectui#6124');
  });
});

/* ── Behaviour: the string dialect is refused BY NAME, not parsed green ──── */

describe('the handler-expression string dialect is refused by name (objectui#6182 → the #6124 shape)', () => {
  it.each(ALL_SITES)('%s %s.%s refuses an authored STRING at its own path with code `custom` and the guidance', (_file, _schema, key, mirror) => {
    for (const authored of AUTHORED_STRINGS) {
      const result = pickKey(mirror, key).safeParse({ [key]: authored });
      expect(result.success, `\`${key}: ${JSON.stringify(authored)}\` parsed green`).toBe(false);
      if (result.success) return;
      // ON THE KEY: an issue addressed to `key`, not merely a failed parse.
      const issue = result.error.issues.find((i) => String(i.path[0]) === key);
      expect(issue, `no issue addressed to \`${key}\``).toBeDefined();
      expect(issue!.code).toBe('custom');
      expect(issue!.path).toEqual([key]);
      expect(issue!.message).toContain(`\`${key}\``);
      // The #6498 remedy, and the one-string invariant: the runtime message
      // IS the `.describe()` metadata.
      expect(issue!.message).toContain('"type"');
      expect(issue!.message).toContain('action:button');
      expect(issue!.message).toBe(describeOf(mirror, key));
    }
  });

  it.each(ALL_SITES)('%s %s.%s refuses an authored action OBJECT too — no declarative-object arm', (_file, _schema, key, mirror) => {
    const result = pickKey(mirror, key).safeParse({ [key]: AUTHORED_ACTION_OBJECT });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => [i.code, String(i.path[0])])).toEqual([['custom', key]]);
  });

  it.each(ALL_SITES)('%s %s.%s refuses a LIVE FUNCTION — the JSON mirror is not the programmatic channel', (_file, _schema, key, mirror) => {
    // The accept-set change the changeset declares, in the `z.any()` /
    // `z.function()` direction: a function that parsed green here was the
    // instrument's positive control, never an authoring form.
    const result = pickKey(mirror, key).safeParse({ [key]: LIVE_FUNCTION });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => [i.code, String(i.path[0])])).toEqual([['custom', key]]);
  });

  it.each(ALL_SITES)('%s %s.%s — the same isolated shape parses GREEN without the key (the arm is optional; the refusal is about the key)', (_file, _schema, key, mirror) => {
    expect(pickKey(mirror, key).safeParse({}).success).toBe(true);
  });

  it('the guidance wording distinguishes a runtime slot from a retired key', () => {
    for (const [, , key, mirror] of RUNTIME_SLOT) {
      expect(describeOf(mirror, key), key).toContain('RUNTIME SLOT');
      expect(describeOf(mirror, key), key).not.toContain('RETIRED');
    }
    for (const [, , key, mirror] of RETIRED) {
      expect(describeOf(mirror, key), key).toContain('RETIRED (objectui#6124');
      expect(describeOf(mirror, key), key).not.toContain('RUNTIME SLOT');
    }
  });
});

/* ── Counter-probes: why an arm, and not a deletion, on BOTH base shapes ─── */

describe('counter-probe: deleting the key instead is a SILENT accept on either base shape (the ruling\'s ⛔ 不裸删)', () => {
  const detailView = { type: 'detail-view', title: 'Account', onBack: 'goBack' };

  it('with the arm: a whole `detail-view` document is refused at path onBack', () => {
    const result = DetailViewZod.safeParse(detailView);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path)).toEqual([['onBack']]);
  });

  it('the deletion, simulated on a `.passthrough()` mirror: parses GREEN and KEEPS the string, which then reaches `DetailView.onBack` and throws at click', () => {
    const result = DetailViewZod.omit({ onBack: true }).safeParse(detailView);
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).onBack).toBe('goBack');
  });

  it('the deletion, simulated on a plain `z.object` mirror: parses GREEN and DROPS the string — the objectui#4453 silence, from the other side', () => {
    // `AppActionSchema` is not `.passthrough()`: an undeclared key is stripped,
    // so the author is told green and the value vanishes. Two base shapes, two
    // different silences; the named refusal is the only outcome that is loud on
    // both.
    const authored = { type: 'button', label: 'Quick Actions', onClick: 'openQuickActions' };
    const withArm = AppActionZod.safeParse(authored);
    expect(withArm.success).toBe(false);
    expect(withArm.error?.issues.map((i) => i.path)).toEqual([['onClick']]);
    const deleted = AppActionZod.omit({ onClick: true }).safeParse(authored);
    expect(deleted.success).toBe(true);
    expect('onClick' in (deleted.data as Record<string, unknown>)).toBe(false);
  });
});

/* ── The TypeScript face, judged by `tsc -p tsconfig.test.json` ──────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

/** `?: never` reads as exactly `undefined` off the interface (`Equal`, not
 *  `extends`, because `BaseSchema`'s index signature makes a DELETED member read
 *  `any`, which a one-way check would accept). */
type RetiredIsNever<T> = Equal<T, undefined>;

/** A runtime slot keeps a callable member. Over `NonNullable` so `undefined`
 *  cannot satisfy it. */
type KeepsFunction<T> = [Extract<NonNullable<T>, (...args: never[]) => unknown>] extends [never]
  ? false
  : true;

/** The string dialect is gone from the TypeScript face too (objectui#6182: "not
 *  a supported authoring form" on BOTH faces): no `string` survives the member. */
type StringIsGone<T> = [Extract<NonNullable<T>, string>] extends [never] ? true : false;

export type assertionRetiredKeysAreTombstoned = [
  Expect<RetiredIsNever<AppAction['onClick']>>,
  Expect<RetiredIsNever<ReportBuilderSchema['onSave']>>,
  Expect<RetiredIsNever<ReportBuilderSchema['onCancel']>>,
  Expect<RetiredIsNever<CRUDDialogSchema['onClose']>>,
];

export type assertionRuntimeSlotsKeepTheirFunctionType = [
  Expect<KeepsFunction<DetailViewSchema['onBack']>>,
  Expect<KeepsFunction<DetailSchema['onBack']>>,
  Expect<KeepsFunction<ActionSchema['onClick']>>,
  Expect<KeepsFunction<CalendarViewSchema['onEventClick']>>,
];

/** The four former `string` twins — `app.ts`, `reports.ts` ×2, `views.ts`. */
export type assertionStringTwinsStopDeclaringString = [
  Expect<StringIsGone<AppAction['onClick']>>,
  Expect<StringIsGone<ReportBuilderSchema['onSave']>>,
  Expect<StringIsGone<ReportBuilderSchema['onCancel']>>,
  Expect<StringIsGone<DetailViewSchema['onBack']>>,
];

// The three helpers must be able to FAIL — synthetic controls, both directions.
export type assertionRetiredIsNeverCanFail = Expect<Equal<RetiredIsNever<(() => void) | undefined>, false>>;
export type assertionKeepsFunctionCanFail = Expect<Equal<KeepsFunction<string | undefined>, false>>;
export type assertionStringIsGoneCanFail = Expect<Equal<StringIsGone<string | undefined>, false>>;
