// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#6071 — an exclusion reason that claims "no renderer" must be TRUE.
 *
 * ## The drift this closes
 *
 * `PALETTE_EXCLUSIONS` was made an explicit ledger (#2943) so a palette
 * decision is recorded where the next reader will find it. `block-config.
 * test.ts` enforces that every exclusion CARRIES a reason (`reason.length >
 * 10`); nothing enforced that the reason is TRUE. Two of them drifted: the
 * entries for `element:text_input` and `element:record_picker` opened with "no
 * renderer" while both types have had a registered renderer under
 * `namespace: 'element'` all along. The cost is not cosmetic — the ledger is
 * read as the decision record, and #5837 had to re-derive registration state
 * from source precisely because the stated reason could not be trusted.
 *
 * Correcting the two strings fixes today's text. This file pins the CLASS, so
 * the next "no renderer" written over a type that has one fails here instead of
 * being believed for another release.
 *
 * ## Why the assertion is shaped this way
 *
 * The interesting direction is cheap to get wrong. Three hazards, each with its
 * own guard below:
 *
 *  1. **A degenerate (empty) registry passes every negative assertion.** If the
 *     renderer packages were never imported, `ComponentRegistry.get(...)` is
 *     `undefined` for EVERYTHING and "no exclusion claiming no-renderer has a
 *     renderer" holds vacuously — a green that measures nothing. So each
 *     side-effect import below carries a POSITIVE probe proving that package's
 *     registrations actually ran (the same discipline `palette-discussion-
 *     alias.test.tsx` states in its own header: every negative pin carries its
 *     positive half).
 *  2. **A vacuous loop.** If someone reworded every reason so none claims "no
 *     renderer" any more, the class assertion would iterate over nothing and
 *     stay green while the guard silently stopped guarding. `the ledger still
 *     contains a no-renderer claim to check` fails in that case.
 *  3. **Scope is bounded by the import set.** A renderer registered in a
 *     package NOT imported here reads as unregistered, which would let a false
 *     "no renderer" pass. The imports below are therefore the packages that
 *     could plausibly register a page block for the excluded types
 *     (`@object-ui/components` for `element:*`, `@object-ui/plugin-chatbot` for
 *     the AI surface, `@object-ui/plugin-form` for the form family). Widen the
 *     set — and its positive probes — when a new package starts registering
 *     page blocks.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
// Side-effect imports: these register the components under test. The app-shell
// test setup does not pull them in, and relying on another suite having
// imported one first would make this file order-dependent.
import '@object-ui/components';
import '@object-ui/plugin-chatbot';
import '@object-ui/plugin-form';
import { PALETTE_EXCLUSIONS } from '../block-types';

/**
 * A reason "claims no renderer" when its text says the type has none —
 * `no renderer`, `no inline renderer`, `has no renderer`. Deliberately loose on
 * the qualifier and anchored on the noun, so a reworded claim is still caught.
 */
const CLAIMS_NO_RENDERER = /\bno\s+(?:\w+\s+){0,2}renderer\b/i;

const claimingNoRenderer = Object.entries(PALETTE_EXCLUSIONS).filter(([, reason]) =>
  CLAIMS_NO_RENDERER.test(reason),
);

describe('objectui#6071 — PALETTE_EXCLUSIONS reasons that claim "no renderer"', () => {
  it('the registry under test is actually populated (guards a vacuous green)', () => {
    // One probe per side-effect import above. If any of these is falsy the
    // negative assertion below proves nothing, so it must fail LOUDLY here
    // rather than passing quietly there.
    expect(
      ComponentRegistry.get('element:text'),
      '@object-ui/components did not register — every "not registered" check below would pass vacuously',
    ).toBeTruthy();
    expect(
      ComponentRegistry.get('chatbot'),
      '@object-ui/plugin-chatbot did not register — the AI surface is not actually covered',
    ).toBeTruthy();
    expect(
      ComponentRegistry.get('object-form'),
      '@object-ui/plugin-form did not register — the form family is not actually covered',
    ).toBeTruthy();
  });

  it('the ledger still contains a no-renderer claim to check (guards a vacuous loop)', () => {
    // If this fails, every reason was reworded away from the claim. That may be
    // fine — but then this file is no longer guarding anything, and that should
    // be a decision rather than a silent green.
    expect(
      claimingNoRenderer.map(([type]) => type),
      'no exclusion claims "no renderer" any more — this guard has nothing left to check',
    ).not.toEqual([]);
  });

  it('no exclusion whose reason claims "no renderer" actually has one', () => {
    for (const [type, reason] of claimingNoRenderer) {
      // `register(type, c, { namespace: n })` writes the map key `n:type`, and
      // `get(type)` with no namespace argument looks up that literal key
      // (core/src/registry/Registry.ts) — so this is the same question the
      // reason string is answering, asked of the runtime registry.
      expect(
        ComponentRegistry.get(type),
        `PALETTE_EXCLUSIONS['${type}'] says ${JSON.stringify(reason)}, but a renderer IS registered for it. ` +
          'The exclusion may well still be right — reword the reason to the real rationale (as #6071 did for ' +
          '`element:text_input` and `element:record_picker`) instead of claiming a renderer status that is false.',
      ).toBeFalsy();
    }
  });

  it('the two corrected entries do have renderers, which is what makes their new wording true', () => {
    // The other direction of the same fact. Their reasons now say they RENDER
    // but are not page content; if a later change unregistered them, that text
    // would be false in the opposite direction and this catches it.
    for (const type of ['element:text_input', 'element:record_picker']) {
      expect(
        ComponentRegistry.get(type),
        `${type} is no longer registered — its exclusion reason says it renders`,
      ).toBeTruthy();
      expect(PALETTE_EXCLUSIONS[type], `${type} must stay excluded — #6071 changed text, not decisions`).toBeTruthy();
    }
  });
});
