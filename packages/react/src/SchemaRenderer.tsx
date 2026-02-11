/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef, useContext, useMemo } from 'react';
import { SchemaNode, ComponentRegistry, ExpressionEvaluator } from '@object-ui/core';
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

    return newSchema;
  }, [schema, dataSource]);

  if (!evaluatedSchema) return null;
  // If schema is just a string, render it as text
  if (typeof evaluatedSchema === 'string') return <>{evaluatedSchema}</>;
  
  const Component = ComponentRegistry.get(evaluatedSchema.type);

  if (!Component) {
    return (
      <div className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2">
        Unknown component type: <strong>{evaluatedSchema.type}</strong>
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
    ...componentProps
  } = evaluatedSchema;

  // Extract AriaPropsSchema properties for accessibility
  const ariaProps = resolveAriaProps(evaluatedSchema);

  return React.createElement(Component, {
    schema: evaluatedSchema,
    ...componentProps,  // Spread non-metadata schema properties as props
    ...(evaluatedSchema.props || {}),  // Override with explicit props if provided
    ...ariaProps,  // Inject ARIA attributes from AriaPropsSchema
    className: evaluatedSchema.className,
    'data-obj-id': evaluatedSchema.id,
    'data-obj-type': evaluatedSchema.type,
    ...props
  });
});
SchemaRenderer.displayName = 'SchemaRenderer';
