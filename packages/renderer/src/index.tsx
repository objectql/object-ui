import type { SchemaNode } from '@object-ui/protocol';
import { ComponentRegistry } from './registry';
import './renderers'; // Import all renderers to register them

// Re-export registry for external use if needed
export { ComponentRegistry } from './registry';

export const SchemaRenderer: React.FC<{ schema: SchemaNode }> = ({ schema }) => {
  if (!schema) return null;
  // If schema is just a string, render it as text
  if (typeof schema === 'string') return <>{schema}</>;
  
  const Component = ComponentRegistry.get(schema.type);

  if (!Component) {
    return (
      <div className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2">
        Unknown component type: <strong>{schema.type}</strong>
        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(schema, null, 2)}</pre>
      </div>
    );
  }

  return <Component schema={schema} {...(schema.props || {})} className={schema.className} />;
};

