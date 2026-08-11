/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/plugin-detail` ↔ `@objectstack/spec` symbol-collision guards
 * (objectui#3161, objectstack#4115 ledger batch 7).
 *
 *  - `FeedFilterMode` was a hand copy of the spec's four-member enum under the
 *    spec's own name, in a file that already imported the sibling
 *    `FeedItemType` from the spec vocabulary. It is a re-export now, pinned
 *    below by TYPE IDENTITY (not by listing the four members again — a test
 *    that restates the copy cannot detect the copy).
 *
 *  - `ObjectFieldLike` → `ObjectDefFieldLike`. This is the case the guard's
 *    header calls "the SPEC export is the imprecise one": the spec's
 *    `ObjectFieldLike` ends in `[key: string]: any`, so deriving from it would
 *    have traded a precise three-key layout contract for a bag. The pin below
 *    states that reason as a fact, so the day the spec tightens its declaration
 *    the reason expires loudly instead of silently.
 */

import { describe, it, expect } from 'vitest';
import { FeedFilterMode as SpecFeedFilterModeEnum } from '@objectstack/spec/data';
import type { FeedFilterMode as SpecFeedFilterMode } from '@objectstack/spec/data';
import type { ObjectFieldLike as SpecObjectFieldLike } from '@objectstack/spec/system';

import type { FeedFilterMode } from '../RecordActivityTimeline';
import type { ObjectDefFieldLike } from '../synth/buildDefaultPageSchema';
import { normalizeFilterMode } from '../renderers/recordActivityFeed';

describe('FeedFilterMode is the spec enum, at runtime as well as in types', () => {
  it('accepts every member the spec declares — read from the spec, not restated', () => {
    for (const mode of SpecFeedFilterModeEnum.options) {
      expect(normalizeFilterMode(mode)).toBe(mode);
    }
  });

  it('still falls back for a value the spec does not declare', () => {
    expect(normalizeFilterMode('everything')).toBe('all');
  });
});

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off             */
/* "type-check" (objectui#4291 retired the narrow project that named this      */
/* file alone, once the package left TEST_DEBT in objectui#4040).              */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type HasKey<T, K extends string> = K extends keyof T ? true : false;

describe('the two verdicts are pinned at compile time', () => {
  it('FeedFilterMode is the spec type itself', () => {
    type _SpecIsReal = Assert<Equal<IsAny<SpecFeedFilterMode>, false>>;
    type _IsTheSpecType = Assert<Equal<FeedFilterMode, SpecFeedFilterMode>>;
    expect(true).toBe(true);
  });

  it('ObjectDefFieldLike stays local because the SPEC declaration is the loose one', () => {
    type _SpecIsReal = Assert<Equal<IsAny<SpecObjectFieldLike>, false>>;

    // The reason for the rename, as an assertion: an index signature on the
    // spec's side means `extends`-ing it would make every misspelled key legal
    // here (objectstack#4075, from the other direction). When the spec tightens
    // `ObjectFieldLike`, this line fails and the symbol is due for re-triage —
    // it may become derivable.
    type _SpecIsABag = Assert<Extends<string, keyof SpecObjectFieldLike>>;
    type _LocalIsNot = Assert<Equal<Extends<string, keyof ObjectDefFieldLike>, false>>;

    // Different subsystems, and the key sets say so: the spec's is the
    // TRANSLATABLE surface `translateObject` walks; this one is what the detail
    // synthesizer lays out with.
    type _SpecCarriesHelp = Assert<HasKey<SpecObjectFieldLike, 'help'>>;
    type _LocalCarriesGroup = Assert<HasKey<ObjectDefFieldLike, 'group'>>;
    type _LocalCarriesHidden = Assert<HasKey<ObjectDefFieldLike, 'hidden'>>;

    expect(true).toBe(true);
  });
});
