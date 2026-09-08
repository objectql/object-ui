// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `BaseSchema.visible` / `.hidden` / `.disabled` declare the CEL envelope object
 * the shared evaluator already accepts, as ONE named wire type (objectui#7530,
 * maintainer ruling 2026-09-04: option A -- declare on all three by reusing
 * `ExpressionWireSchema`; not B, a per-key branch in `hasDeclaredPredicate`).
 *
 * ## The measured fact this closes
 *
 * `hasDeclaredPredicate` (`packages/core/src/evaluator/declaredPredicate.ts`)
 * is the one definition of "is a gate declared?" every leg of `shouldHide` /
 * `shouldDisable` asks, and it -- with `toPredicateInput` under it -- accepts
 * three shapes: a boolean, an expression string, and the envelope
 * `{ dialect?, source }`. `SchemaRenderer.hiddenDeclaredGate.test.tsx` and
 * `SchemaRenderer.disabledDeclaredGate.test.tsx` had pinned the envelope as
 * WORKING on `hidden` and `disabled` through a `Record` cast, because no key
 * declared it. Measured before this change on `origin/main` `f96a781`:
 *
 *   - TS  -- all three were `boolean | string` (`base.ts:281` / `:359` / `:385`).
 *   - zod -- all three were `z.union([z.boolean(), z.string()])`
 *     (`base.zod.ts:158` / `:188` / `:203`), and
 *     `BaseSchema.safeParse({ type, hidden: { dialect: 'cel', source: 'true' } })`
 *     returned `success: false` with `invalid_union` at path `hidden` -- the
 *     same envelope `FormFieldSchema.visibleWhen` parsed one file over.
 *
 * So a schema authoring the envelope on any of the three keys failed `validate`
 * and rendered. Declared != enforced, in the direction that gives an AI author
 * no signal.
 *
 * ## What this file pins, and why in this shape
 *
 *   1. Type level -- each key is EXACTLY `boolean | ExpressionWire | undefined`,
 *      invariantly, and the three carry the SAME declared type. `Equal`, not
 *      `extends`: the old `boolean | string` is assignable to the wide union,
 *      so a one-way check stays green on a widening that never happened, and
 *      `BaseSchema`'s `[key: string]: any` index signature means a DELETED
 *      member reads `any`, which a one-way check also accepts.
 *   2. Twin parity -- `ExpressionWire` (TS) and `z.input` of
 *      `ExpressionWireSchema` (zod) are the same union, so the two faces cannot
 *      drift apart the way `hidden` did between #4581 and #7455.
 *   3. Reuse by REFERENCE -- the object arm each key's zod union carries IS
 *      `ExpressionWireSchema`, and so is the one `FormFieldSchema.visibleWhen`
 *      carries after the hoist. A faithful copy passes every value comparison;
 *      identity is the only check that distinguishes reuse from the second
 *      envelope type the ruling forbids (the insight `spec-subschema-parity`
 *      already wrote down for spec re-exports).
 *   4. Runtime -- the envelope `safeParse`s GREEN in full on all three keys,
 *      with and without `dialect`, beside the string and boolean controls; and
 *      the anti-overshoot guards: `{}` (no `source`), `{ dialect: 'cel' }`,
 *      `{ source: 123 }`, a bare number and `null` are still refused AT THE
 *      KEY'S PATH. `z.any()` would satisfy every positive case on its own.
 *
 * ## Why `dialect` is optional and unconstrained
 *
 * Because the runtime reads it that way. `toPredicateInput` keeps a `'cel'`
 * envelope on the canonical engine and unwraps EVERY other dialect (absent,
 * `'template'`, unknown) onto the legacy `${...}` path; an object without a
 * string `source` is "no predicate". `{ dialect: 'cel' }` alone would refuse a
 * spelling the evaluator answers -- a declaration narrower than the runtime is
 * the same defect in the other direction.
 *
 * ## ADR-0089, read again for this card
 *
 * D4 -- "the boolean `visible` (Tab on/off) is a different type and concept and
 * is explicitly out of scope" -- governs `packages/spec`'s keys, not this
 * surface; `BaseSchema` is objectui's own declaration (#7455's triage). The ADR
 * contains no statement that a predicate key is string-only: its D1 gives
 * `visibleWhen` the spec's `ExpressionInputSchema` value, which IS the envelope.
 *
 * ## Predictions, written before the first run (red-first)
 *
 * With `base.ts` / `base.zod.ts` at their `origin/main` `f96a781` blobs and
 * this file in place: `tsc -p tsconfig.test.json` reports TS2344 on the three
 * key assertions (TS face); the twin-parity and wire-shape assertions stay
 * clean (they do not read `BaseSchema`); every `safeParse`-green envelope case
 * fails with `invalid_union` at the key's path (zod face); every control case
 * and every refusal case stays green; the identity cases fail because the
 * object arm of `boolean | string` does not exist.
 */

import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import type { BaseSchema } from '../base';
import type { ExpressionWire } from '../expression';
import { BaseSchema as Mirror } from '../zod/base.zod';
import { ExpressionWireSchema } from '../zod/expression.zod';
import { FormFieldSchema, SelectOptionSchema } from '../zod/form.zod';

/* -- Type-level helpers ---------------------------------------------------- */

/** Invariant equality -- `extends` both ways would accept a narrowing. */
type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/* -- The declared type is exactly what the evaluator accepts --------------- */

/** The union all three keys carry, pinned here so the checks below cannot drift from it. */
type BasePredicate = boolean | ExpressionWire | undefined;

export type assertionVisible = Expect< Equal< BaseSchema['visible'], BasePredicate > >;
export type assertionHidden = Expect< Equal< BaseSchema['hidden'], BasePredicate > >;
export type assertionDisabled = Expect< Equal< BaseSchema['disabled'], BasePredicate > >;

/** The wire union itself, spelled out -- the name must not quietly widen. */
export type assertionWireShape = Expect<
  Equal< ExpressionWire, string | { dialect?: string; source: string } >
>;

/** The two faces of the wire type are one union. */
export type assertionTwinParity = Expect<
  Equal< ExpressionWire, z.input< typeof ExpressionWireSchema > >
>;

/** The helper can FAIL -- the old union is not the new one. */
export type assertionEqualCanFail = Expect<
  Equal< Equal< boolean | string | undefined, BasePredicate >, false >
>;

/* -- Authorable fixtures, no cast ------------------------------------------ */

/** The capability the renderer implements, now declared on each key. */
export const visibleEnvelopeIsAuthorable: BaseSchema = {
  type: 'test-component',
  visible: { dialect: 'cel', source: 'record.status == "open"' },
};
export const hiddenEnvelopeIsAuthorable: BaseSchema = {
  type: 'test-component',
  hidden: { dialect: 'cel', source: 'record.status == "draft"' },
};
export const disabledEnvelopeIsAuthorable: BaseSchema = {
  type: 'test-component',
  disabled: { dialect: 'cel', source: 'record.status == "locked"' },
};

/** `dialect` is optional on the wire -- the legacy-path envelope is authorable too. */
export const dialectlessEnvelopeIsAuthorable: BaseSchema = {
  type: 'test-component',
  visible: { source: '${data.role === "admin"}' },
};

/* -- Runtime companion (the zod mirror) ------------------------------------ */

const KEYS = ['visible', 'hidden', 'disabled'] as const;
type PredicateKey = (typeof KEYS)[number];

const CEL_ENVELOPE = { dialect: 'cel', source: 'data.status == "draft"' };
const DIALECTLESS_ENVELOPE = { source: '${data.status === "draft"}' };
const PREDICATE = '${data.status === "draft"}';

const REFUSED: Array<{ label: string; value: unknown }> = [
  { label: '{} (no source)', value: {} },
  { label: "{ dialect: 'cel' } (no source)", value: { dialect: 'cel' } },
  { label: '{ source: 123 } (source is not a string)', value: { source: 123 } },
  { label: '123 (a number)', value: 123 },
  { label: 'null', value: null },
];

/** The object arm of a key's `z.union([z.boolean(), ExpressionWireSchema]).optional()`. */
function envelopeArmOf(key: PredicateKey): unknown {
  const union = Mirror.shape[key].unwrap();
  return union.options[1];
}

describe.each(KEYS)('BaseSchema.%s declares the CEL envelope (objectui#7530)', (key) => {
  it('zod mirror: the CEL envelope parses in full', () => {
    // Full parse, not just "no unrecognized_keys": this is a judgement about
    // the VALUE, so nothing short of a green `safeParse` measures it.
    expect(Mirror.safeParse({ type: 'test-component', [key]: CEL_ENVELOPE }).success).toBe(true);
  });

  it('zod mirror: an envelope without a dialect parses too -- `dialect` is optional on the wire', () => {
    expect(Mirror.safeParse({ type: 'test-component', [key]: DIALECTLESS_ENVELOPE }).success).toBe(true);
  });

  it('zod mirror: the string and boolean forms still parse -- a widening, not a replacement', () => {
    expect(Mirror.safeParse({ type: 'test-component', [key]: PREDICATE }).success).toBe(true);
    expect(Mirror.safeParse({ type: 'test-component', [key]: true }).success).toBe(true);
    expect(Mirror.safeParse({ type: 'test-component', [key]: false }).success).toBe(true);
  });

  it.each(REFUSED)('zod mirror: $label is still refused at the key path -- the anti-overshoot guard', ({ value }) => {
    // `BaseSchema` is `.passthrough()`, but the key is DECLARED, so a
    // wrong-typed value is an error at its path rather than a passthrough.
    const result = Mirror.safeParse({ type: 'test-component', [key]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === key)).toBe(true);
    }
  });
});

describe('one envelope type across the package -- reuse pinned by reference (objectui#7530)', () => {
  it.each(KEYS)('BaseSchema.shape.%s carries ExpressionWireSchema itself, not a copy', (key) => {
    expect(envelopeArmOf(key)).toBe(ExpressionWireSchema);
  });

  it('the hoisted form legs carry the same object', () => {
    expect(FormFieldSchema.shape.visibleWhen.unwrap()).toBe(ExpressionWireSchema);
    expect(FormFieldSchema.shape.visibleOn.unwrap()).toBe(ExpressionWireSchema);
    expect(FormFieldSchema.shape.readonlyWhen.unwrap()).toBe(ExpressionWireSchema);
    expect(FormFieldSchema.shape.requiredWhen.unwrap()).toBe(ExpressionWireSchema);
    expect(SelectOptionSchema.shape.visibleWhen.unwrap()).toBe(ExpressionWireSchema);
  });

  it('... and the form leg still parses the envelope -- the hoist moved the const, not its verdict', () => {
    expect(SelectOptionSchema.safeParse({ label: 'Draft', value: 'draft', visibleWhen: CEL_ENVELOPE }).success).toBe(true);
    expect(SelectOptionSchema.safeParse({ label: 'Draft', value: 'draft', visibleWhen: PREDICATE }).success).toBe(true);
    expect(SelectOptionSchema.safeParse({ label: 'Draft', value: 'draft', visibleWhen: {} }).success).toBe(false);
  });

  it('the shared const accepts exactly the wire union', () => {
    expect(ExpressionWireSchema.safeParse(PREDICATE).success).toBe(true);
    expect(ExpressionWireSchema.safeParse(CEL_ENVELOPE).success).toBe(true);
    expect(ExpressionWireSchema.safeParse(DIALECTLESS_ENVELOPE).success).toBe(true);
    expect(ExpressionWireSchema.safeParse(true).success).toBe(false);
    expect(ExpressionWireSchema.safeParse({}).success).toBe(false);
  });

  it('type-level: the three keys and the twin parity are pinned invariantly', () => {
    // Erased at runtime; `tsc -p tsconfig.test.json` is the checker, chained
    // from this package's `type-check` script. The runtime case exists so a
    // green vitest run is not mistaken for the proof.
    expect(visibleEnvelopeIsAuthorable.visible).toEqual({ dialect: 'cel', source: 'record.status == "open"' });
    expect(hiddenEnvelopeIsAuthorable.hidden).toEqual({ dialect: 'cel', source: 'record.status == "draft"' });
    expect(disabledEnvelopeIsAuthorable.disabled).toEqual({ dialect: 'cel', source: 'record.status == "locked"' });
    expect(dialectlessEnvelopeIsAuthorable.visible).toEqual({ source: '${data.role === "admin"}' });
  });
});
