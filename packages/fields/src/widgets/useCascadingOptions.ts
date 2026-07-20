import { useContext, useMemo } from 'react';
import {
  resolveCascadingOptions,
  type CascadingOptions,
  type OptionLike,
  type DependsOnInput,
} from '@object-ui/core';
import { SchemaRendererContext, usePredicateScope } from '@object-ui/react';

/**
 * Shared per-option cascading / role-gating resolution for the option widgets
 * (`SelectField` single, `MultiSelectField`, `RadioField`) — the client half of
 * ADR-0058 (#2284). Each option may carry a `visibleWhen` CEL predicate; the
 * offered set narrows against the live form record (`record.country == 'cn'`) +
 * the global predicate scope (`'admin' in current_user.positions`). A field
 * declares which sibling fields drive its list via `dependsOn`; while any is
 * empty the list is *gated* — callers surface a "select the parent first" hint
 * rather than an unfiltered set, mirroring the dependent-lookup UX.
 *
 * This is the React wrapper that sources `record` (the live form values) and the
 * predicate scope from context; the actual resolution is the pure
 * {@link resolveCascadingOptions} in `@object-ui/core`, shared with the form
 * renderer so gating/filtering can never drift between them (#2715).
 */
export type CascadingOptionsResult<T extends OptionLike> = CascadingOptions<T>;

export function useCascadingOptions<T extends OptionLike>(
  rawOptions: readonly T[],
  dependsOn: DependsOnInput,
  dependentValues: Record<string, unknown> | undefined,
): CascadingOptionsResult<T> {
  // Live form values for cascading options — injected by the form renderer as
  // `dependentValues` (same channel dependent lookups use), falling back to the
  // record on SchemaRendererContext. `current_user` etc. come from the global
  // predicate scope so role/context predicates resolve too.
  const ctx = useContext(SchemaRendererContext) as any;
  const record = useMemo<Record<string, unknown>>(() => {
    return (dependentValues ?? ctx?.formValues ?? ctx?.data ?? {}) as Record<string, unknown>;
  }, [dependentValues, ctx?.formValues, ctx?.data]);
  const predicateScope = usePredicateScope();

  return useMemo(
    () => resolveCascadingOptions(rawOptions, record, dependsOn, predicateScope),
    [rawOptions, record, dependsOn, predicateScope],
  );
}
