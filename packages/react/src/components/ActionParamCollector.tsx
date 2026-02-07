/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionParamCollector
 *
 * A dialog-based UI for collecting ActionParam values before executing an action.
 * When an action defines `params: ActionParam[]`, this component renders a form
 * inside a dialog and resolves with the collected parameter values.
 *
 * @module components/ActionParamCollector
 */

import React, { useState, useCallback, createContext, useContext, useMemo } from 'react';
import type { ActionParam } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionParamValues {
  [key: string]: unknown;
}

export interface ActionParamCollectorState {
  /** Whether the param collection dialog is open */
  isOpen: boolean;
  /** The action params to collect */
  params: ActionParam[];
  /** The action label (for dialog title) */
  actionLabel: string;
  /** Resolve callback when params are collected */
  onSubmit: (values: ActionParamValues) => void;
  /** Reject callback when dialog is cancelled */
  onCancel: () => void;
}

/**
 * Function signature for the param collector trigger.
 * Returns a promise that resolves with the collected values,
 * or rejects if the user cancels.
 */
export type CollectParamsFn = (
  params: ActionParam[],
  actionLabel?: string
) => Promise<ActionParamValues>;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ActionParamContext = createContext<CollectParamsFn | null>(null);

/**
 * Hook to access the param collector from any component.
 * Returns null if no ActionParamProvider is present.
 */
export function useActionParamCollector(): CollectParamsFn | null {
  return useContext(ActionParamContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ActionParamProviderProps {
  children: React.ReactNode;
}

/**
 * ActionParamProvider — Provides param collection capability to the tree.
 *
 * Place this near the root of your app. When an action with params is executed,
 * the provider will render a param collection dialog.
 *
 * @example
 * ```tsx
 * <ActionParamProvider>
 *   <ActionProvider context={...}>
 *     <App />
 *   </ActionProvider>
 * </ActionParamProvider>
 * ```
 */
export const ActionParamProvider: React.FC<ActionParamProviderProps> = ({ children }) => {
  const [state, setState] = useState<ActionParamCollectorState | null>(null);

  const collectParams: CollectParamsFn = useCallback((params, actionLabel) => {
    return new Promise<ActionParamValues>((resolve, reject) => {
      setState({
        isOpen: true,
        params,
        actionLabel: actionLabel || 'Action Parameters',
        onSubmit: (values) => {
          setState(null);
          resolve(values);
        },
        onCancel: () => {
          setState(null);
          reject(new Error('Parameter collection cancelled'));
        },
      });
    });
  }, []);

  return (
    <ActionParamContext.Provider value={collectParams}>
      {children}
      {state && (
        <ActionParamDialog
          isOpen={state.isOpen}
          params={state.params}
          actionLabel={state.actionLabel}
          onSubmit={state.onSubmit}
          onCancel={state.onCancel}
        />
      )}
    </ActionParamContext.Provider>
  );
};

ActionParamProvider.displayName = 'ActionParamProvider';

// ---------------------------------------------------------------------------
// Dialog Component
// ---------------------------------------------------------------------------

interface ActionParamDialogProps {
  isOpen: boolean;
  params: ActionParam[];
  actionLabel: string;
  onSubmit: (values: ActionParamValues) => void;
  onCancel: () => void;
}

/**
 * Default ActionParamDialog — renders a simple form dialog for collecting params.
 * This uses native HTML dialog + Tailwind styling by default.
 * Consumers can override by providing a custom collector.
 */
const ActionParamDialog: React.FC<ActionParamDialogProps> = ({
  isOpen,
  params,
  actionLabel,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<ActionParamValues>(() => {
    const initial: ActionParamValues = {};
    for (const param of params) {
      initial[param.name] = param.defaultValue ?? '';
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Basic validation
      const newErrors: Record<string, string> = {};
      for (const param of params) {
        if (param.required && (values[param.name] === '' || values[param.name] == null)) {
          newErrors[param.name] = `${param.label} is required`;
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      onSubmit(values);
    },
    [params, values, onSubmit]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{actionLabel}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {params.map((param) => (
            <ParamField
              key={param.name}
              param={param}
              value={values[param.name]}
              error={errors[param.name]}
              onChange={(val) => handleChange(param.name, val)}
            />
          ))}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Individual Param Field
// ---------------------------------------------------------------------------

interface ParamFieldProps {
  param: ActionParam;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

const ParamField: React.FC<ParamFieldProps> = ({ param, value, error, onChange }) => {
  const inputId = `action-param-${param.name}`;

  const renderInput = () => {
    switch (param.type) {
      case 'textarea':
        return (
          <textarea
            id={inputId}
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
          />
        );

      case 'number':
        return (
          <input
            id={inputId}
            type="number"
            value={value as number ?? ''}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border focus:ring-2 focus:ring-ring"
            />
            <label htmlFor={inputId} className="text-sm">
              {param.label}
            </label>
          </div>
        );

      case 'date':
        return (
          <input
            id={inputId}
            type="date"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'datetime':
        return (
          <input
            id={inputId}
            type="datetime-local"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'time':
        return (
          <input
            id={inputId}
            type="time"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'select':
        return (
          <select
            id={inputId}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{param.placeholder || 'Select...'}</option>
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'email':
        return (
          <input
            id={inputId}
            type="email"
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'url':
        return (
          <input
            id={inputId}
            type="url"
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'password':
        return (
          <input
            id={inputId}
            type="password"
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'phone':
        return (
          <input
            id={inputId}
            type="tel"
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'color':
        return (
          <input
            id={inputId}
            type="color"
            value={String(value ?? '#000000')}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-20 rounded-md border bg-background cursor-pointer"
          />
        );

      case 'text':
      default:
        return (
          <input
            id={inputId}
            type="text"
            value={String(value ?? '')}
            placeholder={param.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      {param.type !== 'boolean' && (
        <label htmlFor={inputId} className="block text-sm font-medium">
          {param.label}
          {param.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {renderInput()}
      {param.helpText && (
        <p className="text-xs text-muted-foreground">{param.helpText}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};
