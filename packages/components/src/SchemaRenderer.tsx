import React from 'react';
import { ComponentRegistry } from '@object-ui/core';

export const SchemaRenderer = ({ schema }: { schema: any }) => {
  if (!schema) return null;
  if (Array.isArray(schema)) {
      return <>{schema.map((s, i) => <SchemaRenderer key={s.id || i} schema={s} />)}</>;
  }
  
  const { type, hidden } = schema;
  if (hidden) return null; // Simple hidden check
  
  if (!type) {
      if (typeof schema === 'string') return <>{schema}</>;
      return null;
  }

  const Component = ComponentRegistry.get(type);

  if (!Component) {
    console.warn(`Renderer not found for type: ${type}`);
    return <div className="p-2 text-xs text-red-500 border border-red-200 bg-red-50 rounded">Unknown: {type}</div>;
  }

  // eslint-disable-next-line
  return <Component schema={schema} {...schema} />;
};
