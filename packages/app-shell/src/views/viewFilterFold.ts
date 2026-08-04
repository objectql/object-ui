/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FilterBuilder → `@objectstack/spec` view filter, the WRITE direction.
 *
 * The FilterBuilder (`@object-ui/components`) speaks a grouped dialect —
 * `{ id, logic, conditions }` with a per-row `id` and camelCase operators.
 * `@objectstack/spec`'s `ListViewSchema.filter` / `ViewTab.filter` declare
 * `z.array(ViewFilterRuleSchema)`: a FLAT list of `{ field, operator, value }`.
 * Persisting the builder's group verbatim is a type error the server rejects
 * with a `invalid_union` 422 — objectstack#5159, reproduced in a real browser
 * on the list toolbar's `Filter → Add filter → save`.
 *
 * Contract-first (AGENTS.md #0.1): the producer folds, the spec is untouched.
 * Widening `ListViewSchema.filter` to `union([rule[], FilterGroup])` would put
 * two shapes in storage and force every reader to accept both — the exact debt
 * this repo keeps paying down.
 *
 * The READ direction lives in `@object-ui/plugin-view`
 * (`config/view-config-utils.ts`: `parseSpecFilter` / `toFilterGroup`); this is
 * its missing half, extracted from the Studio inspector's `FilterBuilderField`
 * (`metadata-admin/widgets.tsx`) which had the only copy, so the runtime
 * toolbar and Studio now fold through ONE function rather than two dialects.
 */

import { normalizeFilterOperator } from '@objectstack/spec/ui';
import type { ViewFilterRule } from '@objectstack/spec/ui';

/** Why a group could not be folded to a flat spec rule list. */
export type FilterFoldRefusal =
    /** `logic: 'or'` over 2+ conditions — a flat rule array is AND-only. */
    | 'or_logic'
    /** A condition that is itself a group — the spec rule list has no nesting. */
    | 'nested_group';

export type FilterFoldResult =
    | { ok: true; rules: ViewFilterRule[] }
    | { ok: false; reason: FilterFoldRefusal };

/** Loose shape of what the FilterBuilder hands back through `onChange`. */
interface FilterGroupLike {
    id?: string;
    logic?: string;
    conditions?: unknown[];
}

function isGroupLike(value: unknown): value is FilterGroupLike {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    // A nested GROUP is recognised by carrying a logic operator or its own
    // condition list — NOT merely by lacking `field`, which is also true of the
    // blank row `Add filter` inserts before the user picks a column.
    return Array.isArray(v.conditions) || v.logic === 'and' || v.logic === 'or';
}

/**
 * Fold a FilterBuilder group into the spec's `ViewFilterRule[]`.
 *
 * Folding rules:
 *
 * - **Operators** are normalized through the spec's OWN
 *   {@link normalizeFilterOperator}, so the builder's camelCase ids
 *   (`notEquals`, `greaterOrEqual`, `startsWith`, `isNull`, …) land on the
 *   canonical vocabulary `ViewFilterRuleSchema` enumerates. Using the spec's
 *   exported map rather than a hand-kept table is what keeps this from
 *   becoming a second dialect — the previous local table in
 *   `metadata-admin/widgets.tsx` had drifted four operators behind the
 *   builder's dropdown (`startsWith`/`endsWith`/`isNull`/`isNotNull`).
 *   An operator the spec does not know is passed through VERBATIM so the
 *   server's enum rejects it loudly, rather than being coerced to `equals`.
 * - **Blank rows are dropped.** `Add filter` inserts a row with `field: ''`;
 *   it is not yet a filter. (Same predicate the Studio inspector used.)
 * - **`id` is stripped.** It is a React list key, not spec vocabulary. The read
 *   path regenerates it — `parseSpecFilter`'s `parseTriplet` always mints
 *   `crypto.randomUUID()`, and `parseSingleOrNested` does `item.id ||
 *   crypto.randomUUID()` — so nothing downstream needs it persisted, and the
 *   at-rest body stays the declared `{field, operator, value}` only.
 * - **`value` is carried verbatim**, including `''` (the row the toolbar emits
 *   the moment a field is picked). `ViewFilterRuleSchema.value` accepts it and
 *   rewriting it here would silently change what the user saved.
 *
 * Refusals (objectstack#5159, maintainer adjudication A1): a shape that cannot
 * fold LOSSLESSLY is refused, never downgraded. `logic: 'or'` has no at-rest
 * representation in a flat rule array, so quietly writing those conditions as
 * AND would return a different record set than the one on screen.
 *
 * `logic: 'or'` over FEWER than two effective rules is folded rather than
 * refused: with 0 or 1 condition, OR and AND select exactly the same records,
 * so there is nothing to lose and nothing to downgrade. The refusal starts
 * where the semantics actually diverge.
 */
export function foldFilterGroupToSpecRules(group: unknown): FilterFoldResult {
    if (group == null) return { ok: true, rules: [] };

    const conditions = isGroupLike(group) && Array.isArray(group.conditions)
        ? group.conditions
        : [];

    const rules: ViewFilterRule[] = [];
    for (const condition of conditions) {
        if (isGroupLike(condition)) return { ok: false, reason: 'nested_group' };
        if (typeof condition !== 'object' || condition === null) continue;
        const c = condition as Record<string, unknown>;
        // Blank row the builder inserts before a column is chosen.
        if (typeof c.field !== 'string' || c.field === '') continue;
        const rule: ViewFilterRule = {
            field: c.field,
            operator: normalizeFilterOperator(c.operator) as ViewFilterRule['operator'],
        };
        if (c.value !== undefined) rule.value = c.value as ViewFilterRule['value'];
        rules.push(rule);
    }

    const logic = isGroupLike(group) ? group.logic : undefined;
    if (logic === 'or' && rules.length > 1) return { ok: false, reason: 'or_logic' };

    return { ok: true, rules };
}

/** i18n key carrying the user-readable refusal for each {@link FilterFoldRefusal}. */
export const FILTER_FOLD_REFUSAL_KEYS: Record<FilterFoldRefusal, string> = {
    or_logic: 'console.objectView.filterOrNotSavable',
    nested_group: 'console.objectView.filterNestedNotSavable',
};
