/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { rowHeightToDensityMode, type DensityMode } from '@object-ui/core';
import { SpecBridge } from '../SpecBridge';

/**
 * The agreement pin for objectui#4440.
 *
 * Two surfaces narrow a list view's `rowHeight` onto the renderer's three-step
 * density vocabulary, and for a while they answered differently for the same
 * off-spec input: `@object-ui/core`'s `rowHeightToDensityMode` coerced anything
 * unknown to `'comfortable'`, while this package's `mapDensity` — after #4352
 * (PR #4439) — declined to answer at all. One metadata-driven system, two
 * answers for one input. #4440 retired the coercion; this test is what stops
 * the disagreement regrowing silently on either side.
 *
 * It lives HERE, not in `@object-ui/core`, because the dependency direction
 * decides: `@object-ui/react` depends on `@object-ui/core`, so this package can
 * see both surfaces, and core cannot import react without inverting the graph.
 * The pin therefore imports core's function by its PUBLISHED specifier
 * (`@object-ui/core`, a declared dependency of this package) and reaches the
 * bridge through `SpecBridge.transformListView`, whose parameter is `any` —
 * the untyped boundary a host's stored JSON actually crosses, and after #4352
 * the only way an off-spec `rowHeight` can enter the bridge at all.
 */

/** What the bridge answers for a `rowHeight`, in core's return shape. */
function bridgeDensityFor(rowHeight: unknown): DensityMode | undefined {
  const node = new SpecBridge().transformListView({
    name: 'row_height_agreement',
    rowHeight,
  });
  // The bridge writes the key only when it has an answer, so an absent key and
  // an explicit `undefined` are the same statement: "no density, use yours".
  return 'density' in node ? (node.density as DensityMode | undefined) : undefined;
}

describe('rowHeight → density: core and the spec bridge give one answer (#4440)', () => {
  describe('the five spec row heights — controls, green on both sides', () => {
    it.each([
      ['compact', 'compact'],
      ['short', 'compact'],
      ['medium', 'comfortable'],
      ['tall', 'spacious'],
      ['extra_tall', 'spacious'],
    ] as const)('both surfaces map %s to %s', (rowHeight, expected) => {
      expect(rowHeightToDensityMode(rowHeight)).toBe(expected);
      expect(bridgeDensityFor(rowHeight)).toBe(expected);
    });
  });

  describe('off-spec row heights — both abstain', () => {
    // `comfortable` / `spacious` / `small` / `large` are the four spellings
    // #4352 deleted from the bridge; `gargantuan` is a string in neither
    // vocabulary. Before #4440 core answered `'comfortable'` for every one of
    // them while the bridge answered nothing.
    it.each(['comfortable', 'spacious', 'small', 'large', 'gargantuan'])(
      'neither surface invents a density for the off-spec rowHeight %s',
      (rowHeight) => {
        expect(rowHeightToDensityMode(rowHeight)).toBeUndefined();
        expect(bridgeDensityFor(rowHeight)).toBeUndefined();
      },
    );

    // NOT pinned here, deliberately: `Object.prototype` member names
    // (`toString`, `constructor`, …). Core abstains for them since #4440, but
    // the bridge still indexes its table with an unguarded key and hands back
    // `Object.prototype.toString` — a FUNCTION — as the density. That is a
    // different defect from the coercion this file is about, it lives in source
    // outside #4440's surface, and it is filed as #4442. Extending the two
    // `it.each` lists above with those keys is the assertion that fails until
    // #4442 lands, and is the natural test half of its fix.

    it('agrees for every off-spec input without either side being read first', () => {
      // Same assertion phrased as the invariant itself: whatever the answer is,
      // it is ONE answer. A future edit that re-adds a fallback to either
      // surface breaks this even if it re-adds it to both differently.
      for (const rowHeight of ['comfortable', 'spacious', 'small', 'large', 'gargantuan', '']) {
        expect(rowHeightToDensityMode(rowHeight)).toBe(bridgeDensityFor(rowHeight));
      }
    });
  });
});
