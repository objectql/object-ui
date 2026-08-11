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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('VALUELESS_FILTER_OPERATORS — parity with the builder’s own list', () => {
    it('covers every operator for which the FilterBuilder renders no value input', () => {
        const builderSrc = readFileSync(
            path.join(
                path.dirname(fileURLToPath(import.meta.url)),
                '../../../components/src/custom/filter-builder.tsx',
            ),
            'utf8',
        );
        // `const needsValueInput = (operator: string) => { return ![...].includes(operator) }`
        const match = builderSrc.match(/needsValueInput\s*=\s*\(operator: string\)\s*=>\s*\{\s*return\s*!\[([^\]]*)\]/);
        expect(match, 'the builder’s needsValueInput list moved — re-point this parity check').not.toBeNull();
        const builderValueless = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        expect(builderValueless.length).toBeGreaterThan(0);
        for (const operator of builderValueless) {
            expect(
                VALUELESS_FILTER_OPERATORS.has(operator),
                `the builder renders no value input for "${operator}", so the fold must not drop it as incomplete`,
            ).toBe(true);
        }
    });
});
