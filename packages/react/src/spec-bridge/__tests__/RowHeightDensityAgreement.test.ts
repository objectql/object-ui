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

/**
 * The third off-spec family (#4459) — values that are not strings at all.
 *
 * The first two families are both strings, so for a while the invariant this
 * file's title claims ("core and the spec bridge give one answer") was strictly
 * broader than the invariant it pinned. A JSON-authored view can hold an array
 * or an object at `rowHeight` just as easily as a bad string, and until #4459
 * the two surfaces disagreed on exactly that: core opens with a TYPE guard
 * (`typeof rowHeight !== 'string'`), the bridge opened with a TRUTHINESS guard,
 * so every truthy non-string walked past it and was then coerced to a key —
 * `hasOwnProperty.call` and the index both run `String(...)`.
 *
 * Split into two groups on purpose, because they fail differently:
 *
 * - **coercing** — their string form IS one of the five spec keys, so the
 *   bridge answered `'compact'`: a density fabricated from an array. This is
 *   the quieter half of #4442's defect. A leaked function is visibly wrong to
 *   everything downstream; a fabricated `'compact'` is a perfectly legitimate
 *   value that nothing can tell apart from an authored one.
 * - **non-coercing** — truthy non-strings whose string form is not a key
 *   (`'42'`, `'true'`), plus the falsy values the truthiness guard used to be
 *   there for. These already abstained. They are pinned anyway because #4459
 *   REPLACES that guard rather than adding to it: the type guard has to keep
 *   catching everything the truthiness guard caught, and this is the row that
 *   says so.
 */
const NON_STRING_ROW_HEIGHTS: ReadonlyArray<readonly [string, unknown]> = [
  // Coercing: String(…) lands on a real spec key.
  ["the array ['compact']", ['compact']],
  ['the boxed String(compact)', new String('compact')],
  ['an object whose toString() returns compact', { toString: () => 'compact' }],
  // Non-coercing truthy non-strings.
  ['the number 42', 42],
  ['the boolean true', true],
  // Falsy — what the retired truthiness guard existed to catch.
  ['the number 0', 0],
  ['the boolean false', false],
  ['null', null],
  ['undefined', undefined],
];

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
    // Two families of off-spec spelling, both pinned here.
    //
    // `comfortable` / `spacious` / `small` / `large` are the four spellings
    // #4352 deleted from the bridge; `gargantuan` is a string in neither
    // vocabulary. Before #4440 core answered `'comfortable'` for every one of
    // them while the bridge answered nothing.
    //
    // The `Object.prototype` member names are the second family (#4442). Both
    // lookup tables are plain object literals, so indexing one with an
    // unguarded key reaches the prototype: `rowHeight: 'toString'` used to come
    // back as `Object.prototype.toString` — a FUNCTION — from a read whose
    // return type is three strings or nothing. Core closed that hole with
    // `hasOwnProperty` in #4440, the bridge in #4442; these rows are what keeps
    // either side from regrowing it.
    it.each([
      'comfortable',
      'spacious',
      'small',
      'large',
      'gargantuan',
      'toString',
      'constructor',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ])('neither surface invents a density for the off-spec rowHeight %s', (rowHeight) => {
      expect(rowHeightToDensityMode(rowHeight)).toBeUndefined();
      expect(bridgeDensityFor(rowHeight)).toBeUndefined();
    });

    it('never writes a function into the SchemaNode density (#4442)', () => {
      // The expression #4442 measured, read straight off the node instead of
      // through the helper above. It is worth stating separately because the
      // leak was not in the lookup alone: `bridgeListView` writes the key under
      // `if (density)`, and a function is truthy — so the bad value was not
      // merely returned, it was STORED on a SchemaNode whose renderer expects
      // `'compact' | 'comfortable' | 'spacious'`.
      const node = new SpecBridge().transformListView({ name: 'x', rowHeight: 'toString' });
      expect(node.density).toBeUndefined();
      expect(typeof node.density).not.toBe('function');
    });

    it('agrees for every off-spec input without either side being read first', () => {
      // Same assertion phrased as the invariant itself: whatever the answer is,
      // it is ONE answer. A future edit that re-adds a fallback to either
      // surface breaks this even if it re-adds it to both differently.
      const offSpec: unknown[] = [
        'comfortable',
        'spacious',
        'small',
        'large',
        'gargantuan',
        '',
        'toString',
        'constructor',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
        // #4459 — the non-string family, run through the same invariant. This
        // is the assertion the truthiness guard actually broke.
        ...NON_STRING_ROW_HEIGHTS.map(([, value]) => value),
      ];
      for (const rowHeight of offSpec) {
        expect(rowHeightToDensityMode(rowHeight)).toBe(bridgeDensityFor(rowHeight));
      }
    });
  });

  describe('non-string row heights — both abstain (#4459)', () => {
    it.each(NON_STRING_ROW_HEIGHTS)(
      'neither surface invents a density for %s',
      (_label, rowHeight) => {
        expect(rowHeightToDensityMode(rowHeight)).toBeUndefined();
        expect(bridgeDensityFor(rowHeight)).toBeUndefined();
      },
    );

    it.each(NON_STRING_ROW_HEIGHTS)(
      'never writes a density fabricated from %s onto the SchemaNode',
      (_label, rowHeight) => {
        // The boundary expression #4459 measured, read straight off the node
        // rather than through the helper — the same reason #4442 states one
        // separately. `bridgeListView` writes the key under `if (density)`, so
        // a fabricated `'compact'` is not merely returned, it is STORED, and
        // downstream it is indistinguishable from an authored density.
        const node = new SpecBridge().transformListView({ name: 'x', rowHeight });
        expect(node.density).toBeUndefined();
      },
    );

    it('abstains on the empty string by a different route, same answer', () => {
      // `''` is the one input whose HANDLING changes without its ANSWER
      // changing, so it is worth stating on its own. Before #4459 it was caught
      // by the truthiness guard (`''` is falsy) and never reached the table;
      // after, it is a string, so it passes the type guard and is refused one
      // line later by `hasOwnProperty` — `''` is not one of the five keys.
      // Both routes end in `undefined`, and core has always agreed.
      expect(bridgeDensityFor('')).toBeUndefined();
      expect(rowHeightToDensityMode('')).toBeUndefined();
      expect(
        new SpecBridge().transformListView({ name: 'x', rowHeight: '' }).density,
      ).toBeUndefined();
    });
  });
});
