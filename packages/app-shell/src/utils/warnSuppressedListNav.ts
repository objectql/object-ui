/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0053: on an object's default list ("views" mode) the ViewTabBar is the
 * only navigation control — `userFilters` / `quickFilters` belong to page
 * lists (InterfaceListPage, "filters" mode) and are suppressed by
 * `ObjectView.renderListView`.
 *
 * The suppression is correct, but until the phase-4 guardrail (zod `refine`
 * + `check` rule) lands, an author who puts `userFilters` on an object list
 * view gets a valid schema and a page that renders nothing where they expect
 * filter controls — zero signal at any layer (#2219). Surface the drop with
 * a one-shot console warning per object/view.
 *
 * Returns whether the view carried a suppressed field (mainly for tests).
 */
const warned = new Set<string>();

export function warnSuppressedListNav(
    objectName: string,
    viewId: string,
    viewDef: Record<string, unknown> | null | undefined,
    listSchema: Record<string, unknown> | null | undefined,
): boolean {
    const offending = (['userFilters', 'quickFilters'] as const).filter(
        (k) => (viewDef?.[k] ?? listSchema?.[k]) != null,
    );
    if (offending.length === 0) return false;
    const key = `${objectName}.${viewId}`;
    if (!warned.has(key)) {
        warned.add(key);
        console.warn(
            `[ObjectView] View "${viewId}" on object "${objectName}" defines ` +
                `${offending.join(' and ')}, which are ignored on an object list view ` +
                `(ADR-0053 "views" mode — the view switcher is the only nav control here). ` +
                `Move them to a page list (InterfaceListPage "filters" mode).`,
        );
    }
    return true;
}

/** Test-only: clear the one-shot warning memory. */
export function resetSuppressedListNavWarnings(): void {
    warned.clear();
}
