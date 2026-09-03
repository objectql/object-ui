/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5935 — the ONE icon-name seam.
 *
 * Seven modules used to resolve authored icon names, with THREE tokenisers
 * (`split('-')` on five, `split(/[-_\s]/)` on one, `split(/[-_\s]+/)` on one)
 * and the `Home -> House` rename on only four, so the same authored name
 * rendered on one surface and not another. This file pins what the surviving
 * one does.
 *
 * ## What is being proved, and what could not be proved by rendering
 *
 * The per-surface suites prove that each call site still draws ITS OWN fallback
 * (`null`, the objectui#5631 placeholder, `Inbox`, a name chip). They cannot
 * prove the seam's own algebra, because a surface only ever shows "resolved" or
 * "did not" — so the tokeniser rows below are here, where the answer is the
 * component itself.
 *
 * ## The adopted rule is MEASURED, not chosen
 *
 * `split(/[-_\s]+/)` with `Home -> House` universal, from the pre-dispatch
 * enumeration the 2026-08-31 ruling required (comment 5522254814). Its
 * regression set is EMPTY three ways over: against the authored population,
 * against the every-name-x-every-surface cross-product, and against a
 * bound-free differential over 8,298 spellings derived from all 1,767 live
 * record keys. `split('-')` regresses 4,748 pairs in that last reading, which
 * is why it is not adoptable and why the rows below assert the WIDER rule
 * rather than the more common one.
 */

import { describe, it, expect } from 'vitest';
import { icons } from 'lucide-react';
import { resolveIcon, describeIconLookup } from '../resolve-icon';

describe('the icon-name seam resolves (objectui#5935)', () => {
  /**
   * ⭐ Non-vacuity for every "resolves" row below. A `resolveIcon` that returned
   * some component for EVERY input would pass them all; a `resolveIcon` that
   * returned `null` for every input would pass every fallback row in every
   * per-surface suite. Both directions are excluded here, in the same run.
   */
  it('DISCRIMINATES — a live name resolves and a dead one does not', () => {
    expect(resolveIcon('file-text')).not.toBeNull();
    expect(resolveIcon('not-a-real-icon')).toBeNull();
  });

  it('accepts all four authored spellings of one glyph', () => {
    const canonical = icons.ArrowRight;
    expect(canonical).toBeDefined();
    // kebab — what the docs and most fixtures author.
    expect(resolveIcon('arrow-right')).toBe(canonical);
    // snake — resolved on TWO of the seven surfaces before this card and on
    // five of them not at all. This row is the consolidation.
    expect(resolveIcon('arrow_right')).toBe(canonical);
    // space-separated — same story.
    expect(resolveIcon('arrow right')).toBe(canonical);
    // already-Pascal — authored in real fixtures, must not be mangled.
    expect(resolveIcon('ArrowRight')).toBe(canonical);
  });

  it('collapses repeated and mixed separators', () => {
    // `+` in the tokeniser. The equivalent spelling without it produced empty
    // tokens, which capitalise to nothing and join to nothing — measured
    // identical over 51,449 hostile spellings, and pinned here so the two
    // spellings are not "fixed" apart later.
    expect(resolveIcon('arrow--right')).toBe(icons.ArrowRight);
    expect(resolveIcon('arrow-_ right')).toBe(icons.ArrowRight);
  });

  it('applies the `Home` -> `House` rename, which is the ONLY rename', () => {
    // lucide dropped `Home` from its runtime record and kept `House`. The map
    // exists so a name that used to resolve still does — it is not a general
    // alias table, and nothing else belongs in it.
    expect(icons).not.toHaveProperty('Home');
    expect(resolveIcon('home')).toBe(icons.House);
    expect(resolveIcon('Home')).toBe(icons.House);
    expect(describeIconLookup('home')).toEqual({ pascal: 'Home', key: 'House' });
    // The control: an UNMAPPED name passes through both halves unchanged, so
    // the row above is about the map and not about `describeIconLookup` always
    // answering `House`.
    expect(describeIconLookup('file-text')).toEqual({ pascal: 'FileText', key: 'FileText' });
  });

  it('returns null — never a fallback glyph — for absent and unresolvable names', () => {
    // ⭐ The contract the 2026-09-03 maintainer ruling (option C) fixed: the
    // seam does `name -> component`, and NOTHING about what a surface draws
    // when there is no component. Each call site keeps its own fallback, so
    // this function must never acquire one, and must never acquire a parameter
    // for choosing one either.
    expect(resolveIcon(undefined)).toBeNull();
    expect(resolveIcon('')).toBeNull();
    expect(resolveIcon('definitely-not-a-lucide-icon')).toBeNull();
    // A RETIRED spelling: `Edit` still imports and still renders, but its key
    // is gone from the runtime record. Rules out a resolver that reached for
    // the named exports instead — a third, more forgiving vocabulary.
    expect(resolveIcon('edit')).toBeNull();
    expect(resolveIcon('square-pen')).toBe(icons.SquarePen);
  });

  it('takes the seam FUNCTION, not a re-derived string, as the answer', () => {
    // `describeIconLookup` exists only so `renderers/basic/icon.tsx` can name
    // both halves in its objectui#5631 warning without a second copy of the
    // tokeniser. Pinned as CONSISTENT with `resolveIcon` so the diagnostic can
    // never describe a lookup that did not happen.
    for (const authored of ['home', 'file-text', 'arrow_right', 'not-a-real-icon']) {
      const { key } = describeIconLookup(authored);
      const expected = Object.prototype.hasOwnProperty.call(icons, key)
        ? (icons as Record<string, unknown>)[key]
        : null;
      expect(resolveIcon(authored)).toBe(expected);
    }
  });

  it('is what the widening promised: the OLD resolving sets are strict subsets', () => {
    // Why no name could regress, made concrete. The old narrow tokeniser is
    // re-implemented HERE, in the test, so the claim is checked rather than
    // asserted — every name it resolved must still resolve, and the two names
    // the enumeration named as newly-resolving must now do so.
    const narrow = (name: string) => {
      const pascal = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      const mapped = pascal === 'Home' ? 'House' : pascal;
      return Object.prototype.hasOwnProperty.call(icons, mapped)
        ? (icons as Record<string, unknown>)[mapped]
        : null;
    };
    let carried = 0;
    for (const key of Object.keys(icons)) {
      // The kebab spelling of every live glyph — what the narrow tokeniser
      // could resolve at all.
      const kebab = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      const before = narrow(kebab);
      if (before === null) continue;
      carried += 1;
      expect(resolveIcon(kebab), `${kebab} stopped resolving`).toBe(before);
    }
    // Non-vacuity: a loop that skipped everything would pass silently.
    expect(carried).toBeGreaterThan(1000);
    // And the widening the enumeration measured, in both of its named cases.
    expect(narrow('building_2')).toBeNull();
    expect(resolveIcon('building_2')).toBe(icons.Building2);
    expect(narrow('layout_dashboard')).toBeNull();
    expect(resolveIcon('layout_dashboard')).toBe(icons.LayoutDashboard);
  });
});
