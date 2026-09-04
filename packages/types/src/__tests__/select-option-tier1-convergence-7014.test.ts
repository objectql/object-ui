// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The two named select-option faces are ONE declaration now, and converging
 * them narrowed nothing (objectui#7014, Q1).
 *
 * ## What changed
 *
 * `SelectOptionMetadata` (`../field-types`, the object-metadata read model) and
 * `SelectOption` (`../form`, the SDUI form vocabulary) each restated the
 * select-option vocabulary by hand. Both now extend `SelectOptionBase`
 * (`../select-option`), which derives the spec's keys from
 * `@objectstack/spec/data` BY REFERENCE and writes out only the divergences.
 *
 * ## What this file pins, and why each half is needed
 *
 * A convergence has exactly two ways to go wrong, and they fail in opposite
 * directions, so neither half can stand alone:
 *
 *   1. **It narrows something.** A "unification" quietly drops a key one face
 *      had, or tightens a member's type, and every literal that used the
 *      dropped key becomes an excess-property error somewhere else. The
 *      `PRE_CONVERGENCE_*` types below are the two faces' member lists AS THEY
 *      STOOD BEFORE, written out by hand from the declarations, and each is
 *      asserted INVARIANTLY equal to what the converged face resolves to today.
 *      `Equal`, not `extends`: a one-way check passes on a narrowing.
 *
 *   2. **It widens past the authoring contract without saying so.** The
 *      objectui faces are deliberately WIDER than the spec — that is the point
 *      of the dialect keys — but only the runtime READ model may be wider.
 *      The runtime block asserts the spec still refuses every dialect key BY
 *      NAME, each refusal behind a control that accepts the same document minus
 *      the key, so a red here reads "the key's status changed" and never "the
 *      fixture drifted".
 *
 * The one deliberate widening this convergence DOES make is `default` on the
 * object-metadata face: it is a spec key that face could not describe before,
 * ruled `enforce` on the object-field face (objectstack#7246), and it arrives
 * as an OPTIONAL key, so every document that face accepted before it is still
 * accepted. It is asserted below rather than left implicit.
 *
 * ## The control the spec fixtures need
 *
 * A select option's `value` is a lowercase machine identifier with a minimum
 * length, so a one-character value fails `too_small` and NOT for the reason a
 * key-boundary fixture is asking about. Every fixture here uses a value long
 * enough that the only thing under test is the key set, and the accepting
 * control proves it.
 */

import { describe, it, expect } from 'vitest';
import { SelectOptionSchema as SpecSelectOptionSchema } from '@objectstack/spec/data';

import type { SelectOptionBase } from '../select-option';
import type { SelectOptionMetadata } from '../field-types';
import type { SelectOption } from '../form';

/* ── Type-level helpers ──────────────────────────────────────────────────── */

/** Invariant equality — `extends` both ways would accept a narrowing. */
type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/** objectui's own expression wire shape (objectui#2212), as both faces declared it. */
type ExpressionWire = string | { dialect?: string; source: string };

/* ── 1. No narrowing: the pre-convergence member lists, verbatim ─────────── */

/**
 * `SelectOption` as `../form` declared it before the convergence — seven
 * members, `value` widened for standalone forms.
 */
interface PRE_CONVERGENCE_SelectOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
  icon?: string;
  color?: string;
  default?: boolean;
  visibleWhen?: ExpressionWire;
}

/**
 * `SelectOptionMetadata` as `../field-types` declared it before the
 * convergence — seven members, `value` the spec's identifier, `description`
 * the read-model extension, and NO `default` (the gap this convergence closes).
 */
interface PRE_CONVERGENCE_SelectOptionMetadata {
  label: string;
  value: string;
  description?: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
  visibleWhen?: ExpressionWire;
}

/** The SDUI form face is member-for-member what it was. */
export type assertionFormFaceUnchanged =
  Expect< Equal< SelectOption, PRE_CONVERGENCE_SelectOption > >;

/**
 * The object-metadata face kept every member it had, at the same type — the
 * no-narrowing half, stated by removing the one key that was added and
 * comparing what is left.
 */
export type assertionMetadataFaceKeptEveryMember =
  Expect< Equal< Omit< SelectOptionMetadata, 'default' >, PRE_CONVERGENCE_SelectOptionMetadata > >;

/**
 * …and `default` is the ONLY key it gained. Written as a set difference so a
 * second key cannot ride along silently: add one and this stops being `'default'`.
 */
export type assertionMetadataFaceGainedOnlyDefault =
  Expect< Equal< Exclude< keyof SelectOptionMetadata, keyof PRE_CONVERGENCE_SelectOptionMetadata >, 'default' > >;

/** …and `default` really is optional, so no document that parsed before now fails. */
export type assertionDefaultIsOptional =
  Expect< Equal< SelectOptionMetadata['default'], boolean | undefined > >;

/** The two faces differ on exactly one inherited member, and it is `value`. */
export type assertionOnlyValueDiffers =
  Expect< Equal< Omit< SelectOption, 'value' >, Omit< SelectOptionMetadata, 'value' | 'description' > > >;
export type assertionFormValueIsWide =
  Expect< Equal< SelectOption['value'], string | number | boolean > >;
export type assertionMetadataValueIsSpecIdentifier =
  Expect< Equal< SelectOptionMetadata['value'], string > >;

/* ── 2. The base carries every spec key, checked on BOTH sides ───────────── */

/**
 * The spec's key names, each annotated as a member of the derived base. The
 * ANNOTATION is the type-side half — drop a key from the base and this stops
 * compiling — and the runtime assertion below is the other half: add a key to
 * the spec and the lists stop agreeing. Neither half alone is a pin.
 */
const SPEC_KEYS_ON_BASE: readonly (keyof SelectOptionBase)[] = [
  'color',
  'default',
  'label',
  'value',
  'visibleWhen',
];

/** The objectui-only keys, annotated the same way. */
const DIALECT_KEYS_ON_BASE: readonly (keyof SelectOptionBase)[] = ['disabled', 'icon'];

/* ── 3. Neither face admits a key nobody declares ────────────────────────── */

export const rejectsUndeclaredKeyOnFormFace = (): SelectOption => ({
  label: 'High priority',
  value: 'high_priority',
  // @ts-expect-error `weight` is declared by neither the spec nor this repo.
  weight: 3,
});

export const rejectsUndeclaredKeyOnMetadataFace = (): SelectOptionMetadata => ({
  label: 'High priority',
  value: 'high_priority',
  // @ts-expect-error `weight` is declared by neither the spec nor this repo.
  weight: 3,
});

/**
 * The control for the two refusals above: the SAME literal carrying every key
 * the converged faces DO declare compiles with no error. Without it, a face
 * that had gone `never` would pass both `@ts-expect-error` cases vacuously.
 */
export const acceptsEveryDeclaredKey = (): SelectOptionMetadata => ({
  label: 'High priority',
  value: 'high_priority',
  color: '#ef4444',
  default: true,
  visibleWhen: { dialect: 'cel', source: "record.stage == 'open'" },
  description: 'Blocks the release',
  disabled: false,
  icon: 'flame',
});

export const acceptsEveryDeclaredKeyOnFormFace = (): SelectOption => ({
  label: 'Ten',
  value: 10,
  color: '#ef4444',
  default: false,
  visibleWhen: "'admin' in current_user.positions",
  disabled: true,
  icon: 'hash',
});

/* ── Runtime ─────────────────────────────────────────────────────────────── */

/** A valid spec option: `value` is a machine identifier well over the minimum. */
const CONTROL = { label: 'High priority', value: 'high_priority' } as const;

/** The `unrecognized_keys` issue naming `key`, or undefined. */
const refusedByName = (
  result: { success: boolean; error?: { issues: readonly { code: string; keys?: readonly string[] }[] } },
  key: string,
) =>
  result.success
    ? undefined
    : result.error!.issues.find((i) => i.code === 'unrecognized_keys' && (i.keys ?? []).includes(key));

describe('the derived base carries the spec vocabulary', () => {
  it('lists exactly the keys the spec declares', () => {
    expect([...SPEC_KEYS_ON_BASE].sort()).toEqual(Object.keys(SpecSelectOptionSchema.shape).sort());
  });

  it('CONTROL: a clean option is accepted, and for the stated reason', () => {
    const res = SpecSelectOptionSchema.safeParse(CONTROL);
    expect(res.success).toBe(true);
    // …and the reason really is "no extra key, valid value": a one-character
    // value fails for a DIFFERENT reason, which is what makes the ACCEPT above
    // a reading rather than luck.
    const short = SpecSelectOptionSchema.safeParse({ label: 'H', value: 'h' });
    expect(short.success).toBe(false);
    expect(short.success ? [] : short.error.issues.map((i) => i.code)).toContain('too_small');
  });

  it('accepts an option carrying every spec key at once', () => {
    const res = SpecSelectOptionSchema.safeParse({
      ...CONTROL,
      color: '#ef4444',
      default: true,
      visibleWhen: "record.stage == 'open'",
    });
    expect(res.success).toBe(true);
  });
});

describe('the objectui dialect keys sit OUTSIDE that vocabulary', () => {
  it('names the dialect keys the base adds', () => {
    expect([...DIALECT_KEYS_ON_BASE].sort()).toEqual(['disabled', 'icon']);
    // Neither is a spec key — the two lists are disjoint.
    const specKeys = Object.keys(SpecSelectOptionSchema.shape);
    expect(DIALECT_KEYS_ON_BASE.filter((k) => specKeys.includes(k as string))).toEqual([]);
  });

  for (const [key, value] of [
    ['disabled', true],
    ['icon', 'flame'],
    ['description', 'Blocks the release'],
  ] as const) {
    it(`the spec refuses \`${key}\` BY NAME, with the same option minus the key accepted`, () => {
      const res = SpecSelectOptionSchema.safeParse({ ...CONTROL, [key]: value });
      expect(res.success).toBe(false);
      expect(refusedByName(res, key), `expected unrecognized_keys naming '${key}'`).toBeDefined();
      // Control, per fixture: the key is the only difference.
      expect(SpecSelectOptionSchema.safeParse(CONTROL).success).toBe(true);
    });
  }

  it('a fully-populated read-model option is refused as a whole, naming all three', () => {
    const readModel: SelectOptionMetadata = {
      label: 'High priority',
      value: 'high_priority',
      color: '#ef4444',
      default: true,
      description: 'Blocks the release',
      disabled: false,
      icon: 'flame',
    };
    const res = SpecSelectOptionSchema.safeParse(readModel);
    expect(res.success).toBe(false);
    for (const key of ['description', 'disabled', 'icon']) {
      expect(refusedByName(res, key), `expected unrecognized_keys naming '${key}'`).toBeDefined();
    }

    // Control: the same document with only the spec keys parses.
    const { description: _d, disabled: _di, icon: _i, ...specOnly } = readModel;
    expect(SpecSelectOptionSchema.safeParse(specOnly).success).toBe(true);
  });
});
