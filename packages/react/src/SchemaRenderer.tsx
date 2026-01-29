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

export const SchemaRenderer = forwardRef<any, { schema: SchemaNode } & Record<string, any>>(({ schema, ...props }, _ref) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource || {};

  // Evaluate schema expressions against the data source
  const evaluatedSchema = useMemo(() => {
    if (!schema || typeof schema === 'string') return schema;

    const evaluator = new ExpressionEvaluator({ data: dataSource });
    const newSchema = { ...schema };

    // Evaluate 'content' (common in Text, Button)
    if (typeof newSchema.content === 'string') {
      newSchema.content = evaluator.evaluate(newSchema.content);
    }
    
    // Evaluate 'props'
    if (newSchema.props) {
      const newProps = { ...newSchema.props };
      for (const [key, val] of Object.entries(newProps)) {
        newProps[key] = evaluator.evaluate(val);
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
  return React.createElement(Component, {
    schema: evaluatedSchema,
    ...(evaluatedSchema.props || {}),
    className: evaluatedSchema.className,
    'data-obj-id': evaluatedSchema.id,
    'data-obj-type': evaluatedSchema.type,
    ...props
  });
});
SchemaRenderer.displayName = 'SchemaRenderer';
