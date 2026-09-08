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
 * ⚠️ ⛔ Do not read that as "`unwrap()` and the getter are unstable HERE". On `main`
 * they are — measured on the built face, `S.unwrap() === S.unwrap()` and
 * `getter() === getter()` are both FALSE. On THIS head both are TRUE for this one
 * const, because the redirect moved `SchemaNodeSchema` from `TDZ_BOUND` to
 * `MEMOISED` (the byproduct ledgered in `zod-lazy-getter-identity-7918.test.ts`):
 * the getter no longer BUILDS a union, it returns the one live `nodeUnion`, and
 * `.unwrap()` resolves to that same object. The `fill is LIVE` leg below works
 * BECAUSE of that.
 *
 * ⇒ the discipline stands unchanged and for an unchanged reason: it must hold for
 * the seven mirrors that are still TDZ_BOUND, so a pin written through `.unwrap()`
 * or a re-invoked getter would compare two fresh objects THERE and fail for a
 * reason that has nothing to do with this contract. Pinning the wrapper is what
 * makes this file portable to them; it is not a claim about this const's getter.
 */

import { describe, it, expect } from 'vitest';

import { AnyComponentSchema, CardSchema, IconSchema, SchemaNodeSchema } from '../zod/index.zod.js';
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
   * `h1` is a REGISTERED RENDERER (`components/src/renderers/basic/html-elements.tsx`)
   * with no mirror in `AnyComponentSchema` — so it is the input the two candidate
   * recursion points answer differently: `BaseSchemaCore` takes any object with a
   * string `type`, the component union takes none it does not declare. ⛔ Do not
   * "fix" this by adding an `h1` arm to make some other test green: that is the
   * public-surface widening objectui#8344 routes into its own card.
   */
  const UNMIRRORED = { type: 'h1', children: 'Sales Dashboard' } as const;

  it('refuses an unmirrored node nested in a declared child slot', () => {
    expect(AnyComponentSchema.safeParse(nested(UNMIRRORED)).success).toBe(false);
  });

  it('refuses the same node standing alone (the control — this was already true)', () => {
    expect(AnyComponentSchema.safeParse(UNMIRRORED).success).toBe(false);
  });
});

describe('the late-binding wiring, read by IDENTITY on the exported wrapper', () => {
  it('the exported wrapper is one stable object', () => {
    // objectui#7918 consequence ①: this holds while `.unwrap()` and the `z.lazy`
    // getter each return a FRESH object per call. ⛔ Never write this pin through
    // either of those.
    expect(SchemaNodeSchema).toBe(SchemaNodeSchema);
  });

  it('that identity survives through a declared child slot', () => {
    const body = (CardSchema.shape.body as unknown as { _zod: { def: { innerType: { _zod: { def: { options: unknown[] } } } } } });
    expect(body._zod.def.innerType._zod.def.options).toContain(SchemaNodeSchema);
  });

  it('the holder is FILLED by importing the barrel — the module-cycle break works', () => {
    // The behavioural read of the fill, and the only one that cannot pass
    // vacuously: BEFORE the fill the arm is `BaseSchemaCore`, which accepts the
    // unmirrored node above. This module imports the barrel and nothing else, so a
    // break in `index.zod.ts`'s `defineNodeComponentUnion(...)` initializer lands
    // here rather than in whichever suite happened to run second.
    expect(AnyComponentSchema.safeParse(nested({ type: 'h1' })).success).toBe(false);
    expect(AnyComponentSchema.safeParse(nested(LEGAL_ICON)).success).toBe(true);
  });

  it('the fill is LIVE, so no earlier parse can freeze the pre-fill answer in', () => {
    // The property that makes this whole file order-independent, asserted rather
    // than assumed. `z.union` re-reads its option array on every parse, so the
    // recursion point is whatever slot 0 holds NOW — not whatever it held when some
    // other file in this worker first parsed something (the unit project runs
    // `isolate: false`, one module graph per worker). Measured the hard way: with a
    // memoising `z.lazy` holder in place instead, this suite passed run alone and
    // failed in the full run. ⛔ Do not "simplify" the wiring back to a holder the
    // getter reads — re-read `defineNodeComponentUnion` in `base.zod.ts` first.
    const options = (SchemaNodeSchema as unknown as {
      _zod: { def: { getter: () => { _zod: { def: { options: readonly unknown[] } } } } };
    })._zod.def.getter()._zod.def.options;
    expect(options[0]).toBe(AnyComponentSchema);
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
