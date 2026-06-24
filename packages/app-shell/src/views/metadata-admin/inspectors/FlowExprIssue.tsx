// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowExprIssue — the shared inline validation line for an expression / template
 * value in the flow inspector (#1934). Renders, in precedence order:
 *   1. an ADR-0032 brace/shape ERROR (red) — CEL fields only; a genuine template
 *      uses single-brace `{var}` legally, so the brace check never runs there;
 *   2. else a scope-aware "unknown reference" WARNING (amber) — a referenced
 *      root not in scope at the node, with a "did you mean?" hint.
 * Returns null when the value is clean (or scope is unknown). Used by the picker
 * repeater cells (decision Branches, screen visibleWhen, key/value values) that
 * carry the picker but otherwise had no inline validation.
 */

import * as React from 'react';
import { validateExpressionClient, type ExprFieldRole } from './expression-validate';
import { findUnknownRefs, scopeRoots, describeUnknownRefs } from './flow-ref-check';
import type { ScopeGroup } from './useFlowScope';

export interface FlowExprIssueProps {
  value: unknown;
  /** `'predicate'` / `'value'` → CEL (brace-checked); `'template'` → `{…}` holes. */
  role: ExprFieldRole;
  scopeGroups?: ScopeGroup[];
}

export function FlowExprIssue({ value, role, scopeGroups }: FlowExprIssueProps): React.ReactElement | null {
  // Brace / shape error — CEL roles only (single-brace is valid in a template).
  const issue = role === 'template' ? null : validateExpressionClient(role, value);
  if (issue) {
    return (
      <p className="text-[11px] leading-snug text-destructive" role="alert">
        {issue.message}
      </p>
    );
  }
  const roots = scopeGroups && scopeGroups.length > 0 ? scopeRoots(scopeGroups.flatMap((g) => g.refs)) : null;
  const unknown = roots ? findUnknownRefs(value, role, roots) : [];
  return unknown.length > 0 ? (
    <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400" role="note">
      {describeUnknownRefs(unknown)}
    </p>
  ) : null;
}
