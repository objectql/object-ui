// packages/layout/src/Page.tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { PageNodeSchema, SchemaNode } from '@object-ui/types';
import { PageHeader } from './PageHeader';
import { cn } from '@object-ui/components';

// Helper to ensure children is always an array
const getChildren = (children?: SchemaNode[] | SchemaNode): SchemaNode[] => {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  return [children];
};

export function Page({ schema, className, style, id, ...props }: { schema: PageNodeSchema; className?: string; style?: React.CSSProperties; id?: string } & any) {
  const children = getChildren(schema.children);

  return (
    <div 
      id={id || schema.id}
      className={cn("flex flex-col h-full space-y-4", className)} 
      style={style}
    >
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
