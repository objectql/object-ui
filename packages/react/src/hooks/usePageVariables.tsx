/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PageVariable } from '@object-ui/types';

/**
 * Page variables context value.
 * Provides access to page-level state variables.
 */
export interface PageVariablesContextValue {
  /** Current variable values */
  variables: Record<string, any>;
  /** Set a single variable value */
  setVariable: (name: string, value: any) => void;
  /** Set multiple variable values at once */
  setVariables: (updates: Record<string, any>) => void;
  /** Reset all variables to their default values */
  resetVariables: () => void;
}

const PageVariablesContext = createContext<PageVariablesContextValue | null>(null);

/**
 * Initialize page variables from their definitions.
 * Sets each variable to its defaultValue or type-appropriate default.
 */
function initializeVariables(definitions?: PageVariable[]): Record<string, any> {
  if (!definitions || definitions.length === 0) return {};

  const initial: Record<string, any> = {};
  for (const def of definitions) {
    if (def.defaultValue !== undefined) {
      initial[def.name] = def.defaultValue;
    } else {
      // Type-appropriate defaults
      switch (def.type) {
        case 'number':
          initial[def.name] = 0;
          break;
        case 'boolean':
          initial[def.name] = false;
          break;
        case 'object':
          initial[def.name] = {};
          break;
        case 'array':
          initial[def.name] = [];
          break;
        case 'string':
        default:
          initial[def.name] = '';
          break;
      }
    }
  }
  return initial;
}

/**
 * Props for PageVariablesProvider
 */
export interface PageVariablesProviderProps {
  /** Variable definitions from PageSchema.variables */
  definitions?: PageVariable[];
  /** Child components */
  children: React.ReactNode;
}

/**
 * PageVariablesProvider — Provides page-level state variables to the component tree.
 *
 * Initializes variables from their definitions and provides read/write access
 * to all child components via the usePageVariables hook.
 *
 * @example
 * ```tsx
 * <PageVariablesProvider definitions={[
 *   { name: 'selectedId', type: 'string', defaultValue: '' },
 *   { name: 'count', type: 'number', defaultValue: 0 },
 * ]}>
 *   <MyComponents />
 * </PageVariablesProvider>
 * ```
 */
export const PageVariablesProvider: React.FC<PageVariablesProviderProps> = ({
  definitions,
  children,
}) => {
  const [variables, setVariablesState] = useState<Record<string, any>>(() =>
    initializeVariables(definitions)
  );

  const setVariable = useCallback((name: string, value: any) => {
    setVariablesState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setVariables = useCallback((updates: Record<string, any>) => {
    setVariablesState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetVariables = useCallback(() => {
    setVariablesState(initializeVariables(definitions));
  }, [definitions]);

  const value = useMemo<PageVariablesContextValue>(
    () => ({ variables, setVariable, setVariables, resetVariables }),
    [variables, setVariable, setVariables, resetVariables]
  );

  return (
    <PageVariablesContext.Provider value={value}>
      {children}
    </PageVariablesContext.Provider>
  );
};

PageVariablesProvider.displayName = 'PageVariablesProvider';

/**
 * Hook to access page-level variables.
 *
 * Returns the current variable values and setter functions.
 * Returns a no-op fallback if used outside a PageVariablesProvider.
 *
 * @example
 * ```tsx
 * const { variables, setVariable } = usePageVariables();
 * const userId = variables.selectedId;
 * setVariable('selectedId', '123');
 * ```
 */
export function usePageVariables(): PageVariablesContextValue {
  const ctx = useContext(PageVariablesContext);
  if (!ctx) {
    // Graceful fallback — allows components to work outside a Page
    return {
      variables: {},
      setVariable: () => {},
      setVariables: () => {},
      resetVariables: () => {},
    };
  }
  return ctx;
}

/**
 * Hook to check if a PageVariablesProvider is available.
 */
export function useHasPageVariables(): boolean {
  return useContext(PageVariablesContext) !== null;
}
