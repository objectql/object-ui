/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useActionEngine — React hook wrapping ActionEngine for location-based action management.
 *
 * Provides declarative access to the ActionEngine's location filtering, bulk operations,
 * keyboard shortcut handling, and execution pipeline from React components.
 *
 * @example
 * ```tsx
 * const { getActionsForLocation, executeAction } = useActionEngine({
 *   actions: schema.actions,
 *   context: { record, user },
 * });
 *
 * const toolbarActions = getActionsForLocation('list_toolbar');
 * ```
 */

import { useCallback, useContext, useMemo } from 'react';
import {
  ActionEngine,
  type ActionLocation,
  type ActionDef,
  type ActionContext,
  type ActionResult,
} from '@object-ui/core';
import { ActionCtxReact } from '../context/ActionContext.js';

export interface UseActionEngineOptions {
  /** Action definitions to register */
  actions?: ActionDef[];
  /** Action context (record, user, etc.) */
  context?: ActionContext;
}

export interface UseActionEngineReturn {
  /** Get actions available at a specific location, sorted by priority */
  getActionsForLocation: (location: ActionLocation) => ActionDef[];
  /** Get actions that support bulk operations */
  getBulkActions: () => ActionDef[];
  /** Execute an action by name */
  executeAction: (name: string, contextOverride?: Partial<ActionContext>) => Promise<ActionResult>;
  /** Handle a keyboard shortcut */
  handleShortcut: (keys: string) => Promise<ActionResult | null>;
  /** The underlying ActionEngine instance */
  engine: ActionEngine;
}

export function useActionEngine(options: UseActionEngineOptions = {}): UseActionEngineReturn {
  const { actions = [], context = {} } = options;
  // When wrapped in an <ActionProvider>, reuse its ActionRunner so that:
  //   • Visibility / disabled / condition CEL expressions evaluate against
  //     the same context (user, datasource, etc.) the provider was seeded
  //     with — not just the per-call `context` arg.
  //   • Action execution (executeAction / handleShortcut) inherits the
  //     provider's confirm / param-collection / modal / result-dialog /
  //     toast / navigate handlers. Without sharing, a nested engine would
  //     silently no-op on any action that declares `params: [...]` or
  //     `confirmText`, because its local runner has no handlers installed.
  // When no provider is present (unit tests, standalone playgrounds), we
  // fall back to a self-contained runner constructed from the `context` arg.
  const providerCtx = useContext(ActionCtxReact);
  const sharedRunner = providerCtx?.runner ?? null;

  const engine = useMemo(() => {
    // When standalone (no surrounding `<ActionProvider>`), normalize the
    // context so predicates can use both `record`/`user` and `ctx.*`.
    const normalizedStandalone = (context && Object.keys(context).length > 0)
      ? {
          ...context,
          ctx: ((context as any).ctx && typeof (context as any).ctx === 'object')
            ? { ...context, ...(context as any).ctx }
            : { ...context },
        }
      : context;
    const e = sharedRunner ? new ActionEngine(sharedRunner) : new ActionEngine(normalizedStandalone as any);
    // When sharing a provider runner, MERGE per-render flat keys into the
    // existing `ctx` instead of overwriting it. The provider seeds
    // `ctx: { record, user, objectName, … }` once; if we replaced it with
    // just `ctx: { record, recordId, objectName }` here we would erase
    // `ctx.user` and every `record.id == ctx.user.id` predicate would
    // evaluate against `undefined.id` (→ throws → hidden).
    if (sharedRunner && context && Object.keys(context).length > 0) {
      const runner = e.getRunner();
      const existing = runner.getEvaluator().getContext().toObject() as Record<string, any>;
      const existingCtx = (existing && typeof existing.ctx === 'object') ? existing.ctx : {};
      const callerCtx = ((context as any).ctx && typeof (context as any).ctx === 'object')
        ? (context as any).ctx
        : context;
      const merged = {
        ...context,
        ctx: { ...existingCtx, ...callerCtx },
      };
      runner.updateContext(merged as any);
    }
    e.registerActions(actions);
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedRunner, JSON.stringify(actions), JSON.stringify(context)]);

  const getActionsForLocation = useCallback(
    (location: ActionLocation) => engine.getActionsForLocation(location),
    [engine],
  );

  const getBulkActions = useCallback(() => engine.getBulkActions(), [engine]);

  const executeAction = useCallback(
    (name: string, contextOverride?: Partial<ActionContext>) =>
      engine.executeAction(name, contextOverride),
    [engine],
  );

  const handleShortcut = useCallback(
    (keys: string) => engine.handleShortcut(keys),
    [engine],
  );

  return { getActionsForLocation, getBulkActions, executeAction, handleShortcut, engine };
}
