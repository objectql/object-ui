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

import { useCallback, useMemo } from 'react';
import {
  ActionEngine,
  type ActionLocation,
  type ActionDef,
  type ActionContext,
  type ActionResult,
} from '@object-ui/core';

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

  const engine = useMemo(() => {
    const e = new ActionEngine(context);
    e.registerActions(actions);
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(actions), JSON.stringify(context)]);

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
