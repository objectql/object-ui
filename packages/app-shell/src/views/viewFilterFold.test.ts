/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#5159 — the list toolbar PUT a FilterBuilder `FilterGroup` into
 * the view's `filter`, where `ListViewSchema.filter` declares
 * `z.array(ViewFilterRuleSchema)`. The server answered 422 `invalid_union`.
 *
 * These tests pin the producer-side fold: the shape that reaches the wire, the
 * loud refusal for shapes that cannot fold losslessly, and — with the spec's
 * own schema — that the folded body is actually accepted.
 */
import { describe, it, expect } from 'vitest';
import { ListViewSchema } from '@objectstack/spec/ui';
import { foldFilterGroupToSpecRules, FILTER_FOLD_REFUSAL_KEYS } from './viewFilterFold';

/**
 * The body objectstack#5159 captured off the wire, verbatim: one click of
 * `Filter → Add filter` on `/_console/apps/showcase_app/showcase_task`.
 * Replay variant ① — the shape that must never be emitted again.
 */
const CAPTURED_TOOLBAR_GROUP = {
    id: 'root',
    logic: 'and',
    conditions: [
        { id: '712135fb-58c5-4be4-a611-1925181509b0', field: 'title', operator: 'equals', value: '' },
    ],
};

describe('foldFilterGroupToSpecRules — flat AND group → ViewFilterRule[]', () => {
    it('#5159: folds the captured toolbar body to replay variant ③ (declared keys only)', () => {
        const result = foldFilterGroupToSpecRules(CAPTURED_TOOLBAR_GROUP);
        expect(result.ok).toBe(true);
        expect(result.ok && result.rules).toEqual([
            { field: 'title', operator: 'equals', value: '' },
        ]);
    });

    it('#5159: what is emitted is an ARRAY — never the FilterGroup object (variant ①)', () => {
        const result = foldFilterGroupToSpecRules(CAPTURED_TOOLBAR_GROUP);
        expect(result.ok).toBe(true);
        const rules = result.ok ? result.rules : null;
        expect(Array.isArray(rules)).toBe(true);
        // The three keys that made the group a group are gone from the wire.
        expect(rules).not.toHaveProperty('logic');
        expect(rules).not.toHaveProperty('conditions');
        expect(JSON.stringify(rules)).not.toContain('"logic"');
    });

    it('#5114/#5159: strips the builder-minted row `id` — the read path regenerates it', () => {
        const result = foldFilterGroupToSpecRules(CAPTURED_TOOLBAR_GROUP);
        expect(result.ok && result.rules[0]).not.toHaveProperty('id');
        // Declared vocabulary only.
        expect(result.ok && Object.keys(result.rules[0])).toEqual(['field', 'operator', 'value']);
    });

    it('folds several conditions in order', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root',
            logic: 'and',
            conditions: [
                { id: 'a', field: 'status', operator: 'equals', value: 'open' },
                { id: 'b', field: 'amount', operator: 'greaterThan', value: 100 },
            ],
        });
        expect(result.ok && result.rules).toEqual([
            { field: 'status', operator: 'equals', value: 'open' },
            { field: 'amount', operator: 'greater_than', value: 100 },
        ]);
    });

    it('normalizes the builder camelCase vocabulary onto the spec canon', () => {
        const builderOperators = [
            'equals', 'notEquals', 'contains', 'notContains',
            'isEmpty', 'isNotEmpty', 'greaterThan', 'lessThan',
            'greaterOrEqual', 'lessOrEqual', 'before', 'after', 'between',
            'in', 'notIn', 'startsWith', 'endsWith', 'isNull', 'isNotNull',
        ];
        const result = foldFilterGroupToSpecRules({
            id: 'root',
            logic: 'and',
            conditions: builderOperators.map((operator, i) => ({
                id: `c${i}`, field: 'f', operator, value: 'x',
            })),
        });
        expect(result.ok).toBe(true);
        expect(result.ok && result.rules.map(r => r.operator)).toEqual([
            'equals', 'not_equals', 'contains', 'not_contains',
            'is_empty', 'is_not_empty', 'greater_than', 'less_than',
            'greater_than_or_equal', 'less_than_or_equal', 'before', 'after', 'between',
            'in', 'not_in', 'starts_with', 'ends_with', 'is_null', 'is_not_null',
        ]);
    });

    it('passes an operator the spec does not know through VERBATIM (server rejects, we do not coerce)', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [{ id: 'a', field: 'f', operator: 'sounds_like', value: 'x' }],
        });
        // NOT silently rewritten to `equals` — the spec enum is the judge.
        expect(result.ok && result.rules[0].operator).toBe('sounds_like');
    });

    it('drops the blank row `Add filter` inserts before a column is picked', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [
                { id: 'a', field: '', operator: 'equals', value: '' },
                { id: 'b', field: 'title', operator: 'equals', value: 'x' },
            ],
        });
        expect(result.ok && result.rules).toEqual([{ field: 'title', operator: 'equals', value: 'x' }]);
    });

    it('omits `value` entirely when the row carries none (unary operators)', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [{ id: 'a', field: 'archived_at', operator: 'isEmpty' }],
        });
        expect(result.ok && result.rules).toEqual([{ field: 'archived_at', operator: 'is_empty' }]);
        expect(result.ok && 'value' in result.rules[0]).toBe(false);
    });
});

describe('foldFilterGroupToSpecRules — empty conditions', () => {
    // Current UX contract: clearing every row must CLEAR the stored filter, so
    // the fold yields `[]` — which `z.array(ViewFilterRuleSchema).optional()`
    // accepts and which reads back as "no filter". It is not a refusal.
    it('an empty group folds to an empty rule list (clears the stored filter)', () => {
        expect(foldFilterGroupToSpecRules({ id: 'root', logic: 'and', conditions: [] }))
            .toEqual({ ok: true, rules: [] });
    });

    it('a group whose only rows are blank folds to an empty rule list', () => {
        expect(foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [{ id: 'a', field: '', operator: 'equals', value: '' }],
        })).toEqual({ ok: true, rules: [] });
    });

    it('null / undefined fold to an empty rule list', () => {
        expect(foldFilterGroupToSpecRules(null)).toEqual({ ok: true, rules: [] });
        expect(foldFilterGroupToSpecRules(undefined)).toEqual({ ok: true, rules: [] });
    });
});

describe('foldFilterGroupToSpecRules — loud refusal, never a silent downgrade (A1)', () => {
    it("refuses `logic: 'or'` over two conditions instead of writing them as AND", () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root',
            logic: 'or',
            conditions: [
                { id: 'a', field: 'status', operator: 'equals', value: 'open' },
                { id: 'b', field: 'status', operator: 'equals', value: 'blocked' },
            ],
        });
        expect(result).toEqual({ ok: false, reason: 'or_logic' });
        // The refusal reaches the user through a translated string, not a
        // console throw: the toolbar surfaces this key as a toast.
        expect(FILTER_FOLD_REFUSAL_KEYS.or_logic).toBe('console.objectView.filterOrNotSavable');
    });

    it('refuses OR however many conditions there are beyond one', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'or',
            conditions: [
                { id: 'a', field: 'a', operator: 'equals', value: 1 },
                { id: 'b', field: 'b', operator: 'equals', value: 2 },
                { id: 'c', field: 'c', operator: 'equals', value: 3 },
            ],
        });
        expect(result.ok).toBe(false);
    });

    it("folds `logic: 'or'` over ONE condition — OR and AND select the same records there", () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'or',
            conditions: [{ id: 'a', field: 'status', operator: 'equals', value: 'open' }],
        });
        expect(result).toEqual({ ok: true, rules: [{ field: 'status', operator: 'equals', value: 'open' }] });
    });

    it("folds `logic: 'or'` over blank rows only (nothing to downgrade)", () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'or',
            conditions: [{ id: 'a', field: '', operator: 'equals', value: '' }],
        });
        expect(result).toEqual({ ok: true, rules: [] });
    });

    it('refuses a nested group — a flat rule array cannot express it', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root',
            logic: 'and',
            conditions: [
                { id: 'a', field: 'status', operator: 'equals', value: 'open' },
                { id: 'g1', logic: 'or', conditions: [{ id: 'b', field: 'x', operator: 'equals', value: 1 }] },
            ],
        });
        expect(result).toEqual({ ok: false, reason: 'nested_group' });
        expect(FILTER_FOLD_REFUSAL_KEYS.nested_group).toBe('console.objectView.filterNestedNotSavable');
    });

    it('refuses a nested AND group too — nesting, not the logic word, is the problem', () => {
        const result = foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [{ id: 'g1', logic: 'and', conditions: [] }],
        });
        expect(result).toEqual({ ok: false, reason: 'nested_group' });
    });

    it('every refusal reason has a user-readable key — no reason can surface untranslated', () => {
        const reasons: Array<keyof typeof FILTER_FOLD_REFUSAL_KEYS> = ['or_logic', 'nested_group'];
        for (const reason of reasons) {
            expect(FILTER_FOLD_REFUSAL_KEYS[reason]).toMatch(/^console\.objectView\./);
        }
    });
});

describe('the folded body is what the spec actually accepts (replay-matrix closure)', () => {
    /** A minimal view body that is valid apart from whatever `filter` carries. */
    const viewBody = (filter: unknown) => ({
        name: 'default', label: 'All', type: 'grid',
        columns: ['title'],
        filter,
    });

    it('the fixture itself is valid without a filter — the assertions below isolate `filter`', () => {
        const parsed = ListViewSchema.safeParse(viewBody(undefined));
        expect(parsed.success, JSON.stringify((parsed as any).error?.issues)).toBe(true);
    });

    // Replay variant ① — the FilterGroup object the toolbar used to PUT.
    it('#5159 variant ①: the raw FilterGroup is REJECTED by ListViewSchema, on `filter`', () => {
        const parsed = ListViewSchema.safeParse(viewBody(CAPTURED_TOOLBAR_GROUP));
        expect(parsed.success).toBe(false);
        // The 422 the browser saw. Pin that it is `filter` that fails, so this
        // cannot pass because some unrelated key drifted out of the fixture.
        const paths = (parsed as any).error.issues.map((i: any) => i.path.join('.'));
        expect(paths).toContain('filter');
    });

    // Replay variant ③ — what the fold now emits.
    it('#5159 variant ③: the folded rule array is ACCEPTED by ListViewSchema', () => {
        const folded = foldFilterGroupToSpecRules(CAPTURED_TOOLBAR_GROUP);
        expect(folded.ok).toBe(true);
        const parsed = ListViewSchema.safeParse(viewBody(folded.ok ? folded.rules : undefined));
        expect(parsed.success, JSON.stringify((parsed as any).error?.issues)).toBe(true);
    });

    it('an empty rule list (filters cleared) is ACCEPTED by ListViewSchema', () => {
        const parsed = ListViewSchema.safeParse(viewBody([]));
        expect(parsed.success, JSON.stringify((parsed as any).error?.issues)).toBe(true);
    });

    it('every builder operator the fold normalizes survives ListViewSchema', () => {
        const folded = foldFilterGroupToSpecRules({
            id: 'root', logic: 'and',
            conditions: [
                { id: '1', field: 'a', operator: 'startsWith', value: 'x' },
                { id: '2', field: 'b', operator: 'isNull' },
                { id: '3', field: 'c', operator: 'greaterOrEqual', value: 5 },
                { id: '4', field: 'd', operator: 'notIn', value: ['x', 'y'] },
            ],
        });
        expect(folded.ok).toBe(true);
        const parsed = ListViewSchema.safeParse(viewBody(folded.ok ? folded.rules : undefined));
        expect(parsed.success, JSON.stringify((parsed as any).error?.issues)).toBe(true);
    });
});
