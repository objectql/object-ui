/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#8466 — `ObjectCalendarSchema.colorField` and
 * `ObjectCalendarSchema.allDayField` declared, on both faces.
 *
 * ## The defect
 *
 * `ObjectCalendar.tsx`'s `getCalendarConfig` reads FIVE flat field-name keys off
 * the node, and `plugin-calendar/README.md` teaches all five in one sentence —
 * "point `titleField` / `startDateField` / `endDateField` / `allDayField` /
 * `colorField` at your own fields when they differ." Only THREE of the five were
 * declared. The other two reached the renderer through `BaseSchema`'s
 * `[key: string]: any` on the TS side and its `.passthrough()` on the mirror:
 * admitted, never examined by either published face. A misspelling therefore
 * left the calendar silently colourless while every published gate passed.
 *
 * ## Why BOTH keys, and the measurement that decided the second one
 *
 * The two keys look asymmetric and are not. `colorField` IS a spec key — but
 * only inside the NESTED `calendar` block (`CalendarConfigSchema`). At the FLAT
 * position, which is the position this interface declares,
 * `ComponentPropsMap['object-calendar']` refuses `colorField` and `allDayField`
 * IDENTICALLY, with the same `unrecognized_keys` diagnostic — and it refuses
 * `titleField`, `startDateField` and `endDateField` the same way, all three of
 * which have shipped DECLARED here for releases.
 *
 * So the "declaring `allDayField` widens past the contract" objection, if it
 * held, would condemn three shipped members too. It does not hold, and the
 * reason is the direction of travel: the flat face is objectui's own lane, taken
 * deliberately (`zod/objectql.zod.ts` keeps `.passthrough()` naming this very key
 * — "the renderers grow config knobs ahead of the protocol (calendar's
 * `allDayField`, for one), and stripping them here would silently disable a
 * shipped capability"). Under an index signature and a `.passthrough()` that
 * ALREADY admit any value, a declaration cannot widen anything; it only NARROWS,
 * by adding value validation where there was none. Commandment #0.1 bans the
 * lenient direction, and this is the strict one.
 *
 * That whole argument rests on measurements, so this file PINS them — the spec's
 * five refusals and its accepting controls — rather than restating them in prose
 * that could rot when the spec moves.
 *
 * ## The boundary this card does NOT cross
 *
 * Neither key is added to `plugin-calendar`'s registration `inputs`, and that is
 * load-bearing, not an oversight: the FORWARD direction of
 * `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` refuses an
 * `inputs` entry the spec props schema does not accept, so declaring these there
 * would redden the merge queue. The three sibling flat keys are absent from
 * `inputs` for exactly the same reason. Pinned below.
 *
 * ## What declaring buys — and what it does NOT, measured not assumed
 *
 * objectui#7927 measured the ceiling: `BaseSchema` ends in `[key: string]: any`,
 * so no annotation here can catch a MISSPELLED key. `colourField` stays admitted
 * on both faces, and the control assertions below PIN that, so nobody reads this
 * file as claiming more than it does. What the ceiling does not cap is the VALUE
 * dimension, and that is the half this file pins — on the TS face through
 * `@ts-expect-error` directives that go UNUSED (TS2578, a hard type-check
 * failure) the moment their member is deleted, and on the mirror through
 * refusals that land ON the key and reach `safeValidateSchema`, the path the
 * CLI's `validate` / `check` take.
 *
 * ## Instruments, borrowed from `kanban-calendar-filter-sort-8174.test.ts`
 *
 * Membership is asserted on the mirror's OWN `.shape`, never on parse acceptance
 * (under `.passthrough()` acceptance cannot tell "declared" from "admitted
 * unexamined"). Type-level pins use invariant equality, so a member that fell
 * back to the index signature reads as `any` and therefore as a failure. And
 * every claim carries a CONTROL asserted to hold the opposite verdict, so no
 * assertion can pass vacuously.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CalendarConfigSchema, ComponentPropsMap } from '@objectstack/spec/ui';

import { ObjectCalendarSchema, safeValidateSchema } from '../zod/index.zod';
import type { ObjectCalendarSchema as TsObjectCalendarSchema } from '../objectql';
import type { CalendarViewSchema as TsCalendarViewSchema } from '../complex';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const CALENDAR_READER = 'packages/plugin-calendar/src/ObjectCalendar.tsx';
const CALENDAR_REGISTRATION = 'packages/plugin-calendar/src/index.tsx';
const CALENDAR_README = 'packages/plugin-calendar/README.md';

/** The five flat field-name keys `getCalendarConfig` reads and the README teaches. */
const FLAT_KEYS = ['titleField', 'startDateField', 'endDateField', 'allDayField', 'colorField'] as const;
/** The three that were already declared — the precedent the two new ones join. */
const ALREADY_DECLARED = ['titleField', 'startDateField', 'endDateField'] as const;
/** The two this card declares. */
const NEWLY_DECLARED = ['colorField', 'allDayField'] as const;

/**
 * A key the renderer never reads and neither face declares. Non-vacuity control
 * for every "declared" assertion: it must stay `any` on the TS face and out of
 * the mirror shape, while still being ADMITTED — the objectui#7927 ceiling,
 * pinned rather than claimed away.
 */
const CONTROL_KEY = 'swatchField';
/** A declared-and-read control for the off-disk read census. */
const READ_CONTROL_KEY = 'objectName';
/** The misspelling the ceiling still admits. Pinned, not fixed here. */
const MISSPELLING = 'colourField';

const CALENDAR_NODE = { type: 'object-calendar', objectName: 'event' } as const;

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** The canonical `any` detector: only `any` absorbs `1 &` down to something `0` extends. */
type IsAny<T> = 0 extends (1 & T) ? true : false;
/** An object with no keys is assignable to `Pick<T, K>` only when `K` is optional on `T`. */
type IsOptional<T, K extends keyof T> = Record<string, never> extends Pick<T, K> ? true : false;

// `colorField` is DERIVED from the spec's `CalendarConfig`, so it resolves to
// that member's type. Delete the member and the indexed access falls back to
// `[key: string]: any`, making `IsAny` true and this `Equal` false.
export type _ColorFieldIsString = Expect<Equal<TsObjectCalendarSchema['colorField'], string | undefined>>;
export type _ColorFieldIsNotAny = Expect<Equal<IsAny<TsObjectCalendarSchema['colorField']>, false>>;
export type _ColorFieldIsOptional = Expect<IsOptional<TsObjectCalendarSchema, 'colorField'>>;
export type _AllDayFieldIsString = Expect<Equal<TsObjectCalendarSchema['allDayField'], string | undefined>>;
export type _AllDayFieldIsNotAny = Expect<Equal<IsAny<TsObjectCalendarSchema['allDayField']>, false>>;
export type _AllDayFieldIsOptional = Expect<IsOptional<TsObjectCalendarSchema, 'allDayField'>>;
// The control key is undeclared, exactly as the two above were before this card.
// Same instrument, opposite verdict — which is what makes the six lines above
// readings rather than a type that says `true` for everything.
export type _ControlKeyFallsThrough = Expect<IsAny<TsObjectCalendarSchema['swatchField']>>;
// objectui#7927's ceiling, pinned rather than claimed away.
export type _MisspellingStillAdmitted = Expect<IsAny<TsObjectCalendarSchema['colourField']>>;

// The SIBLING element, drawn by the same renderer, already declares all five.
// A member that fell back to the index signature reads as `any` and fails these,
// so these five lines are what would catch the two interfaces forking again.
type Declared<T, K extends keyof T> = Equal<IsAny<T[K]>, false>;
const siblingPins: [
  Expect<Declared<TsCalendarViewSchema, 'titleField'>>,
  Expect<Declared<TsCalendarViewSchema, 'startDateField'>>,
  Expect<Declared<TsCalendarViewSchema, 'endDateField'>>,
  Expect<Declared<TsCalendarViewSchema, 'allDayField'>>,
  Expect<Declared<TsCalendarViewSchema, 'colorField'>>,
] = [true, true, true, true, true];
// Control: the same instrument returns the OPPOSITE verdict for a key the
// sibling does not declare either, so the five above are readings.
export type _SiblingControlFallsThrough = Expect<IsAny<TsCalendarViewSchema['swatchField']>>;

// The TS face ACCEPTS the documented shape…
const calendarLiteral: TsObjectCalendarSchema = {
  ...CALENDAR_NODE,
  colorField: 'status_colour',
  allDayField: 'is_all_day',
};

// …and REFUSES wrong-typed values the index signature used to admit. Each
// directive goes unused — TS2578, a hard failure — if its member is deleted.
// @ts-expect-error — `colorField` names a FIELD, so it is a string, not the colour itself
const calendarBadColorField: TsObjectCalendarSchema = { ...CALENDAR_NODE, colorField: 0xff0000 };
// @ts-expect-error — `allDayField` names a FIELD; a boolean is the VALUE, the confusion this declaration catches
const calendarBadAllDayField: TsObjectCalendarSchema = { ...CALENDAR_NODE, allDayField: true };

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

/* ── The reads: the fact the declarations record ──────────────────────────── */

describe('objectui#8466 — the renderer reads these keys, which is what the declarations record', () => {
  it('`getCalendarConfig` reads all five flat keys off the node', () => {
    const src = readRepo(CALENDAR_READER);
    for (const key of FLAT_KEYS) {
      expect(src, `${CALENDAR_READER} no longer reads the flat ${key}`).toContain(`(schema as any).${key}`);
    }
  });

  it('…and `allDayField` is LOAD-BEARING, not merely resolved (objectui#8026)', () => {
    // The premise that removed triage's "declaring an inert key would be worse"
    // objection. If the renderer ever stops honouring the key, this reddens
    // BEFORE anyone trusts the declaration to mean something.
    const src = readRepo(CALENDAR_READER);
    expect(src).toContain('allDayField');
    // It is in the config memo's dependency list, which is what makes an
    // authored change reach the screen.
    expect(src).toMatch(/useMemo\(\(\) => getCalendarConfig\(schema\), \[[\s\S]*?allDayField[\s\S]*?\]\)/);
  });

  it('the reads census returns a firing control, so the verdicts above are readings', () => {
    const reads = rendererReads(CALENDAR_READER);
    expect(reads.has(READ_CONTROL_KEY)).toBe(true);
    expect(reads.has(CONTROL_KEY)).toBe(false);
  });

  it('the README still teaches all five in one sentence, which is what makes them authorable', () => {
    // The card's second half: the published prose. If this sentence is ever
    // rewritten, the declaration set it justifies has to be revisited.
    const readme = readRepo(CALENDAR_README);
    for (const key of FLAT_KEYS) expect(readme).toContain(`\`${key}\``);
    expect(readme).toContain('at your own\nfields when they differ.');
  });
});

/* ── The spec face: the measurement that decided `allDayField` ────────────── */

describe('objectui#8466 — the spec refuses ALL FIVE flat keys, which is why declaring widens nothing', () => {
  it('`ComponentPropsMap["object-calendar"]` declares none of the five at top level', () => {
    const declared = specShapeKeys('object-calendar');
    for (const key of FLAT_KEYS) {
      expect(declared, `spec now declares the flat ${key}; revisit this card's reasoning`).not.toContain(key);
    }
    // Non-vacuity: the same extraction returns the keys the spec certainly does
    // declare at this position, so the five absences are readings.
    expect(declared).toContain(READ_CONTROL_KEY);
    expect(declared).toContain('calendar');
    expect(declared).toContain('defaultView');
  });

  it('…and refuses each of the five IDENTICALLY, with `unrecognized_keys`', () => {
    // This is the measurement that resolves the `colorField` / `allDayField`
    // asymmetry: at the FLAT position there is none. The three already-shipped
    // members are refused by exactly the same diagnostic as the two new ones.
    const oc = (ComponentPropsMap as unknown as Record<string, any>)['object-calendar'];
    for (const key of FLAT_KEYS) {
      const r = oc.safeParse({ [key]: 'x' });
      expect(r.success, `spec now accepts the flat ${key}`).toBe(false);
      expect(r.error.issues.map((i: { code: string }) => i.code)).toContain('unrecognized_keys');
    }
    // Both controls fire: keys the spec DOES declare parse green here.
    expect(oc.safeParse({ [READ_CONTROL_KEY]: 'event' }).success).toBe(true);
    expect(oc.safeParse({ locale: 'en-GB' }).success).toBe(true);
  });

  it('`colorField` IS a spec key — but only in the NESTED block, which is a different position', () => {
    // The distinction the whole decision turns on. `CalendarConfigSchema` is a
    // strictObject of four keys: it HAS `colorField` and refuses `allDayField`
    // by name. That asymmetry is real nested, and absent flat.
    expect(Object.keys(CalendarConfigSchema.shape)).toEqual([
      'startDateField',
      'endDateField',
      'titleField',
      'colorField',
    ]);
    const nested = CalendarConfigSchema.safeParse({ startDateField: 's', allDayField: 'x' });
    expect(nested.success).toBe(false);
    if (!nested.success) {
      expect(nested.error.issues.map((i) => i.code)).toContain('unrecognized_keys');
    }
    // Firing control: the same parse with a declared member is green.
    expect(CalendarConfigSchema.safeParse({ startDateField: 's', colorField: 'c' }).success).toBe(true);
  });
});

/* ── The sibling element: one renderer, two interfaces, one flat vocabulary ── */

describe('objectui#8466 — `calendar-view` already declared all five, and the two must not fork', () => {
  it('ONE renderer serves both `object-calendar` and `calendar`', () => {
    // `ObjectCalendarRenderer` is registered twice. That is what makes a fork
    // between the two interfaces a real defect rather than a tidiness point:
    // the same `getCalendarConfig` reads the same five keys off both.
    const src = readRepo(CALENDAR_REGISTRATION);
    expect(src).toContain("ComponentRegistry.register('object-calendar', ObjectCalendarRenderer");
    expect(src).toContain("ComponentRegistry.register('calendar', ObjectCalendarRenderer");
  });

  it('the sibling `CalendarViewSchema` declares all five — including the two this card adds', () => {
    // Measured, and the reason declaring `allDayField` is not a new precedent:
    // this package has ALREADY shipped it declared on a published interface, on
    // the element the same renderer draws. `ObjectCalendarSchema` was the odd
    // one out, not the pioneer.
    const declaredOnSibling: Record<(typeof FLAT_KEYS)[number], true> = {
      titleField: true,
      startDateField: true,
      endDateField: true,
      allDayField: true,
      colorField: true,
    };
    expect(Object.keys(declaredOnSibling).sort()).toEqual([...FLAT_KEYS].sort());
    expect(siblingPins).toHaveLength(5);
  });
});

/* ── The boundary: `inputs` stays clear of the flat face ──────────────────── */

describe('objectui#8466 — the registration `inputs` deliberately declares NO flat key', () => {
  it('none of the five is an `inputs` entry, so the parity gate stays green', () => {
    // `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` FORWARD
    // direction: a block may not declare a top-level input the spec refuses.
    // All five are refused, so all five must stay out of `inputs`.
    const src = readRepo(CALENDAR_REGISTRATION);
    for (const key of FLAT_KEYS) {
      expect(src, `${key} became an inputs entry; the parity gate's forward direction will refuse it`)
        .not.toMatch(new RegExp(`name:\\s*'${key}'`));
    }
    // Firing control: keys that ARE inputs entries are found by the same regex.
    expect(src).toMatch(/name:\s*'objectName'/);
    expect(src).toMatch(/name:\s*'defaultView'/);
  });
});

/* ── The zod mirror ───────────────────────────────────────────────────────── */

describe('objectui#8466 — the mirror declares what the interface declares', () => {
  it('membership, read off the mirror shape (acceptance cannot tell declared from admitted)', () => {
    const keys = shapeKeys(ObjectCalendarSchema);
    for (const key of [...ALREADY_DECLARED, ...NEWLY_DECLARED]) expect(keys).toContain(key);
    // The control stays out, which keeps the assertions above from being
    // satisfied by a shape that simply contains everything.
    expect(keys).not.toContain(CONTROL_KEY);
    expect(keys).not.toContain(MISSPELLING);
  });

  it('accepts the documented shape, and the values SURVIVE the parse', () => {
    const node = { ...CALENDAR_NODE, colorField: 'status_colour', allDayField: 'is_all_day' };
    const r = ObjectCalendarSchema.safeParse(node);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).colorField).toBe('status_colour');
      expect((r.data as Record<string, unknown>).allDayField).toBe('is_all_day');
    }
    // …and through the published union entry point, so the right arm is reached.
    expect(safeValidateSchema(node).success).toBe(true);
  });

  it('both members stay OPTIONAL: the node without them parses green — this adds no requiredness', () => {
    expect(ObjectCalendarSchema.safeParse(CALENDAR_NODE).success).toBe(true);
    expect(safeValidateSchema(CALENDAR_NODE).success).toBe(true);
  });

  it.each([
    ['colorField', 0xff0000],
    ['colorField', { hex: '#ff0000' }],
    // The confusion the declaration catches: the FLAG rather than the FIELD NAME.
    ['allDayField', true],
    ['allDayField', ['is_all_day']],
  ] as const)('refuses a wrong-typed `%s` (%j) AT the key — the verdict declaring MOVES', (key, value) => {
    // Before this card every one of these rode `.passthrough()` unexamined.
    const r = ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, [key]: value });
    expect(r.success).toBe(false);
    if (!r.success) {
      // The refusal must land ON the key, not merely somewhere in the node —
      // which is what distinguishes value validation from an unrelated refusal.
      const paths = r.error.issues.map((i) => (i.path ?? []).join('.'));
      expect(paths, JSON.stringify(paths)).toContain(key);
    }
    // …and the same refusal through the path the CLI's `validate` / `check` reach.
    expect(safeValidateSchema({ ...CALENDAR_NODE, [key]: value }).success).toBe(false);
  });

  it('the objectui#7927 ceiling is UNCHANGED: a misspelled key is still admitted', () => {
    // This card buys value validation, not misspelling detection. Pinning the
    // ceiling is what stops the change being read as more than it is — and
    // turns red if `.passthrough()` is ever tightened, which would be #7927's
    // job and would need this file revisited.
    expect(ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, [MISSPELLING]: 'x' }).success).toBe(true);
    expect(ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, [CONTROL_KEY]: 'x' }).success).toBe(true);
    // Even a wrong-TYPED misspelling rides through, which is the sharp edge:
    // the value validation above reaches only the spelling that is declared.
    expect(ObjectCalendarSchema.safeParse({ ...CALENDAR_NODE, [MISSPELLING]: true }).success).toBe(true);
  });
});

/* ── Keep the type-level consts referenced (they are the pins) ─────────────── */

describe('objectui#8466 — the TS face accepts the documented node', () => {
  it('the accepted literal carries the values it was authored with', () => {
    expect(calendarLiteral.colorField).toBe('status_colour');
    expect(calendarLiteral.allDayField).toBe('is_all_day');
    // The refused literals exist only so their `@ts-expect-error` directives do;
    // referencing them keeps `noUnusedLocals` off this file's back.
    expect([calendarBadColorField, calendarBadAllDayField]).toHaveLength(2);
  });
});
