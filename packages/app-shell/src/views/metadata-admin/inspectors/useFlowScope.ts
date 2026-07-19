// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useFlowScope — React adapter over the pure {@link resolveFlowScope} graph-walk
 * that powers the inspector's variable data-picker (#1934).
 *
 * It resolves the graph-aware refs synchronously, then lazily fetches the
 * trigger object's field catalog (via the shared metadata client) and merges
 * the expanded `record.<field>` refs in — grouping everything into the ordered
 * sections the picker renders. An empty result (`isEmpty`) tells the field to
 * degrade to a plain input.
 */

import * as React from 'react';
import {
  resolveFlowScope,
  triggerFieldRefs,
  type ScopeGroupId,
  type ScopeRef,
} from './flow-scope';
import { useObjectFields } from '../previews/useObjectFields';

export interface ScopeGroup {
  id: ScopeGroupId;
  label: string;
  refs: ScopeRef[];
}

export interface UseFlowScopeResult {
  /** Non-empty groups, in display order. */
  groups: ScopeGroup[];
  /** Flat, de-duplicated ref list (all groups). */
  refs: ScopeRef[];
  /** True while the trigger object's fields are still loading. */
  loading: boolean;
  /** No references in scope — the field should render as a plain input. */
  isEmpty: boolean;
}

const GROUP_ORDER: ScopeGroupId[] = ['variables', 'outputs', 'loop', 'trigger'];
const GROUP_LABELS: Record<ScopeGroupId, string> = {
  variables: 'Flow variables',
  outputs: 'Upstream outputs',
  loop: 'Loop item',
  trigger: 'Trigger record',
};

/**
 * Resolve + (async) expand the in-scope references at a flow node. `draft` is
 * the whole flow draft; `nodeId` the node being edited (for an edge, pass its
 * source node id — references available on an edge are those in scope at its
 * source).
 *
 * `extraRefs` are merged in before de-dup / grouping — used for a NESTED node,
 * whose scope anchor is its container (ADR-0031 outer scope): the container's
 * own outputs are excluded from the graph walk at its id, so a loop's
 * `iteratorVariable` must be injected explicitly for a body node to see it. Pass
 * a memoized array (a fresh one every render would thrash the memo).
 */
export function useFlowScope(
  draft: Record<string, unknown> | undefined,
  nodeId: string | undefined,
  extraRefs?: ReadonlyArray<ScopeRef>,
): UseFlowScopeResult {
  const scope = React.useMemo(() => resolveFlowScope(draft ?? {}, nodeId), [draft, nodeId]);
  const { fields, loading } = useObjectFields(scope.trigger?.objectName);

  return React.useMemo(() => {
    const all: ScopeRef[] = [...scope.refs];
    if (extraRefs && extraRefs.length) all.push(...extraRefs);
    if (scope.trigger) all.push(...triggerFieldRefs(scope.trigger, fields));
    // Global de-dup by token (a declared var also written upstream shows once).
    const seen = new Set<string>();
    const refs = all.filter((r) => (seen.has(r.token) ? false : (seen.add(r.token), true)));
    const groups = GROUP_ORDER.map((id) => ({
      id,
      label: GROUP_LABELS[id],
      refs: refs.filter((r) => r.group === id),
    })).filter((g) => g.refs.length > 0);
    return { groups, refs, loading: !!scope.trigger && loading, isEmpty: refs.length === 0 };
  }, [scope, fields, loading, extraRefs]);
}
