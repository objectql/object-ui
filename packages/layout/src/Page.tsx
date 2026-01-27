// packages/layout/src/Page.tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { PageSchema, SchemaNode } from '@object-ui/types';
import { PageHeader } from './PageHeader';

// Helper to ensure children is always an array
const getChildren = (children?: SchemaNode[] | SchemaNode): SchemaNode[] => {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  return [children];
};

export function Page({ schema, ...props }: { schema: PageSchema } & any) {
  const children = getChildren(schema.children);

  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader 
        title={schema.title} 
        description={schema.description} 
      />
      <div className="flex-1 overflow-auto">
        {children.map((child: any, index: number) => (
           <SchemaRenderer 
             key={child?.id || index} 
             schema={child} 
             {...props} 
            />
        ))}
      </div>
    </div>
  );
}
