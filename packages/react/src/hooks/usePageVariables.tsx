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
  /**
   * The variable definitions backing this provider. Exposed so writer
   * elements can resolve which variable they feed via `PageVariable.source`
   * (the component id that writes to the variable) — see
   * {@link usePageVariableBinding}.
   */
  definitions: PageVariable[];
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

  const defs = useMemo<PageVariable[]>(() => definitions ?? [], [definitions]);

  const value = useMemo<PageVariablesContextValue>(
    () => ({ variables, definitions: defs, setVariable, setVariables, resetVariables }),
    [variables, defs, setVariable, setVariables, resetVariables]
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
      definitions: [],
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

/**
 * A writer binding for a page variable, resolved from a component id.
 */
export interface PageVariableBinding {
  /** The bound variable's name */
  name: string;
  /** The bound variable's current value */
  value: any;
  /** Write a new value into the bound variable */
  setValue: (value: any) => void;
}

/**
 * Resolve the page variable that a given component writes to.
 *
 * Per `@objectstack/spec`'s `PageVariableSchema`, a variable's `source`
 * names the **component id** that feeds it — e.g. a `variables` entry
 * `{ name: 'selectedProjectId', source: 'project_picker' }` is written by the
 * component whose `id` is `project_picker`. An interactive element (record
 * picker, filter, …) calls this with its own `schema.id` and writes the
 * user's selection through the returned `setValue`.
 *
 * Returns `null` when no variable targets the given component (or when called
 * outside a {@link PageVariablesProvider}), so callers can treat themselves as
 * uncontrolled in that case.
 *
 * @example
 * ```tsx
 * const binding = usePageVariableBinding(schema.id);
 * // on selection:
 * binding?.setValue(record.id);
 * ```
 */
export function usePageVariableBinding(componentId?: string): PageVariableBinding | null {
  const { variables, definitions, setVariable } = usePageVariables();
  return useMemo(() => {
    if (!componentId) return null;
    const def = definitions.find((d) => d.source === componentId);
    if (!def) return null;
    return {
      name: def.name,
      value: variables[def.name],
      setValue: (value: any) => setVariable(def.name, value),
    };
  }, [componentId, definitions, variables, setVariable]);
}
