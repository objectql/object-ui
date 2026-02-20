/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef, useContext, useMemo, Component } from 'react';
import {
  SchemaNode,
  ComponentRegistry,
  ExpressionEvaluator,
  isObjectUIError,
  type ObjectUIError,
  ERROR_CODES,
  debugLog,
  debugTime,
  debugTimeEnd,
} from '@object-ui/core';
import { SchemaRendererContext } from './context/SchemaRendererContext';
import { resolveI18nLabel } from './utils/i18n';

/**
 * Extract AriaPropsSchema properties from a schema node and convert
 * them to standard HTML ARIA attributes.
 *
 * @objectstack/spec AriaPropsSchema defines:
 *   ariaLabel: string | I18nLabel (→ aria-label)
 *   ariaDescribedBy: string (→ aria-describedby)
 *   role: string (→ role)
 */
function resolveAriaProps(schema: Record<string, any>): Record<string, string | undefined> {
  const aria: Record<string, string | undefined> = {};
  if (schema.ariaLabel) {
    aria['aria-label'] = resolveI18nLabel(schema.ariaLabel);
  }
  if (schema.ariaDescribedBy) {
    aria['aria-describedby'] = schema.ariaDescribedBy;
  }
  if (schema.role) {
    aria['role'] = schema.role;
  }
  return aria;
}

/**
 * Per-component Error Boundary for SchemaRenderer.
 * Catches render errors in individual components, preventing one broken
 * component from crashing the entire page.
 */
interface SchemaErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SchemaErrorBoundary extends Component<
  { componentType?: string; children: React.ReactNode },
  SchemaErrorBoundaryState
> {
  state: SchemaErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): SchemaErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;
      const isDev = process.env.NODE_ENV !== 'production';
      const objuiError = isObjectUIError(error) ? error as ObjectUIError : null;

      return (
        <div className="p-4 border border-orange-400 rounded bg-orange-50 text-orange-700 my-2" role="alert">
          <p className="font-medium">
            Component{this.props.componentType ? ` "${this.props.componentType}"` : ''} failed to render
          </p>
          <p className="text-sm mt-1">{error.message}</p>
          {isDev && objuiError?.code && (
            <p className="text-xs mt-1 text-orange-500">
              Error code: {objuiError.code}
              {objuiError.details?.suggestion ? (
                <span className="block mt-0.5">💡 {String(objuiError.details.suggestion)}</span>
              ) : null}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const SchemaRenderer = forwardRef<any, { schema: SchemaNode } & Record<string, any>>(({ schema, ...props }, _ref) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource || {};

  // Evaluate schema expressions against the data source
  const evaluatedSchema = useMemo(() => {
    if (!schema || typeof schema === 'string') return schema;

    const evaluator = new ExpressionEvaluator({ data: dataSource });
    // Shallow copy
    const newSchema = { ...schema };

    // COMPAT: Hoist 'properties' up to schema level
    // This allows support for strict configs that wrap all props in 'properties'
    if (newSchema.properties) {
        Object.assign(newSchema, newSchema.properties);
    }

    // Evaluate 'content' (common in Text, Button)
    if (typeof newSchema.content === 'string') {
      newSchema.content = evaluator.evaluate(newSchema.content);
    }
    
    // Evaluate 'props'
    if (newSchema.props) {
      const newProps = { ...newSchema.props };
      for (const [key, val] of Object.entries(newProps)) {
        newProps[key] = evaluator.evaluate(val as any);
      }
      newSchema.props = newProps;
    }

    // Evaluate visibility: visible / visibleOn / hidden / hiddenOn
    const shouldHide = (() => {
      if (newSchema.visible !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visible);
      }
      if (newSchema.visibleOn !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visibleOn);
      }
      if (newSchema.hidden !== undefined) {
        return evaluator.evaluateCondition(newSchema.hidden);
      }
      if (newSchema.hiddenOn !== undefined) {
        return evaluator.evaluateCondition(newSchema.hiddenOn);
      }
      return false;
    })();

    if (shouldHide) {
      newSchema._hidden = true;
    }

    // Evaluate disabled: disabled / disabledOn
    const isDisabled = (() => {
      if (newSchema.disabled !== undefined) {
        return evaluator.evaluateCondition(newSchema.disabled);
      }
      if (newSchema.disabledOn !== undefined) {
        return evaluator.evaluateCondition(newSchema.disabledOn);
      }
      return false;
    })();

    if (isDisabled) {
      newSchema._disabled = true;
    }

    return newSchema;
  }, [schema, dataSource]);

  if (!evaluatedSchema) return null;
  // Handle visibility: if evaluated schema is hidden, render nothing
  if (evaluatedSchema?._hidden) return null;
  // If schema is just a string, render it as text
  if (typeof evaluatedSchema === 'string') return <>{evaluatedSchema}</>;

  debugLog('schema', 'Rendering schema node', { type: evaluatedSchema.type, id: evaluatedSchema.id });
  
  const Component = ComponentRegistry.get(evaluatedSchema.type);

  if (!Component) {
    debugLog('schema', 'Component not found in registry', { type: evaluatedSchema.type });
    const errorInfo = ERROR_CODES['OBJUI-001'];
    return (
      <div className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2" role="alert">
        <p className="font-medium">Unknown component type: <strong>{evaluatedSchema.type}</strong></p>
        {process.env.NODE_ENV !== 'production' && (
          <p className="text-xs mt-1">💡 {errorInfo.suggestion} (OBJUI-001)</p>
        )}
        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(evaluatedSchema, null, 2)}</pre>
      </div>
    );
  }

  // Note: We don't forward the ref to the Component because components in the registry
  // may not support refs. The SchemaRenderer itself can still receive refs for its own use.
  
  // Extract schema metadata properties that should NOT be passed as React props
  const {
    type: _type,
    children: _children,
    body: _body,
    schema: _schema,
    visible: _visible,
    visibleOn: _visibleOn,
    hidden: _hidden,
    hiddenOn: _hiddenOn,
    disabled: _disabled,
    disabledOn: _disabledOn,
    _hidden: _internalHidden,    // stripped: internal visibility flag
    _disabled: _internalDisabled, // stripped: internal disabled flag
    ...componentProps
  } = evaluatedSchema;

  // Extract AriaPropsSchema properties for accessibility
  const ariaProps = resolveAriaProps(evaluatedSchema);

  debugTime(`render:${evaluatedSchema.type}:${evaluatedSchema.id ?? 'anon'}`);
  const rendered = (
    <SchemaErrorBoundary componentType={evaluatedSchema.type}>
      {React.createElement(Component, {
        schema: evaluatedSchema,
        ...componentProps,  // Spread non-metadata schema properties as props
        ...(evaluatedSchema.props || {}),  // Override with explicit props if provided
        ...ariaProps,  // Inject ARIA attributes from AriaPropsSchema
        disabled: _internalDisabled || undefined,
        className: evaluatedSchema.className,
        'data-obj-id': evaluatedSchema.id,
        'data-obj-type': evaluatedSchema.type,
        ...props
      })}
    </SchemaErrorBoundary>
  );
  debugTimeEnd(`render:${evaluatedSchema.type}:${evaluatedSchema.id ?? 'anon'}`);
  return rendered;
});
SchemaRenderer.displayName = 'SchemaRenderer';
