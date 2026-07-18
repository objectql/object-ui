/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { ExpressionEvaluator, evalRowPredicate } from '@object-ui/core';

/**
 * Global predicate scope — populated by host shells (e.g. app-shell's
 * `ExpressionProvider`) so renderers like action buttons can resolve
 * deployment-level flags (`features`, `user`, `app`, …) without needing
 * to import the host shell directly.
 *
 * `useCondition` / `useExpression` merge this scope under the
 * locally-passed `context`, so per-row `record` overrides still win.
 * Defaults to an empty object so components used outside a provider
 * keep behaving exactly as before.
 */
const PredicateScopeContext = createContext<Record<string, any>>({});

/**
 * Provider for the global predicate scope. Wraps children so any
 * descendant `useCondition` / `useExpression` call has access to
 * top-level variables (e.g. `features.multiOrgEnabled`).
 *
 * Most consumers should not use this directly — the app-shell's
 * `ExpressionProvider` already feeds it. It's exported for hosts that
 * want a custom shell.
 */
export function PredicateScopeProvider({
  scope,
  children,
}: {
  scope: Record<string, any>;
  children: ReactNode;
}) {
  return createElement(PredicateScopeContext.Provider, { value: scope }, children);
}

/**
 * Read the current global predicate scope. Returns an empty object when
 * no provider is mounted.
 */
export function usePredicateScope(): Record<string, any> {
  return useContext(PredicateScopeContext);
}

/**
 * Normalize a schema-supplied predicate (`visible` / `enabled` / `disabled` /
 * `hidden`) into the `${expr}` template form expected by `useCondition`.
 *
 * Accepts:
 *   - `boolean` → returned as-is (predicate hooks short-circuit on booleans).
 *   - `string`  → wrapped as `${string}` (legacy DX shorthand).
 *   - `Expression` envelope `{ dialect, source }` (new format from
 *     `@objectstack/spec`'s normalized predicate inputs) → unwrapped, then
 *     wrapped as `${source}`. Both `cel` and `template` dialects already use
 *     compatible variable syntax (`record.x`, etc.).
 *   - `null` / `undefined` / empty → `undefined` (default visible/enabled).
 *
 * This is the canonical helper to use in renderers so we never end up with
 * `${[object Object]}` after JS template-literal interpolation.
 */
export function toPredicateInput(
  value: unknown,
): string | boolean | { dialect: 'cel'; source: string } | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return `\${${value}}`;
  if (typeof value === 'object' && typeof (value as any).source === 'string') {
    const src = (value as any).source as string;
    if (!src) return undefined;
    // #2661 — preserve a CEL-dialect envelope so `useCondition` routes it to the
    // canonical `@objectstack/formula` engine (identical verdict to the server),
    // instead of collapsing it to a `${source}` string on the legacy JS path.
    // Every other dialect (template / unset) keeps the legacy `${…}` behavior.
    if ((value as any).dialect === 'cel') return { dialect: 'cel', source: src };
    return `\${${src}}`;
  }
  return undefined;
}

/**
 * Hook for evaluating expressions with dynamic context
 * 
 * @example
 * ```tsx
 * const isVisible = useExpression('${data.age >= 18}', { data });
 * const label = useExpression('Hello ${user.name}!', { user });
 * ```
 */
export function useExpression(
  expression: string | boolean | number | null | undefined,
  context: Record<string, any> = {}
): any {
  const scope = usePredicateScope();
  // We evaluate directly without caching the evaluator to avoid issues with context changes
  return useMemo(
    () => {
      // Merge global scope under the local context — local wins so per-row
      // `record` overrides still take precedence over `features` etc.
      const evaluator = new ExpressionEvaluator({ ...scope, ...context });
      return evaluator.evaluate(expression);
    },
    [expression, context, scope]
  );
}

/**
 * Hook for evaluating conditional expressions
 * Returns a boolean value
 * 
 * @example
 * ```tsx
 * const isVisible = useCondition('${data.status === "active"}', { data });
 * ```
 */
/** One-time registry for fail-closed predicate warnings (see useCondition). */
const _warnedConditions = new Set<string>();

export function useCondition(
  condition: string | boolean | undefined | { dialect?: string; source?: string },
  context: Record<string, any> = {},
  options?: { throwOnError?: boolean; label?: string }
): boolean {
  const scope = usePredicateScope();
  // We evaluate directly without caching the evaluator to avoid issues with context changes
  return useMemo(
    () => {
      const evaluator = new ExpressionEvaluator({ ...scope, ...context });
      if (options?.throwOnError) {
        // Fail-closed: a predicate that can't be evaluated hides/disables
        // rather than defaulting to visible — mirrors ActionEngine's
        // getActionsForLocation contract, opted into by callers gating a
        // real action rather than passive display content.
        try {
          return evaluator.evaluateCondition(condition, { throwOnError: true });
        } catch (err) {
          // A throwing predicate is almost always an authoring bug (wrong
          // scope variable, bare field reference) — warn once per
          // (label, predicate) so the silent hide is diagnosable (#2358)
          // without spamming re-renders.
          const src = typeof condition === 'string' ? condition : String(condition);
          const key = `${options?.label ?? ''}::${src}`;
          if (!_warnedConditions.has(key)) {
            _warnedConditions.add(key);
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(
              `[object-ui] ${options?.label ?? 'a component'} was hidden/disabled: ` +
              `its predicate threw — ${msg}. Predicate: ${src}.`,
            );
          }
          return false;
        }
      }
      return evaluator.evaluateCondition(condition);
    },
    [condition, context, scope, options?.throwOnError, options?.label]
  );
}

/**
 * Evaluate a **row-scoped predicate** (a row-action `visible` / `disabled`, or a
 * conditional-formatting `condition`) against a record on the canonical CEL
 * engine — the same engine the server uses (issue #1584 / ADR-0058).
 *
 * Unlike {@link useCondition} (schema/widget tier, legacy `${}` dialect), this
 * routes to `@object-ui/core`'s `evalRowPredicate`: a bare string is CEL (the
 * spec contract for `ActionSchema.visible`), a `{ dialect: 'cel', source }`
 * envelope is always CEL, and only a legacy-dialect string falls back to the
 * old engine (with a deprecation warning). The row is bound as `record.*` and
 * bare fields; the ambient predicate scope (`features` / `user` / …) is merged
 * alongside so deployment-level gates keep resolving.
 *
 * @param pred     The raw predicate: `boolean` (returned as-is), a CEL string,
 *                 an `{ dialect, source }` envelope, or `null`/`undefined`/`''`.
 * @param row      The row record to evaluate against.
 * @param options  `fallback` — value when the predicate is absent or faults
 *                 (default `true`); `warnOnError` — log when a present predicate
 *                 faults (fail-soft-but-logged, ADR-0058); `label` — for the log.
 */
export function useRowPredicate(
  pred: unknown,
  row: Record<string, any> | null | undefined,
  options?: { fallback?: boolean; warnOnError?: boolean; label?: string },
): boolean {
  const scope = usePredicateScope();
  const fallback = options?.fallback ?? true;
  return useMemo(
    () => {
      // A boolean predicate short-circuits (no expression to evaluate).
      if (typeof pred === 'boolean') return pred;
      if (pred == null || pred === '') return fallback;
      return evalRowPredicate(pred as string | { dialect?: string; source: string }, row ?? {}, {
        fallback,
        scope,
        warnOnError: options?.warnOnError,
        label: options?.label,
      });
    },
    [pred, row, scope, fallback, options?.warnOnError, options?.label],
  );
}
