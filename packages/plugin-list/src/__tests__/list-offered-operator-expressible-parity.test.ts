/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Offered ⇄ expressible parity for the list toolbar's filter builder (#4736).
 *
 * ## The direction nothing guarded
 *
 * objectui has three operator-parity guards and all three sweep the same way —
 * spec vocabulary → objectui, asking whether every operator an author may
 * DECLARE is one this repo can render or bridge:
 *
 *   - `filter-operator-ast-parity.test.ts` (this package and `data-objectstack`)
 *     iterates `VIEW_FILTER_OPERATORS`;
 *   - `view-operator-builder-parity.test.ts` iterates `__CANONICAL_TO_BUILDER`,
 *     keyed by that same vocabulary;
 *   - `FilterConditionField.operators.test.ts` asks whether every spec
 *     `$`-token is reachable from the dropdown.
 *
 * None of them asks the reverse: is every id the DROPDOWN can draw an id this
 * consumer can persist? That is the direction that broke. `exists` / `notExists`
 * were added to the shared `FilterBuilder` by objectui#2942 so `$exists` would
 * be reachable from `FilterConditionField`, and they were offered to every
 * consumer — including this one, whose two dialects have no existence operator
 * at all. `mapOperator`'s `default:` arm returned the id verbatim and the query
 * went out as `['name', 'exists', 'x']`, which `isFilterAST()` rejects.
 *
 * ## What this file asserts, and why it is an equality
 *
 * The toolbar persists into TWO dialects, and a filter has to survive both:
 *
 *   1. **the live grid** — `convertFilterGroupToAST` → the array/triplet filter
 *      AST, gated by `isFilterAST()` over `VALID_AST_OPERATORS`. A rejected
 *      filter costs an unfiltered read or a 400; see the header of
 *      `filter-operator-ast-parity.test.ts` for that measurement.
 *   2. **save as view** — app-shell's `foldFilterGroupToSpecRules`, whose only
 *      operator transform is the spec's own `normalizeFilterOperator`, landing
 *      on `ViewFilterRuleSchema`'s enum. That fold cannot be imported here
 *      (app-shell depends on this package, not the other way round), so the leg
 *      below mirrors it through the same two spec exports and finishes on the
 *      SCHEMA rather than on set membership — the schema is what actually
 *      refuses the rule.
 *
 * The spine is `offers exactly the operators both dialects can express`: an
 * EQUALITY, not a subset check. A subset check is satisfied by a toolbar that
 * offers nothing, and it would let the opposite drift through in silence — an
 * operator that becomes expressible upstream and stays needlessly withheld.
 * Forcing equality is what makes the `OPT_IN_OPERATORS` entry in
 * `@object-ui/components` self-retiring: the day the view and AST vocabularies
 * gain an existence operator, this file goes red and says to offer it again.
 */
import { describe, it, expect } from 'vitest';
import { VALID_AST_OPERATORS, isFilterAST } from '@objectstack/spec/data';
import {
  VIEW_FILTER_OPERATORS,
  ViewFilterRuleSchema,
  normalizeFilterOperator,
} from '@objectstack/spec/ui';
import { FILTER_BUILDER_OPERATORS, operatorsForFieldType } from '@object-ui/components';
import {
  LIST_VIEW_EXTRA_OPERATORS,
  convertFilterGroupToAST,
} from '../ListView';

/**
 * One field type per operator bucket in `filter-builder.tsx`, plus `undefined`
 * (the default arm) and an unknown type (which falls into the same text
 * bucket). The bucket arrays are module-private there, so this list is
 * hand-written — and the totality ratchet below is what keeps it honest: if a
 * bucket is added or a type moves, the union stops covering
 * `FILTER_BUILDER_OPERATORS` and this file goes red rather than silently
 * testing a shrinking slice of the dropdown.
 */
const PROBE_FIELD_TYPES: ReadonlyArray<string | undefined> = [
  undefined,
  'text',
  'a_type_this_builder_has_never_heard_of',
  'number',
  'currency',
  'percent',
  'rating',
  'boolean',
  'date',
  'datetime',
  'time',
  'select',
  'status',
  'lookup',
  'master_detail',
  'user',
  'owner',
];

/** Operator ids offered across every bucket, given the opt-ins granted. */
function offeredAcrossBuckets(extra: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const type of PROBE_FIELD_TYPES) {
    for (const op of operatorsForFieldType(type, extra)) ids.add(op.value);
  }
  return [...ids].sort();
}

/**
 * What the LIST toolbar offers — read through the constant `ListView` actually
 * passes to `FilterBuilder`, never through a literal `[]`. A future
 * `extraOperators` added at that call site has to come through here.
 */
const OFFERED_BY_LIST = offeredAcrossBuckets(LIST_VIEW_EXTRA_OPERATORS);

/**
 * Every id the dropdown can draw for some field type with every opt-in granted
 * — the pool the toolbar's offering is a selection FROM. Granting the full
 * vocabulary as `extraOperators` is how an opt-in id is included; ids that are
 * not opt-in are unaffected by it.
 */
const DRAWABLE = offeredAcrossBuckets(FILTER_BUILDER_OPERATORS);

/** A value that keeps a row from being dropped as incomplete, per operator. */
function probeValue(operator: string): unknown {
  if (operator === 'in' || operator === 'notIn') return ['a', 'b'];
  if (operator === 'between') return [1, 5];
  return 'x';
}

/**
 * Leg 1 — the live grid. Drives the REAL production path rather than reasoning
 * about `mapOperator` alone, because `convertFilterGroupToAST` resolves some
 * ids (`isEmpty` / `isNotEmpty`) to a null comparison before the bridge is ever
 * consulted, and those are legitimately expressible without an AST spelling.
 *
 * The emitted node is required to be NON-EMPTY. Without that, the assertion is
 * a tautology waiting to happen: a condition dropped as incomplete yields `[]`,
 * which is "no filter" and would sail through `isFilterAST()` while the user's
 * chosen operator never reached the wire at all.
 */
function liveGridResult(operator: string): { ok: boolean; emitted: unknown } {
  const emitted = convertFilterGroupToAST({
    id: 'root',
    logic: 'and',
    conditions: [{ id: 'c1', field: 'some_field', operator, value: probeValue(operator) }],
  } as never);
  const nonEmpty = Array.isArray(emitted) && emitted.length > 0;
  return { ok: nonEmpty && isFilterAST(emitted), emitted };
}

/**
 * Leg 2 — save as view. Mirrors `foldFilterGroupToSpecRules`: normalize through
 * the spec's own map, then hand the rule to the schema the server validates
 * with. `value` is included exactly when the operator takes one, matching the
 * fold's `VALUELESS_FILTER_OPERATORS` treatment.
 */
const VALUELESS = new Set(['isEmpty', 'isNotEmpty', 'isNull', 'isNotNull', 'exists', 'notExists']);

function savedViewResult(operator: string): { ok: boolean; canonical: string } {
  const canonical = String(normalizeFilterOperator(operator));
  const rule: Record<string, unknown> = { field: 'some_field', operator: canonical };
  if (!VALUELESS.has(operator)) rule.value = probeValue(operator);
  return { ok: ViewFilterRuleSchema.safeParse(rule).success, canonical };
}

const isExpressible = (operator: string) =>
  liveGridResult(operator).ok && savedViewResult(operator).ok;

describe('the list toolbar offers only operators its dialects can express', () => {
  it('reads a non-empty vocabulary from each side', () => {
    // Guards every assertion below against passing on an empty list.
    expect(VALID_AST_OPERATORS.size).toBeGreaterThan(0);
    expect(VIEW_FILTER_OPERATORS.length).toBeGreaterThan(0);
    expect(FILTER_BUILDER_OPERATORS.length).toBeGreaterThan(0);
    expect(OFFERED_BY_LIST.length).toBeGreaterThan(0);
  });

  // The totality ratchet for PROBE_FIELD_TYPES. The bucket arrays are private
  // to `filter-builder.tsx`, so a new bucket — or an operator that only appears
  // in one — would otherwise leave this file sweeping a subset of the dropdown
  // and reporting parity over the part it happens to see.
  it('probes every operator the builder can draw', () => {
    const unprobed = [...FILTER_BUILDER_OPERATORS].filter((id) => !DRAWABLE.includes(id));
    expect(
      unprobed,
      `PROBE_FIELD_TYPES reaches no bucket containing: ${unprobed.join(', ')}. `
        + 'A field-type bucket was added or moved in filter-builder.tsx — add a '
        + 'representative type here, or this file stops covering those operators',
    ).toEqual([]);
  });

  it.each(OFFERED_BY_LIST)('%s survives to the live grid', (operator) => {
    const { ok, emitted } = liveGridResult(operator);
    expect(
      ok,
      `the toolbar offers '${operator}', and convertFilterGroupToAST emitted `
        + `${JSON.stringify(emitted)} — which isFilterAST() rejects (or dropped the row `
        + 'entirely). The operator reaches the wire verbatim and the query comes back '
        + 'broken: an unfiltered read or a 400, never the filter the user asked for. '
        + 'Either give mapOperator a row that is a real member of VALID_AST_OPERATORS, '
        + 'or withdraw the operator from this consumer via OPT_IN_OPERATORS',
    ).toBe(true);
  });

  it.each(OFFERED_BY_LIST)('%s is storable as a saved-view rule', (operator) => {
    const { ok, canonical } = savedViewResult(operator);
    expect(
      ok,
      `the toolbar offers '${operator}'; foldFilterGroupToSpecRules normalizes it to `
        + `'${canonical}' and ViewFilterRuleSchema refuses that operator. Saving the `
        + 'panel as a view fails on the server enum, so the filter on screen cannot be '
        + 'persisted at all',
    ).toBe(true);
  });

  // The spine. An equality, deliberately — see the file header.
  it('offers exactly the operators both dialects can express, no more and no less', () => {
    const expressible = DRAWABLE.filter(isExpressible);

    const unexpressibleButOffered = OFFERED_BY_LIST.filter((id) => !expressible.includes(id));
    expect(
      unexpressibleButOffered,
      `the toolbar offers operators neither of its dialects can carry: `
        + `${unexpressibleButOffered.join(', ')}. Add them to OPT_IN_OPERATORS in `
        + '@object-ui/components so only the consumer that can store them offers them',
    ).toEqual([]);

    const expressibleButWithheld = expressible.filter((id) => !OFFERED_BY_LIST.includes(id));
    expect(
      expressibleButWithheld,
      `these operators are expressible on BOTH of this toolbar's dialects and are still `
        + `withheld from it: ${expressibleButWithheld.join(', ')}. Whatever made them `
        + 'opt-in no longer holds — drop the OPT_IN_OPERATORS entry (or name them in '
        + 'LIST_VIEW_EXTRA_OPERATORS) rather than leaving a withdrawal nothing justifies',
    ).toEqual([]);

    expect(OFFERED_BY_LIST).toEqual(expressible);
  });

  // The named pin for the pair this guard was written for (#4736). It states
  // the measurement the OPT_IN_OPERATORS comment rests on — that BOTH dialects
  // refuse them, not just one — so that upstream gaining an existence operator
  // on either side lands as a red test with something to do, rather than as a
  // comment that has quietly become false.
  it('withholds exists / notExists from this consumer, and says why', () => {
    for (const id of ['exists', 'notExists']) {
      expect(FILTER_BUILDER_OPERATORS, `${id} is no longer an id the builder can draw`)
        .toContain(id);
      expect(
        OFFERED_BY_LIST,
        `${id} is back in the list toolbar's dropdown; its save path produces a broken `
          + 'query on the live grid and a refused rule on save-as-view',
      ).not.toContain(id);
      expect(
        liveGridResult(id).ok,
        `VALID_AST_OPERATORS now expresses '${id}'. Half the reason it is withheld is `
          + 'gone — recheck the other dialect and the OPT_IN_OPERATORS note',
      ).toBe(false);
      expect(
        savedViewResult(id).ok,
        `VIEW_FILTER_OPERATORS now expresses '${id}'. Half the reason it is withheld is `
          + 'gone — recheck the other dialect and the OPT_IN_OPERATORS note',
      ).toBe(false);
    }
  });

  // The withdrawal is scoped to the existence pair: `isNull` / `isNotNull` are
  // real members of both vocabularies and must keep their rows. Collapsing the
  // one family onto the other is what this fix deliberately did NOT do — the
  // same refusal `view-operator-builder-parity.test.ts` records for
  // `is_null` -> `isEmpty`.
  it('keeps the null predicates, which both dialects do express', () => {
    for (const id of ['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty']) {
      expect(OFFERED_BY_LIST, `${id} must still be offered`).toContain(id);
      expect(isExpressible(id), `${id} must still be expressible on both dialects`).toBe(true);
    }
  });
});
