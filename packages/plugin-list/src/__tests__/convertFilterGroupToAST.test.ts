import { describe, it, expect } from 'vitest';
import { VALID_AST_OPERATORS, isFilterAST } from '@objectstack/spec/data';
import { VALUELESS_FILTER_BUILDER_OPERATORS } from '@object-ui/components';
import { convertFilterGroupToAST } from '../ListView';
import type { FilterGroup } from '@object-ui/components';

describe('convertFilterGroupToAST', () => {
  it('skips incomplete rows with an empty value (no filter, not `field = ""`)', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'project_type', operator: 'equals', value: '' }],
    } as FilterGroup;
    // Empty value → no condition emitted, so all rows show.
    expect(convertFilterGroupToAST(group)).toEqual([]);
  });

  it.each([undefined, null, '', []])('skips value %p', (value) => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'equals', value }],
    } as unknown as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual([]);
  });

  it('keeps rows with a real value', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'equals', value: 'foo' }],
    } as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual(['x', '=', 'foo']);
  });

  it('keeps isEmpty/isNotEmpty operators even though they carry no value', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'isEmpty', value: '' }],
    } as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual(['x', '=', null]);
  });

  it('keeps a fresh `Is null` row — no value is that row’s finished state', () => {
    // objectui#4744. The reachable sequence, in three clicks: `Add filter`
    // seeds `{ field: <first column>, operator: 'equals', value: '' }`, the
    // operator dropdown updates `operator` ALONE (so `value` stays `''`), and
    // the builder draws no value input for `isNull` — there is nothing left
    // for the user to do. This emitted `[]` before the fix: no filter at all,
    // no error, every record returned while the panel showed a condition.
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'closed_at', operator: 'isNull', value: '' }],
    } as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual(['closed_at', 'isnull', null]);
  });

  it('drops only the incomplete row in a mixed group', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [
        { field: 'a', operator: 'equals', value: 'foo' },
        { field: 'b', operator: 'equals', value: '' },
      ],
    } as FilterGroup;
    // Single surviving condition unwraps to the bare triplet.
    expect(convertFilterGroupToAST(group)).toEqual(['a', '=', 'foo']);
  });
});

/**
 * The fresh-row emission table (objectui#4744).
 *
 * This is the measurement that opened the issue, turned into a pin. One
 * condition per value-less operator, each with the `value: ''` a fresh row
 * carries, and the exact node it must produce. Measured against the code this
 * fixes, four of the six emitted `[]` — "no filter":
 *
 *   isEmpty    -> ["name","=",null]      isNull     -> []   ← the defect
 *   isNotEmpty -> ["name","!=",null]     isNotNull  -> []   ← the defect
 *                                        exists     -> []
 *                                        notExists  -> []
 *
 * It is a table over the SET rather than a list of four cases on purpose: the
 * totality check below fails if a new value-less operator appears upstream and
 * nobody comes here to say what the live grid emits for it. That is the same
 * silence this bug lived in — the set grew from two to six over three issues
 * and this function was never told.
 */
describe('convertFilterGroupToAST — every value-less operator emits a real node', () => {
  /** The node each value-less operator must emit for a row that has no value. */
  const EMITTED: Record<string, unknown[]> = {
    // Resolved to a null comparison before `mapOperator` is consulted — these
    // two already worked, and are pinned so the fix cannot regress them.
    isEmpty: ['f', '=', null],
    isNotEmpty: ['f', '!=', null],
    // The defect. `mapOperator` has had these rows all along and both spellings
    // are members of `VALID_AST_OPERATORS`; the row simply never reached it.
    isNull: ['f', 'isnull', null],
    isNotNull: ['f', 'isnotnull', null],
    // Kept for the same reason as the rest — the builder draws them value-less
    // — and NOT expressible on this dialect: `mapOperator` has no row, so the
    // id passes through verbatim and the AST gate refuses the whole filter.
    // That is why they are withheld from this toolbar entirely (objectui#4736,
    // `OPT_IN_OPERATORS`); `list-offered-operator-expressible-parity.test.ts`
    // is what keeps them off it. Unreachable here, pinned here so a future
    // decision to offer them lands as a red test rather than as a broken query.
    exists: ['f', 'exists', null],
    notExists: ['f', 'notExists', null],
  };

  const emit = (operator: string) =>
    convertFilterGroupToAST({
      logic: 'and',
      conditions: [{ field: 'f', operator, value: '' }],
    } as unknown as FilterGroup);

  it('pins exactly the shared value-less set, no more and no less', () => {
    expect(VALUELESS_FILTER_BUILDER_OPERATORS.size).toBeGreaterThan(0);
    expect([...VALUELESS_FILTER_BUILDER_OPERATORS].sort())
      .toEqual(Object.keys(EMITTED).sort());
  });

  it.each(Object.entries(EMITTED))('%s emits %j', (operator, expected) => {
    expect(
      emit(operator),
      `a fresh "${operator}" row emitted nothing, so the grid queries without it: `
        + 'the panel shows a filter and every record comes back',
    ).toEqual(expected);
  });

  // The half that makes the emission worth having. A non-empty node that the
  // AST gate rejects is no better than `[]` — worse, since it takes the rest of
  // the filter down with it — so the four operators this toolbar OFFERS are
  // checked through the gate the server uses.
  it.each(['isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'])(
    '%s survives isFilterAST, the gate that decides if the filter is parsed at all',
    (operator) => {
      const node = emit(operator);
      expect(node.length, `${operator} emitted no node`).toBeGreaterThan(0);
      expect(
        isFilterAST(node),
        `${JSON.stringify(node)} is rejected by isFilterAST(); the filter reaches the `
          + 'wire in a spelling the server will not compile',
      ).toBe(true);
    },
  );

  it('the two null predicates land on AST operators the spec defines', () => {
    // Asserted against the spec's own set rather than assumed: if upstream ever
    // retires these spellings, the emission above becomes a silent drop and
    // `mapOperator` needs new targets.
    for (const op of ['isnull', 'isnotnull']) {
      expect(VALID_AST_OPERATORS.has(op), `VALID_AST_OPERATORS no longer has '${op}'`).toBe(true);
    }
  });

  it('emits the same node whatever stale value the row still carries', () => {
    // The operator dropdown preserves `value`, so an `Is null` row can hold the
    // text typed under the previous operator — invisible, because no value
    // input is drawn for it. The emission must be a function of the operator.
    const stale = convertFilterGroupToAST({
      logic: 'and',
      conditions: [{ field: 'f', operator: 'isNull', value: 'typed under equals' }],
    } as unknown as FilterGroup);
    expect(stale).toEqual(['f', 'isnull', null]);
  });

  it('keeps a value-less row alongside a complete one', () => {
    const both = convertFilterGroupToAST({
      logic: 'and',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'won' },
        { field: 'closed_at', operator: 'isNull', value: '' },
      ],
    } as unknown as FilterGroup);
    expect(both).toEqual(['and', ['stage', '=', 'won'], ['closed_at', 'isnull', null]]);
    expect(isFilterAST(both)).toBe(true);
  });
});
