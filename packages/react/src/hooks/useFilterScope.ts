/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import type { FilterTokenScope } from '@object-ui/core';

/**
 * The session values filter placeholders resolve against — `{current_user_id}`
 * and `{current_org_id}` (framework #3574).
 *
 * ## Why a dedicated context
 *
 * The renderer packages (`plugin-dashboard`, `plugin-charts`, `plugin-list`)
 * deliberately do not depend on `@object-ui/auth`; they receive everything
 * they need as schema or context. But a widget cannot resolve
 * `{current_user_id}` without knowing who is signed in, and the surfaces that
 * DO know (the app-shell) sit above them.
 *
 * `PredicateScopeContext` already carries `current_user` and would have
 * covered the user id, but it is the *expression* evaluation scope — it
 * carries no organization, and widening it for an unrelated consumer would
 * couple filter resolution to predicate semantics. A separate, two-field
 * context keeps the contract explicit and lets a non-console host provide
 * exactly these values without adopting the expression stack.
 *
 * When no provider is mounted this returns an empty scope. That is a safe
 * default: unresolved tokens are left intact by the resolver, so the filter
 * matches nothing rather than silently widening, and the resolver emits one
 * warning naming the token.
 */
const FilterScopeContext = createContext<FilterTokenScope>({});

/**
 * Provide the session scope used to resolve filter placeholders.
 *
 * Mount once, above any surface that renders filtered data. The console shell
 * mounts it next to `ExpressionProvider`, where both the signed-in user and
 * the active organization are already resolved.
 */
export function FilterScopeProvider({
  currentUserId,
  currentOrgId,
  children,
}: {
  currentUserId?: string | null;
  currentOrgId?: string | null;
  children: ReactNode;
}) {
  const value = useMemo<FilterTokenScope>(
    () => ({ currentUserId, currentOrgId }),
    [currentUserId, currentOrgId],
  );
  return createElement(FilterScopeContext.Provider, { value }, children);
}

/**
 * Read the session scope for filter placeholder resolution.
 *
 * Pass the result straight to `resolveFilterPlaceholders(filter, scope)` from
 * `@object-ui/core` — that helper expands every placeholder vocabulary in one
 * call, which is the point: resolving only some of them is the defect behind
 * #3574.
 */
export function useFilterScope(): FilterTokenScope {
  return useContext(FilterScopeContext);
}
