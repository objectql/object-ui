/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The opt-in half of the FilterBuilder's operator vocabulary (objectui#4023,
 * objectui#4736).
 *
 * This one dropdown feeds three at-rest dialects and they do not accept the
 * same operators. Two families are carried only by the MongoDB-style
 * `FieldOperatorsSchema` criteria:
 *
 *   - `containsCaseInsensitive` authors `$icontains`. `VIEW_FILTER_OPERATORS`
 *     (what a saved view stores) and `VALID_AST_OPERATORS` (what the live grid
 *     sends) have no case-insensitive contains at all.
 *   - `exists` / `notExists` author `$exists`. Neither of those two vocabularies
 *     has an existence operator either, under any spelling.
 *
 * Offering such an operator unconditionally hands users a filter two of three
 * consumers cannot execute — the same hazard that held objectui#4023 blocked
 * while no driver implemented the operator, moved from the drivers to this
 * repo's own bridges. objectui#4736 is that hazard realised: the existence pair
 * shipped to every consumer in objectui#2942 and the list toolbar sent it to
 * the wire verbatim.
 *
 * So the default answer is "not offered", and these tests pin BOTH directions:
 * withheld unless asked for, and actually reachable once asked for. A gate that
 * only checked the second would go green on a component that offers everything
 * to everybody.
 *
 * What these tests do NOT decide is which ids belong in `OPT_IN_OPERATORS` —
 * this package cannot see the dialects. That equality is forced per consumer:
 * `plugin-list`'s `list-offered-operator-expressible-parity.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { FILTER_BUILDER_OPERATORS, operatorsForFieldType } from '../custom/filter-builder';

const idsFor = (type: string | undefined, extra?: readonly string[]) =>
  operatorsForFieldType(type, extra).map((op) => op.value);

describe('FilterBuilder opt-in operators', () => {
  it('withholds containsCaseInsensitive from a consumer that did not ask', () => {
    expect(idsFor('text')).not.toContain('containsCaseInsensitive');
    expect(idsFor(undefined)).not.toContain('containsCaseInsensitive');
  });

  it('offers it to a text field once the consumer opts in', () => {
    const ids = idsFor('text', ['containsCaseInsensitive']);
    expect(ids).toContain('containsCaseInsensitive');
    // Beside its case-sensitive twin, not instead of it: `contains` keeps its
    // own row and its own meaning.
    expect(ids).toContain('contains');
    expect(ids.indexOf('containsCaseInsensitive')).toBe(ids.indexOf('contains') + 1);
  });

  it('does not offer it on types whose operators are not string matching', () => {
    // Opting in widens the TEXT bucket, not every bucket — a number or boolean
    // field gains no substring operator it never had.
    for (const type of ['number', 'currency', 'boolean', 'date', 'select', 'lookup']) {
      expect(idsFor(type, ['containsCaseInsensitive']), type).not.toContain(
        'containsCaseInsensitive',
      );
    }
  });

  it('ignores an opt-in id that is not an operator at all', () => {
    // A consumer's typo must not smuggle a row into the dropdown; the operator
    // list stays the intersection with what this component actually defines.
    expect(idsFor('text', ['totallyMadeUp'])).toEqual(idsFor('text'));
  });

  it('counts opt-in ids as operators the builder can draw', () => {
    // `FILTER_BUILDER_OPERATORS` answers "which ids can this dropdown render",
    // and the spec→builder parity guards in plugin-view read it that way. An
    // opt-in operator is drawable, so leaving it out would understate the
    // vocabulary and let a future spec operator look unreachable when it is not.
    expect(FILTER_BUILDER_OPERATORS).toContain('containsCaseInsensitive');
    expect(FILTER_BUILDER_OPERATORS).toContain('exists');
    expect(FILTER_BUILDER_OPERATORS).toContain('notExists');
    expect(new Set(FILTER_BUILDER_OPERATORS).size).toBe(FILTER_BUILDER_OPERATORS.length);
  });

  // objectui#4736. The pair is drawable but no longer unconditional, so the
  // list toolbar and the Studio view/tab inspectors — neither of which passes
  // `extraOperators` — stop drawing an operator their dialects cannot store.
  it('withholds exists / notExists from a consumer that did not ask', () => {
    for (const type of [undefined, 'text', 'number', 'date', 'select', 'lookup']) {
      const ids = idsFor(type);
      expect(ids, String(type)).not.toContain('exists');
      expect(ids, String(type)).not.toContain('notExists');
    }
  });

  it('offers exists / notExists once the consumer opts in', () => {
    const extra = ['exists', 'notExists'];
    // Reachable on every bucket that had them before the withdrawal — the
    // criteria builder filters lookups and dates by presence too, so scoping
    // this to text would silently narrow what objectui#2942 made authorable.
    for (const type of [undefined, 'text', 'number', 'date', 'select', 'lookup']) {
      const ids = idsFor(type, extra);
      expect(ids, String(type)).toContain('exists');
      expect(ids, String(type)).toContain('notExists');
      // Beside the null predicates, never instead of them: `$exists` and
      // `$null` are distinct spec operators and both keep their own rows.
      expect(ids, String(type)).toContain('isNull');
      expect(ids, String(type)).toContain('isNotNull');
    }
  });

  it('grants each opt-in id independently', () => {
    // A consumer that can store `$exists` but not `$icontains` (or the reverse)
    // must not get the other for free — that would make `extraOperators` a
    // single "unlock everything" switch and put the whole opt-in gate back.
    expect(idsFor('text', ['exists'])).not.toContain('containsCaseInsensitive');
    expect(idsFor('text', ['containsCaseInsensitive'])).not.toContain('exists');
    expect(idsFor('text', ['exists'])).not.toContain('notExists');
  });
});
