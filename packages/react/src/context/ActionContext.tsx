/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/react - Action Context
 *
 * Provides a shared ActionRunner instance and handlers to the component tree.
 * Components can consume actions without creating their own runner instances.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  ActionRunner,
  type ActionContext as ActionCtx,
  type ActionDef,
  type ActionResult,
  type ConfirmationHandler,
  type ToastHandler,
  type ModalHandler,
  type NavigationHandler,
} from '@object-ui/core';

export interface ActionProviderProps {
  children: React.ReactNode;
  /** Initial action context (record, user, data, etc.) */
  context?: ActionCtx;
  /** Custom confirmation handler (e.g., Shadcn AlertDialog) */
  onConfirm?: ConfirmationHandler;
  /** Custom toast handler (e.g., Sonner) */
  onToast?: ToastHandler;
  /** Custom modal handler — render modals in response to modal actions */
  onModal?: ModalHandler;
  /** Custom navigation handler — SPA-aware routing (e.g., React Router navigate) */
  onNavigate?: NavigationHandler;
  /** Pre-registered custom action handlers */
  handlers?: Record<string, (action: ActionDef, ctx: ActionCtx) => Promise<ActionResult>>;
}

interface ActionContextValue {
  /** Execute an action */
  execute: (action: ActionDef) => Promise<ActionResult>;
  /** Execute multiple actions in chain */
  executeChain: (actions: ActionDef[], mode?: 'sequential' | 'parallel') => Promise<ActionResult>;
  /** Whether an action is currently being executed */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Last action result */
  result: ActionResult | null;
  /** The underlying ActionRunner instance */
  runner: ActionRunner;
  /** Update context data */
  updateContext: (ctx: Partial<ActionCtx>) => void;
}

const ActionCtxReact = createContext<ActionContextValue | null>(null);

/**
 * ActionProvider — Provides a shared ActionRunner to the tree.
 *
 * @example
 * ```tsx
 * <ActionProvider
 *   context={{ record: currentRecord, user }}
 *   onToast={(msg, opts) => toast[opts?.type ?? 'info'](msg)}
 *   onConfirm={async (msg) => showConfirmDialog(msg)}
 *   onNavigate={(url) => router.push(url)}
 * >
 *   <SchemaRenderer schema={pageSchema} />
 * </ActionProvider>
 * ```
 */
export const ActionProvider: React.FC<ActionProviderProps> = ({
  children,
  context = {},
  onConfirm,
  onToast,
  onModal,
  onNavigate,
  handlers,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const runner = useMemo(() => {
    const r = new ActionRunner(context);
    if (onConfirm) r.setConfirmHandler(onConfirm);
    if (onToast) r.setToastHandler(onToast);
    if (onModal) r.setModalHandler(onModal);
    if (onNavigate) r.setNavigationHandler(onNavigate);
    if (handlers) {
      Object.entries(handlers).forEach(([name, handler]) => {
        r.registerHandler(name, handler);
      });
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(context)]);

  const execute = useCallback(
    async (action: ActionDef): Promise<ActionResult> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const actionResult = await runner.execute(action);
        setResult(actionResult);
        if (!actionResult.success) {
          setError(actionResult.error || 'Action failed');
        }
        return actionResult;
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        const failureResult: ActionResult = { success: false, error: errorMessage };
        setResult(failureResult);
        return failureResult;
      } finally {
        setLoading(false);
      }
    },
    [runner],
  );

  const executeChain = useCallback(
    async (actions: ActionDef[], mode?: 'sequential' | 'parallel'): Promise<ActionResult> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const actionResult = await runner.executeChain(actions, mode);
        setResult(actionResult);
        if (!actionResult.success) {
          setError(actionResult.error || 'Chain failed');
        }
        return actionResult;
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        const failureResult: ActionResult = { success: false, error: errorMessage };
        setResult(failureResult);
        return failureResult;
      } finally {
        setLoading(false);
      }
    },
    [runner],
  );

  const updateContext = useCallback(
    (newContext: Partial<ActionCtx>) => {
      runner.updateContext(newContext);
    },
    [runner],
  );

  const value = useMemo<ActionContextValue>(
    () => ({ execute, executeChain, loading, error, result, runner, updateContext }),
    [execute, executeChain, loading, error, result, runner, updateContext],
  );

  return (
    <ActionCtxReact.Provider value={value}>{children}</ActionCtxReact.Provider>
  );
};

ActionProvider.displayName = 'ActionProvider';

/**
 * Hook to consume the ActionProvider context.
 * Returns the shared ActionRunner execute function, loading state, and more.
 *
 * Falls back to a local ActionRunner if no ActionProvider is present.
 */
export function useAction(): ActionContextValue {
  const ctx = useContext(ActionCtxReact);
  if (!ctx) {
    // Graceful fallback: create a local runner
    // This allows action components to work even without an ActionProvider
    const runner = new ActionRunner();
    return {
      execute: (action: ActionDef) => runner.execute(action),
      executeChain: (actions: ActionDef[], mode?: 'sequential' | 'parallel') =>
        runner.executeChain(actions, mode),
      loading: false,
      error: null,
      result: null,
      runner,
      updateContext: (ctx: Partial<ActionCtx>) => runner.updateContext(ctx),
    };
  }
  return ctx;
}

/**
 * Hook to check if an ActionProvider is available.
 */
export function useHasActionProvider(): boolean {
  return useContext(ActionCtxReact) !== null;
}
