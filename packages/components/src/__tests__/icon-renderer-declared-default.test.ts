/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import '../renderers/basic/icon';

// ---------------------------------------------------------------------------
// objectui#5622 — the `ui:icon` renderer's two declared spellings must agree.
//
// Two metadata spots feed the designer: the registration's `icon` meta (the
// glyph on the palette entry) and the glyph INPUT's `defaultValue` (what an
// `icon` dropped from that palette renders before anyone types a name). The
// defect objectui#5622 repaired was ONE name in TWO places, so the repair is
// only correct if they stay one name — split them and the palette advertises a
// glyph the dropped component does not render.
//
// ⚠️ That input is keyed `icon` since objectui#5631 — it was `name` until the
// glyph key migrated off the SDUI identity key.
//
// Read off the REGISTRY rather than out of source: the registry entry is the
// artifact the designer palette actually consumes.
//
// ── The MEMBERSHIP half was retired at objectui#5936 ────────────────────────
// This file used to also assert that both spellings are live keys of lucide's
// runtime `icons` record — the objectui#5622 mechanism, where a retired name
// keeps its named export while dropping out of the record, so it imports,
// type-checks and renders as a COMPONENT while resolving to `null` as a STRING.
// That half is gone, and the reason is a measurement rather than a preference.
//
// It was KEPT at objectui#5633 (which built the repo-level gate,
// `scripts/check-lucide-icon-record-names.mjs`) on one explicit premise: that
// the palette reading this meta lives OUTSIDE this repo, so the gate had no
// measured basis to generalise the claim but a local pin could still hold it.
// objectui#5936 was filed to find that palette. It was not found — in objectui,
// in objectstack, or in cloud. The gate's own header carries the three readings,
// their controls, and the 2026-09-04 adjudication that the gate is NOT extended
// to registration `icon` meta.
//
// Given that, the membership half asserted the liveness of a string with no
// measured consumer, and it cost more than it looked:
//
//   - It guarded ONE of the 45 registrations that declare an `icon` meta, while
//     the gate is adjudicated NOT to cover the other 44. A membership check
//     over 1/45 of its own population does not manage that risk; it SIGNALS
//     that the risk is managed — and that signal is what sent objectui#5936
//     looking for a consumer this pin implied must exist.
//   - It carried a hand-copied `toPascalCase` + `iconNameMap`, annotated
//     "Copied EXACTLY — a pin that normalised names differently from the
//     consumer would answer a question nobody asks" and "module-private there".
//     objectui#5935 / PR #7491 collapsed the eight resolvers into ONE seam that
//     EXPORTS `describeIconLookup`/`resolveIcon` and tokenises on
//     `/[-_\s]+/`. This copy still said `split('-')`. Both halves of its own
//     stated correctness condition had gone stale inside one round, and nothing
//     went red — which is what a pin over a surface with no consumer does.
//   - Measured at the retirement: all 45 declared registration `icon` metas are
//     live on BOTH lucide surfaces, so no red was dropped by removing it.
//
// ⛔ The published `ComponentMeta.icon` key itself (`packages/types/src/base.ts`)
// is UNTOUCHED — removing a published capability is a maintainer decision and
// was fenced out of objectui#5936. What retired here is a TEST claim about it.
// If an actual reader of this meta is ever found, in any repo, the answer is to
// extend the gate to the whole population — ⛔ not to restore a pin over one
// registration.
//
// ── What this file still asserts, and why that half survives the same argument
// The coupling claim below is NOT a claim about lucide's vocabulary. It needs no
// external record, no copied tokeniser and no consumer to be well-formed: it
// says two declarations in ONE registration agree with each other. It therefore
// cannot drift the way the membership half did, costs nothing to keep, and
// becomes correct the instant any consumer appears.
// ---------------------------------------------------------------------------

const meta = ComponentRegistry.getMeta('icon', 'ui');
const glyphInput = meta?.inputs?.find(input => input.name === 'icon');

/** Both declared spellings, each labelled by the surface it drives. */
const DECLARED_DEFAULTS: Array<[string, string | undefined]> = [
  ['registration `icon` (the palette entry glyph)', meta?.icon],
  ['`icon` input `defaultValue` (what a dropped `icon` renders)', glyphInput?.defaultValue as string | undefined],
];

describe('the `ui:icon` renderer\'s declared spellings agree (objectui#5622)', () => {
  it('both declared spellings were actually found — the precondition', () => {
    // Load-bearing, not ceremony: the assertion below compares two values that
    // are BOTH `undefined` if the registry read comes back empty, and
    // `undefined === undefined` passes. Without this the coupling check goes
    // vacuously green on a registration that no longer exists.
    expect(meta, '`ui:icon` is not registered — the import above no longer registers it.').toBeDefined();
    expect(
      glyphInput,
      'the `icon` input is gone from the `ui:icon` registration — fix the reader or the registration.',
    ).toBeDefined();
    for (const [surface, spelling] of DECLARED_DEFAULTS) {
      expect(typeof spelling, `${surface} declares no icon name at all`).toBe('string');
    }
  });

  it('keeps the palette glyph and the dropped default the same name', () => {
    // The defect was one name in two places; the repair is only correct if they
    // stay one name. Split them and the palette advertises a glyph the dropped
    // component does not render.
    expect(meta?.icon).toBe(glyphInput?.defaultValue);
  });
});
