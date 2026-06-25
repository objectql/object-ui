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
import { PredicateScopeProvider } from '@object-ui/react';

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
    // plus the back-compat `user` alias and the server-RLS-parity `ctx.user`
    // alias, so a predicate authored against any one form evaluates identically
    // on client, server-formula, and server-RLS.
    const context = { current_user: user, user, ctx: { user }, app, data, features };
    const evaluator = new ExpressionEvaluator(context);
    return { user, app, data, features, evaluator };
  }, [user, app, data, features]);

  // Also feed the predicate scope used by useCondition/useExpression in
  // @object-ui/react so action visibility predicates (e.g. on toolbar
  // buttons) can see deployment-level flags like features.multiOrgEnabled.
  // Mirror the canonical `current_user`/`user`/`ctx.user` aliases here too.
  const scope = useMemo(
    () => ({ current_user: user, user, ctx: { user }, app, data, features }),
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
    const evalContext = { current_user: {}, ctx: { user: {} }, ...fallback };
    return { ...fallback, evaluator: new ExpressionEvaluator(evalContext) };
  }
  return ctx;
}

/**
 * Evaluate a visibility expression.
 * Supports:
 * - boolean: true/false
 * - string "true"/"false"
 * - template expression: "${user.role === 'admin'}"
 *
 * Returns true if the item should be visible.
 */
export function evaluateVisibility(
  expression: string | boolean | undefined,
  evaluator: ExpressionEvaluator,
): boolean {
  if (expression === undefined || expression === null) return true;
  if (expression === true || expression === 'true') return true;
  if (expression === false || expression === 'false') return false;

  if (typeof expression === 'string' && expression.includes('${')) {
    try {
      const result = evaluator.evaluateCondition(expression);
      return result;
    } catch {
      return true; // Default to visible on error
    }
  }

  return true;
}
