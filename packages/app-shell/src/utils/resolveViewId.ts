/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Resolve a URL-requested view name against the object's actual view ids.
 *
 * Canonical view ids are fully qualified (`<object>.<viewKind>`, see
 * MetadataProvider), but nav items emit their `viewName` verbatim — usually
 * the short form — and legacy embedded listViews carry bare keys (including
 * the `'all'` fallback view). Accept both directions (#2217):
 *
 * 1. exact id match;
 * 2. short name (no `.`) → retry as `<objectName>.<name>`;
 * 3. qualified name → retry with the `<objectName>.` prefix stripped.
 *
 * Returns the matching view id, or `undefined` when nothing matches — the
 * caller decides how to fall back (and should warn rather than swallow it).
 */
export function resolveViewId(
    requested: string | undefined | null,
    viewIds: readonly string[],
    objectName: string,
): string | undefined {
    if (!requested) return undefined;
    const has = (id: string) => viewIds.includes(id);
    if (has(requested)) return requested;
    const prefix = `${objectName}.`;
    if (!requested.includes('.') && has(prefix + requested)) {
        return prefix + requested;
    }
    if (requested.startsWith(prefix) && has(requested.slice(prefix.length))) {
        return requested.slice(prefix.length);
    }
    return undefined;
}
