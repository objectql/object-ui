/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4155 — an INCOMPLETE filter row must never be persisted.
 *
 * The defect this pins is a divergence between two halves of one interaction:
 *
 *   `ListView.convertFilterGroupToAST` (what the screen QUERIES) skips a
 *   condition whose value is `null` / `''` / `[]`, because `[field, '=', '']`
 *   is a silently-wrong filter (matches only the empty string), not "no
 *   filter".
 *
 *   `foldFilterGroupToSpecRules` (what gets PERSISTED) carried that same row
 *   through verbatim — deliberately, per its own doc comment.
 *
 * So the one condition the live grid ignored was the one condition that reached
 * storage. `Filter → Add filter` inserts `{ field: <first column>, operator:
 * 'equals', value: '' }` — a real field, no value yet — and the write path
 * turned it into the view's stored `filter`, replacing the source-declared one
 * (`status not_in [archived, deleted]`) for every user of that view. Result:
 * `total: 0` on the next read, and nothing in the panel to explain it.
 *
 * SUITE DIRECTION, predicted before running: every case below is RED against
 * `origin/main`'s fold — which returns the `value: ''` rule — and green after,
 * EXCEPT `keeps a row whose value is a real falsy value`, `keeps a value-less
 * operator` and the builder-parity case, which are green in both worlds by
 * construction (they pin what must NOT change).
 */

import { describe, it, expect } from 'vitest';
import { VALUELESS_FILTER_BUILDER_OPERATORS } from '@object-ui/components';
import { foldFilterGroupToSpecRules, VALUELESS_FILTER_OPERATORS } from './viewFilterFold';

const group = (conditions: unknown[], logic = 'and') => ({ id: 'root', logic, conditions });
const rules = (result: ReturnType<typeof foldFilterGroupToSpecRules>) =>
    result.ok ? result.rules : null;

describe('foldFilterGroupToSpecRules — incomplete rows are not persisted (#4155)', () => {
    it('drops the `Add filter` row: a real field, `equals`, no value yet', () => {
        // The exact body the panel emits on one click of `Add filter`, with the
        // field defaulted to the first column (`fields[0]?.value`).
        const result = foldFilterGroupToSpecRules(
            group([{ id: 'a', field: 'status', operator: 'equals', value: '' }]),
        );
        expect(result.ok).toBe(true);
        expect(rules(result)).toEqual([]);
    });

    it('drops it whatever the operator, as long as the operator wants a value', () => {
        for (const operator of ['equals', 'notEquals', 'contains', 'startsWith', 'greaterThan', 'in']) {
            const result = foldFilterGroupToSpecRules(
                group([{ id: 'a', field: 'status', operator, value: '' }]),
            );
            expect(rules(result), `operator ${operator} persisted an empty value`).toEqual([]);
        }
    });

    it('treats `null`, `undefined` and `[]` as "no value" — same predicate the live query uses', () => {
        for (const value of [null, undefined, []]) {
            const result = foldFilterGroupToSpecRules(
                group([{ id: 'a', field: 'status', operator: 'equals', value }]),
            );
            expect(rules(result), `value ${JSON.stringify(value)} was persisted`).toEqual([]);
        }
    });

    it('keeps the complete rows and drops only the incomplete one', () => {
        const result = foldFilterGroupToSpecRules(
            group([
                { id: 'a', field: 'status', operator: 'equals', value: 'open' },
                { id: 'b', field: 'owner', operator: 'equals', value: '' },
                { id: 'c', field: 'amount', operator: 'greaterThan', value: 100 },
            ]),
        );
        expect(rules(result)).toEqual([
            { field: 'status', operator: 'equals', value: 'open' },
            { field: 'amount', operator: 'greater_than', value: 100 },
        ]);
    });

    it('keeps a value-less OPERATOR — no value is that row’s finished state', () => {
        // `isEmpty` renders no value input at all; dropping it would delete a
        // legitimate saved condition rather than an unfinished one.
        const result = foldFilterGroupToSpecRules(
            group([
                { id: 'a', field: 'archived_at', operator: 'isEmpty' },
                { id: 'b', field: 'closed_at', operator: 'isNull', value: '' },
            ]),
        );
        expect(rules(result)).toEqual([
            { field: 'archived_at', operator: 'is_empty' },
            { field: 'closed_at', operator: 'is_null', value: '' },
        ]);
    });

    it('keeps a row whose value is a real falsy value — `0` and `false` are answers', () => {
        const result = foldFilterGroupToSpecRules(
            group([
                { id: 'a', field: 'amount', operator: 'equals', value: 0 },
                { id: 'b', field: 'is_active', operator: 'equals', value: false },
            ]),
        );
        expect(rules(result)).toEqual([
            { field: 'amount', operator: 'equals', value: 0 },
            { field: 'is_active', operator: 'equals', value: false },
        ]);
    });

    it('a group of nothing BUT incomplete rows folds to `[]`, not to a refusal', () => {
        const result = foldFilterGroupToSpecRules(
            group([
                { id: 'a', field: 'status', operator: 'equals', value: '' },
                { id: 'b', field: 'owner', operator: 'equals', value: '' },
            ], 'or'),
        );
        // Both rows drop, so nothing is left to downgrade: `logic: 'or'` over
        // fewer than two EFFECTIVE rules folds rather than refusing.
        expect(result).toEqual({ ok: true, rules: [] });
    });
});

/**
 * This pin used to read `filter-builder.tsx` as TEXT and scrape the operator
 * list out of `needsValueInput` with a regex, because the builder kept that
 * list as an inline literal and there was nothing to import. objectui#4744
 * gave it a name — `VALUELESS_FILTER_BUILDER_OPERATORS`, which `needsValueInput`
 * is now defined as the complement OF — so the parity check reads the value
 * itself. Same guarantee, minus a regex that goes quietly non-matching the day
 * someone reformats the function it parses.
 *
 * What this file no longer has to assert is that the builder actually RENDERS
 * no value input for each id: that is a fact about the component, and it is
 * pinned where the component lives —
 * `components/src/__tests__/filter-builder-valueless-operators.test.tsx`
 * drives the real render for every member of the set.
 */
describe('VALUELESS_FILTER_OPERATORS — parity with the builder’s own set', () => {
    it('covers every operator for which the FilterBuilder renders no value input', () => {
        expect(VALUELESS_FILTER_BUILDER_OPERATORS.size).toBeGreaterThan(0);
        for (const operator of VALUELESS_FILTER_BUILDER_OPERATORS) {
            expect(
                VALUELESS_FILTER_OPERATORS.has(operator),
                `the builder renders no value input for "${operator}", so the fold must not drop it as incomplete`,
            ).toBe(true);
        }
    });

    it('adds the canonical spec spellings the builder never sees', () => {
        // The fold reads a stored `ViewFilterRule`, whose operator has been
        // through `normalizeFilterOperator`; those spellings are this layer's
        // own addition and belong to no dropdown.
        for (const operator of ['is_empty', 'is_not_empty', 'is_null', 'is_not_null']) {
            expect(VALUELESS_FILTER_OPERATORS.has(operator), operator).toBe(true);
            expect(
                VALUELESS_FILTER_BUILDER_OPERATORS.has(operator),
                `"${operator}" is a canonical spec spelling, not a builder id — it must not `
                    + 'have crept into the shared set',
            ).toBe(false);
        }
    });
});
