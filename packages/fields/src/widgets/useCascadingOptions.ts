import { useContext, useMemo } from 'react';
import {
  resolveVisibleOptions,
  isOptionGroupGated,
  resolveDependsOnFields,
  type OptionLike,
  type DependsOnInput,
} from '@object-ui/core';
import { SchemaRendererContext, usePredicateScope } from '@object-ui/react';

/**
 * Shared per-option cascading / role-gating resolution for the option widgets
 * (`SelectField` single, `MultiSelectField`) — the client half of ADR-0058
 * (#2284). Each option may carry a `visibleWhen` CEL predicate; the offered set
 * narrows against the live form record (`record.country == 'cn'`) + the global
 * predicate scope (`'admin' in current_user.positions`). A field declares which
 * sibling fields drive its list via `dependsOn`; while any is empty the list is
 * *gated* — callers surface a "select the parent first" hint rather than an
 * unfiltered set, mirroring the dependent-lookup UX.
 *
 * Extracted so single- and multi-select stay in lockstep instead of duplicating
 * the resolver + its `dependentValues` / predicate-scope wiring (#2715).
 */
export interface CascadingOptionsResult<T extends OptionLike> {
  /** Offered options after `visibleWhen` filtering. Empty while gated. */
  options: T[];
  /** True when a `dependsOn` field is empty — the list is gated. */
  gated: boolean;
  /** Normalized `dependsOn` field names (for the gate hint). */
  dependsOnFields: string[];
}

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

  const dependsOnFields = useMemo(() => resolveDependsOnFields(dependsOn), [dependsOn]);
  const gated = useMemo(
    () => dependsOnFields.length > 0 && isOptionGroupGated(dependsOn, record),
    [dependsOnFields, dependsOn, record],
  );

  // Effective (offered) options after per-option `visibleWhen` filtering. Empty
  // while gated so we never present an unfiltered set before the parent is set.
  const options = useMemo(
    () => (gated ? [] : resolveVisibleOptions(rawOptions, record, predicateScope)),
    [gated, rawOptions, record, predicateScope],
  );

  return { options, gated, dependsOnFields };
}
