// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The node recursion point resolves per-type, at every depth (objectui#8344).
 *
 * ## What was wrong
 *
 * Every child slot (`body`, `children`, and every per-component redeclaration of
 * them) is `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`, and
 * `SchemaNodeSchema`'s component arm was `BaseSchemaCore` — the ~21 base keys and
 * NOTHING type-specific. ⇒ per-type enforcement was ROOT-ONLY, at every depth, for
 * every component type. objectui#7869 recorded it as an ASYMMETRY, measured there:
 * an off-spec node was refused standing alone and ACCEPTED one slot down, inside
 * any parent. #8344 points the arm at `AnyComponentSchema` instead.
 *
 * ## What this file pins, and why each leg is here
 *
 * The headline is one behaviour — "the same node gets the same verdict at every
 * depth" — and a single assertion cannot state it, because BOTH halves of an
 * asymmetry have to be read to say the asymmetry is gone. So #7869's reproduction
 * is pinned in both directions (refused alone AND refused nested), against a
 * NON-VACUITY leg (the legal twin of the same node, accepted at both depths) that
 * would catch the way this could pass while being broken — a recursion point that
 * refuses everything reads as a fixed asymmetry and is a dead contract.
 *
 * The fourth leg is what makes it a test of the REDIRECT rather than of `icon`:
 * a node whose `type` resolves in no arm of `AnyComponentSchema`. `BaseSchemaCore`
 * accepts any object with a string `type`, so that node is the one input the two
 * candidate recursion points disagree about MOST — it separates "the arm is the
 * component union" from "the arm is the base shape" without reading a single zod
 * internal.
 *
 * ⚠️ Recognising the recursion point by IDENTITY is pinned on the EXPORTED WRAPPER,
 * ⛔ never through `.unwrap()` or a re-invoked `z.lazy` getter. That is objectui#7918
 * consequence ①: the exported wrapper identity is stable and survives through a
 * declared slot, and it is the ONE reading that holds for all ten recursive mirrors.
 *
 * ⚠️ ⛔ Do not read that as "`unwrap()` and the getter are unstable HERE". On `main` they are
 * — measured on the built face, `S.unwrap() === S.unwrap()` and `getter() === getter()` are
 * both FALSE. On THIS head both are TRUE for this one const, because the redirect builds the
 * node union once below `BaseSchemaCore` and the getter returns it: the row moves to
 * `MEMOISED` in `zod-lazy-getter-identity-7918.test.ts`, as a byproduct rather than a goal.
 * The `fill is LIVE` leg below works BECAUSE of that.
 *
 * ⇒ the discipline stands unchanged and for an unchanged reason: it must hold for
 * the seven mirrors that are still TDZ_BOUND, so a pin written through `.unwrap()`
 * or a re-invoked getter would compare two fresh objects THERE and fail for a
 * reason that has nothing to do with this contract. Pinning the wrapper is what
 * makes this file portable to them; it is not a claim about this const's getter.
 */

import { describe, it, expect } from 'vitest';

import { AnyComponentSchema, CardSchema, IconSchema, SchemaNodeSchema, safeValidateSchema } from '../zod/index.zod.js';
import type { SchemaNode } from '../base.js';
import type { z } from 'zod';

type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/**
 * #7869's own node, in the spelling `IconSchema` declares: `ui:icon` names its
 * glyph with `icon` and sizes it with a NUMBER, so `size: 'huge'` is off-spec by
 * value and `size: 24` is the legal twin of the same node.
 */
const OFF_SPEC_ICON = { type: 'icon', icon: 'check', size: 'huge' } as const;
const LEGAL_ICON = { type: 'icon', icon: 'check', size: 24 } as const;

/** The same node one slot down — the depth #7869 measured as the shielded one. */
const nested = (child: unknown) => ({ type: 'card', title: 'Parent', body: [child] });

describe('objectui#7869 — the off-spec node gets the same verdict at both depths', () => {
  it('is refused STANDING ALONE (unchanged — this half was never the defect)', () => {
    expect(AnyComponentSchema.safeParse(OFF_SPEC_ICON).success).toBe(false);
  });

  it('is refused NESTED — the half objectui#8344 moved', () => {
    expect(AnyComponentSchema.safeParse(nested(OFF_SPEC_ICON)).success).toBe(false);
  });

  it('names the offending VALUE, not merely "some arm did not match"', () => {
    // A recursion point that refused the child for the wrong reason — because the
    // parent no longer matches any arm at all, say — would satisfy the two legs
    // above while saying nothing about the child. Read the leaf issue.
    const result = IconSchema.safeParse(OFF_SPEC_ICON);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join('.') === 'size' && i.code === 'invalid_type')).toBe(true);
  });

  it('NON-VACUITY: the legal twin is accepted at BOTH depths', () => {
    // Without this leg, a recursion point that refuses everything passes the two
    // legs above. It is the assertion that says the redirect narrowed rather than
    // closed the slot.
    expect(AnyComponentSchema.safeParse(LEGAL_ICON).success).toBe(true);
    expect(AnyComponentSchema.safeParse(nested(LEGAL_ICON)).success).toBe(true);
  });
});

describe('the arm IS the component union, and not the base shape', () => {
  /**
   * A REGISTERED RENDERER with no mirror in `AnyComponentSchema` — the input the
   * two candidate recursion points answer differently: `BaseSchemaCore` takes any
   * object with a string `type`, the component union takes none it does not
   * declare.
   *
   * ⚠️ This was `h1` until objectui#8499. That card was the one objectui#8344
   * routed the widening into, and it LANDED: `h1` is now an arm
   * (`zod/layout.zod.ts#HtmlElementSchema`), so the old example stopped
   * discriminating and this leg went green for the wrong reason. ⛔ The remedy was
   * NOT to weaken the leg — it is re-pointed at an input whose absence from the
   * union is RULED rather than merely pending: `metric-card` is objectui's closed
   * dashboard-widget-slot component extension, admitted by the 2026-08-14 ruling
   * (objectstack#8593) and, in `zod/complex.zod.ts`'s own words, "DELIBERATELY not
   * an arm of `AnyComponentSchema`". So this example cannot rot the way `h1` did
   * without a maintainer reversing that ruling.
   *
   * ⛔ Do not "fix" a future failure here by adding an arm to make some other test
   * green: an arm is a public-surface widening and belongs to its own card, which
   * is what objectui#8344 said and what objectui#8499 then did properly.
   */
  const UNMIRRORED = { type: 'metric-card', title: 'Sales Dashboard' } as const;

  it('refuses an unmirrored node nested in a declared child slot', () => {
    expect(AnyComponentSchema.safeParse(nested(UNMIRRORED)).success).toBe(false);
  });

  it('refuses the same node standing alone (the control — this was already true)', () => {
    expect(AnyComponentSchema.safeParse(UNMIRRORED).success).toBe(false);
  });
});

describe('the late-binding wiring, read by IDENTITY on the exported wrapper', () => {
  it('the exported wrapper is one stable object', () => {
    // objectui#7918 consequence ①: the EXPORTED wrapper is the stable handle, and it is the
    // one reading that holds for all ten recursive mirrors. ⛔ Never write this pin through
    // `.unwrap()` or a re-invoked getter — on the seven mirrors that are still `TDZ_BOUND`
    // those return a fresh object per call, and a pin written through them would compare two
    // fresh objects and fail for a reason that has nothing to do with this contract.
    expect(SchemaNodeSchema).toBe(SchemaNodeSchema);
  });

  it('that identity survives through a declared child slot', () => {
    const body = (CardSchema.shape.body as unknown as { _zod: { def: { innerType: { _zod: { def: { options: unknown[] } } } } } });
    expect(body._zod.def.innerType._zod.def.options).toContain(SchemaNodeSchema);
  });

  it('the holder is FILLED by importing the barrel — the module-cycle break works', () => {
    // The behavioural read of the fill, and the only one that cannot pass vacuously: BEFORE
    // the fill the arm is `BaseSchemaCore`, which accepts the unmirrored node below. This
    // module imports the barrel and nothing else, so a break in `index.zod.ts`'s
    // `defineNodeComponentUnion(...)` initializer lands here rather than in whichever suite
    // happened to run second.
    expect(AnyComponentSchema.safeParse(nested({ type: 'metric-card' })).success).toBe(false);
    expect(AnyComponentSchema.safeParse(nested(LEGAL_ICON)).success).toBe(true);
  });

  it('the fill is LIVE, and slot 0 holds the WRAPPED union, not the bare one', () => {
    // `z.union` re-reads its option array on every parse, so the recursion point is whatever
    // slot 0 holds NOW — not whatever it held when some other file in this worker first
    // parsed something (the unit project runs `isolate: false`, one module graph per worker).
    // ⛔ Do not assert `toBe(AnyComponentSchema)` here: what is installed is deliberately the
    // `superRefine` WRAPPER that keeps the `chatbot` arm from widening the node slot, and a
    // pin on the bare union would go green the moment that narrowing was dropped.
    const arm = (SchemaNodeSchema as unknown as {
      _zod: { def: { getter: () => { _zod: { def: { options: readonly { _zod: { propValues?: Record< string, unknown >; def: { checks?: unknown[] } } }[] } } } } };
    })._zod.def.getter()._zod.def.options[0];
    expect(arm).not.toBe(AnyComponentSchema);
    // it is still the discriminated union objectui#8498 built — the discrimination survives
    // the wrapper, which is what keeps a nested refusal costing one arm instead of 106 —
    expect(Object.keys(arm._zod.propValues ?? {})).toContain('type');
    // and it carries exactly the one check that narrowing adds.
    expect(arm._zod.def.checks).toHaveLength(1);
  });

});

/**
 * The EXACT bound on the one assertion `base.zod.ts` needs to make.
 *
 * `SchemaNodeSchema` keeps its objectui#7760 annotation `z.ZodType< SchemaNode,
 * SchemaNode >`, and `z.output< typeof AnyComponentSchema >` is not assignable to
 * `SchemaNode` for exactly ONE of its 106 arms: `complex.zod.ts#ChatbotSchema`
 * mirrors the chat API body params under the key `body`, which is `BaseSchema`'s
 * CHILDREN slot. That collision is pre-existing (the parity ledger carries it under
 * `KnownDrift`, the TS declaration renamed the key to `requestBody`, and
 * `ChatbotSharedMirrorShape` says a ruling on `ChatbotSchema`'s own `body` arm is a
 * separate question), and objectui#8344 does not decide it.
 *
 * ⇒ the fill site takes a loose bound and this states the real one instead. A SECOND
 * arm drifting the same way turns this red — where a wide bound would have said
 * nothing. ⛔ Do not repair a red here by adding the new name to the union below:
 * that records a second declaration defect as if it were a contract.
 */
type ArmsNotAssignableToSchemaNode =
  Exclude< z.output< typeof AnyComponentSchema >, SchemaNode > extends { type: infer K } ? K : never;

export type NodeRecursionPointDeclarationDrift = [
  Expect< Equal< ArmsNotAssignableToSchemaNode, 'chatbot' > >,
];


/**
 * The one arm the redirect would have WIDENED, narrowed on the arm itself.
 *
 * `ChatbotSchema.body` mirrors the chat API's body params as a record — the only wider
 * redeclaration among the 109 base-key redeclarations across the union's arms. Without the
 * `superRefine` on the installed arm the redirect would narrow at 108 slots and widen at
 * this one, which is what the card's appetite forbids in as many words.
 *
 * ⛔ Both directions are load-bearing, and a fix that only satisfies the first is the
 * failure this pin exists to catch: narrowing the ROOT mirror would also refuse the nested
 * node, and it would be a change to a published face this card does not own.
 */
describe('objectui#8344 — the `chatbot` record `body` is refused NESTED and still accepted at the ROOT', () => {
  const CHATBOT = {
    type: 'chatbot',
    messages: [{ id: '1', role: 'assistant', content: 'hi' }],
  } as const;
  const withRecordBody = { ...CHATBOT, body: { model: 'gpt-4', temperature: 0.2 } };

  it('is REFUSED one slot down, where the base arm refused it before this card', () => {
    expect(AnyComponentSchema.safeParse(nested(withRecordBody)).success).toBe(false);
    expect(AnyComponentSchema.safeParse({ type: 'div', children: [withRecordBody] }).success).toBe(false);
  });

  it('is still ACCEPTED at the ROOT — the published mirror is untouched', () => {
    expect(AnyComponentSchema.safeParse(withRecordBody).success).toBe(true);
  });

  it('NON-VACUITY: the same node without `body` is accepted at both depths', () => {
    expect(AnyComponentSchema.safeParse(CHATBOT).success).toBe(true);
    expect(AnyComponentSchema.safeParse(nested(CHATBOT)).success).toBe(true);
  });

  it('names `body` in the refusal, so the author is told which key is wrong', () => {
    const result = AnyComponentSchema.safeParse(nested(withRecordBody));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain('"body"');
  });
});

/**
 * Depth on the REDIRECTED path, which objectui#8544 could not pin.
 *
 * That card's fan-out pin is built on `MenuItemSchema` because, on its tree, a nested
 * document was simply ACCEPTED — the recursion point had not moved yet. Here it is refused,
 * so this is the first pin that exercises a refusal at depth through the node union.
 *
 * ⛔ The number that matters is not the exact length, it is that the message stays LINEAR.
 * Before objectui#8498 the refused subtree was re-embedded per level by a flat 106-arm
 * union and grew about 25x per level, reaching `RangeError: Invalid string length` at depth
 * 4; discriminating selects one arm, so each level adds a bounded frame. A ceiling well
 * under the old growth is therefore the honest assertion: a regression that restores the
 * fan-out blows through it, while ordinary wording changes do not.
 */
describe('objectui#8344 + objectui#8498 — a refusal at depth 4 stays bounded and never throws', () => {
  const deep = (levels: number): unknown =>
    levels === 0
      ? { type: 'badge', variant: 'not-a-variant' }
      : { type: 'card', title: 'p', body: [deep(levels - 1)] };

  it('refuses at every depth 0 through 4 without throwing', () => {
    for (const depth of [0, 1, 2, 3, 4]) {
      const result = safeValidateSchema(deep(depth));
      expect(result.success).toBe(false);
    }
  });

  it('keeps the depth-4 diagnostic linear, not exponential', () => {
    const result = safeValidateSchema(deep(4));
    expect(result.success).toBe(false);
    if (result.success) return;
    // Measured on this head: 276 / 3,626 / 8,404 / 14,610 / 22,244 chars at depths 0-4.
    // The pre-objectui#8498 shape reached 428,269,086 chars at depth 3 and threw at 4.
    expect(result.error.message.length).toBeLessThan(200_000);
  });

  it('NON-VACUITY: the same shape with a LEGAL leaf is accepted at depth 4', () => {
    const legal = (levels: number): unknown =>
      levels === 0
        ? { type: 'badge', variant: 'default' }
        : { type: 'card', title: 'p', body: [legal(levels - 1)] };
    expect(safeValidateSchema(legal(4)).success).toBe(true);
  });
});
