/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The opt-in half of the FilterBuilder's operator vocabulary (objectui#4023).
 *
 * `containsCaseInsensitive` authors the spec's `$icontains`, which the MongoDB-
 * style `FieldOperatorsSchema` dialect carries and the OTHER two dialects this
 * one dropdown feeds do not: `VIEW_FILTER_OPERATORS` (what a saved view stores)
 * and `VALID_AST_OPERATORS` (what the live grid sends) have no case-insensitive
 * contains at all. Offering it unconditionally would hand users a filter two of
 * three consumers cannot execute — the same hazard that held objectui#4023
 * blocked while no driver implemented the operator, moved from the drivers to
 * this repo's own bridges.
 *
 * So the default answer is "not offered", and these tests pin BOTH directions:
 * withheld unless asked for, and actually reachable once asked for. A gate that
 * only checked the second would go green on a component that offers everything
 * to everybody.
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
    expect(new Set(FILTER_BUILDER_OPERATORS).size).toBe(FILTER_BUILDER_OPERATORS.length);
  });
});
