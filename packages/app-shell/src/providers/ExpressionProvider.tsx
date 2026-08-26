/**
 * ExpressionContext Provider
 *
 * Provides expression evaluation context (user, app, data) to all child components.
 * Used by useCondition/useExpression hooks from @object-ui/react to evaluate
 * dynamic visibility, disabled, and hidden expressions in navigation items,
 * fields, and components.
 *
 * @example
 * ```tsx
 * <ExpressionProvider user={currentUser} app={activeApp}>
 *   <AppSidebar />
 * </ExpressionProvider>
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react';
import { ExpressionEvaluator } from '@object-ui/core';
import { PredicateScopeProvider, reportUnresolvableVisibilityPredicate } from '@object-ui/react';

export interface ExpressionContextValue {
  /** Current authenticated user */
  user: Record<string, any>;
  /** Active application config */
  app: Record<string, any>;
  /** Additional data scope */
  data: Record<string, any>;
  /**
   * Deployment-level feature flags surfaced by `/api/v1/auth/config`
   * (e.g. `multiOrgEnabled`). Used by CEL/template predicates on
   * metadata actions and views to hide entries that would otherwise
   * hit a forbidden endpoint. Empty `{}` when auth config hasn't
   * loaded yet — predicates should default to "visible" in that case
   * (see `sys_organization.create_organization.visible`).
   */
  features: Record<string, any>;
  /** The evaluator instance (for imperative use) */
  evaluator: ExpressionEvaluator;
}

const ExprCtx = createContext<ExpressionContextValue | null>(null);

interface ExpressionProviderProps {
  children: React.ReactNode;
  user?: Record<string, any>;
  app?: Record<string, any>;
  data?: Record<string, any>;
  features?: Record<string, any>;
}

export function ExpressionProvider({ children, user = {}, app = {}, data = {}, features = {} }: ExpressionProviderProps) {
  const value = useMemo(() => {
    // ADR-0068: expose the SAME user object under the canonical `current_user`
    // plus the back-compat `user` alias, the server-RLS-parity `ctx.user`
    // alias, and the server-CEL-parity `os.user` alias (the spec's canonical
    // identity scope — `{{os.user.id}}` per @objectstack/spec expression docs),
    // so a predicate authored against any one form evaluates identically on
    // client, server-formula, and server-RLS (#2358 trap 1).
    const context = { current_user: user, user, ctx: { user }, os: { user }, app, data, features };
    const evaluator = new ExpressionEvaluator(context);
    return { user, app, data, features, evaluator };
  }, [user, app, data, features]);

  // Also feed the predicate scope used by useCondition/useExpression in
  // @object-ui/react so action visibility predicates (e.g. on toolbar
  // buttons) can see deployment-level flags like features.multiOrgEnabled.
  // Mirror the canonical `current_user`/`user`/`ctx.user`/`os.user` aliases
  // here too.
  const scope = useMemo(
    () => ({ current_user: user, user, ctx: { user }, os: { user }, app, data, features }),
    [user, app, data, features],
  );

  return (
    <ExprCtx.Provider value={value}>
      <PredicateScopeProvider scope={scope}>{children}</PredicateScopeProvider>
    </ExprCtx.Provider>
  );
}

/**
 * Hook to access the expression context.
 * Returns the full context value or a default empty context.
 */
export function useExpressionContext(): ExpressionContextValue {
  const ctx = useContext(ExprCtx);
  if (!ctx) {
    // Return a safe default so components can be used outside the provider
    const fallback = { user: {}, app: {}, data: {}, features: {} };
    const evalContext = { current_user: {}, ctx: { user: {} }, os: { user: {} }, ...fallback };
    return { ...fallback, evaluator: new ExpressionEvaluator(evalContext) };
  }
  return ctx;
}

/**
 * The `type` slot of the shared visibility-fault reporter, for THIS surface
 * (objectui#6443).
 *
 * ## Why the slot needed a decision at all
 *
 * `reportUnresolvableVisibilityPredicate` (@object-ui/react, objectui#6038)
 * dedupes on `(type, key, predicate source)` — `id` rides along in the printed
 * line but is deliberately NOT in the key. So whatever goes in `type` sets this
 * site's RATE LIMIT, and a nav item is not a schema node: there is no
 * `schema.type` to hand over.
 *
 * ## Why a CONSTANT, and not the item's identity
 *
 * The choice is between a constant (one line per distinct authored predicate
 * SOURCE) and something per-item (one line per menu entry). Measured against
 * the three cases that can actually occur:
 *
 *   - two entries, two different broken predicates -> BOTH keys already differ
 *     on `source`, so both report either way. No difference.
 *   - two entries sharing ONE broken predicate (the copy-pasted role gate, the
 *     common shape) -> a constant reports ONCE, which is correct: it is one
 *     authoring mistake, in one string, fixed in one edit. A per-item key would
 *     report once per entry and add no information — same text, same reason.
 *   - one entry, evaluated many times -> both dedupe. This site is re-entered
 *     more than a node gate is: `hasVisibleNavigationItems` re-runs every item
 *     predicate to DERIVE area visibility (objectui#3311) before
 *     `NavigationRenderer` runs them again to render, and both re-run on every
 *     sidebar re-render.
 *
 * A per-item key is therefore never better and sometimes much worse. It is also
 * unreachable without widening `VisibilityEvaluator` (@object-ui/layout), whose
 * whole signature is `(expression) => boolean` — a cross-package public type
 * change this diagnostics-only card does not get to make. The predicate SOURCE
 * is the locator instead, and it is in both the key and the printed line: it is
 * the string an author greps their metadata for, and it is unique to the bug in
 * a way an item id is not.
 *
 * ## Why this spelling
 *
 * Namespaced with a colon, like `page:tabs` (the other non-node surface wired to
 * this reporter). It names the app-shell `visible` GATE, not a component key —
 * `app-shell` is deliberately NOT a registry key (objectui#4841), and the colon
 * keeps this label out of that bare namespace so a diagnostic can never be read
 * as claiming one.
 *
 * It is deliberately NOT `nav:item`, even though this card is written about nav
 * and area items: `evaluateVisibility` is also the gate `RecordFormPage` runs
 * over an object's field `visible` predicates, and labelling those "nav" would
 * be false. The consequence is stated rather than hidden — a nav item and a
 * form field carrying the IDENTICAL broken predicate text share one dedupe
 * entry and produce one line. That is still one typo in one string; the line
 * names the string, which is what both sites are grepped by.
 */
const APP_SHELL_VISIBLE_SURFACE = 'app-shell:visible';

/**
 * Evaluate a visibility expression.
 * Supports:
 * - boolean: true/false
 * - string "true"/"false"
 * - template expression: "${user.role === 'admin'}"
 * - `{ dialect: 'cel', source }` envelopes — the shape the spec's
 *   `ExpressionInputSchema` normalizes every authored `visible` string into,
 *   which is what nav/area items carry after the server serves the app schema
 * - bare expression strings (evaluated as one boolean expression)
 *
 * Everything non-literal is delegated to `evaluator.evaluateCondition`, which
 * routes CEL envelopes to the canonical `@objectstack/formula` engine. The
 * envelope and bare-string shapes used to fall through to a blanket
 * `return true`, so a constant-false nav `visible` predicate (e.g.
 * ``P`'org_admin' in current_user.positions` ``) still rendered for everyone —
 * the app author had no working way to hide a menu item by role.
 *
 * Returns true if the item should be visible (fail-open on evaluation errors,
 * matching the evaluator's own default).
 */
export function evaluateVisibility(
  expression: string | boolean | { dialect?: string; source?: string } | undefined,
  evaluator: ExpressionEvaluator,
): boolean {
  if (expression === undefined || expression === null) return true;
  if (expression === true || expression === 'true') return true;
  if (expression === false || expression === 'false') return false;

  // objectui#6443 — the fault is REPORTED now, and the verdict is untouched.
  //
  // `evaluateCondition` is fail-soft: it answers an unevaluable predicate with
  // `true` from its OWN catch and does not throw, so the `catch` below never
  // saw a predicate fault and this site swallowed every one of them in
  // silence — in production AND in development, which is what made it worse
  // than the node gate objectui#6038 fixed. `onFault` is the only channel that
  // reaches that swallowed fault, and it costs nothing: no `throwOnError`
  // second evaluation, same single engine call as before.
  //
  // FAIL-OPEN IS UNCHANGED, deliberately. A predicate that cannot be evaluated
  // still returns `true`, so the nav item, area or field still renders for
  // everyone — including the role the predicate was written to exclude. That is
  // the shipped permission-boundary semantics; flipping it to fail-closed is a
  // behaviour change, not a diagnostic, and it is not this card's to make. This
  // card makes the silence stop, nothing else.
  const report = (reason: unknown): void =>
    reportUnresolvableVisibilityPredicate(
      APP_SHELL_VISIBLE_SURFACE,
      undefined,
      'visible',
      expression,
      reason,
      // objectui#6487. Until this argument existed the line closed with the
      // NODE tier's advice, telling an author whose nav predicate faulted to
      // check `record` and `page.<var>` — two roots the bag built in
      // `ExpressionProvider` above does not contain at all — while the identity
      // aliases, `app` and `features` that it DOES contain went unnamed.
      'app-shell',
    );

  try {
    return evaluator.evaluateCondition(expression, { onFault: report });
  } catch (err) {
    // Defensive, and now loud too: `evaluateCondition` handles its own faults,
    // so reaching here means the evaluator itself threw. That path returned the
    // same fail-open `true` in silence; it no longer does.
    report(err);
    return true; // Default to visible on error
  }
}
