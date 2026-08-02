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

/**
 * Renders a `PageNodeSchema` — the SDUI `page` NODE — as a header plus its
 * children.
 *
 * Named `PageNodeRenderer`, not `Page` (objectui#3161, objectstack#4115 ledger
 * batch 7). `@objectstack/spec/ui` owns `Page` for the authored page METADATA
 * DOCUMENT (`z.infer<typeof PageSchema>`: `name`, `label`, `type:
 * record|app|home|list|utility`, `variables`, `regions`, `object`), and this
 * renders neither that document nor anything derived from it — its input is
 * `@object-ui/types`'s `PageNodeSchema`, the schema-renderer node, which
 * objectui#3074 already renamed off `PageSchema` for this exact reason. Naming
 * the renderer of the NODE after the DOCUMENT put the two layers back in one
 * word, one file below the rename that separated them.
 *
 * The `& any` on the props is not load-bearing typing — it absorbs every
 * member, so this signature says nothing beyond `schema` — but it is left as
 * found: this component is not registered (see the note in `index.ts`; the
 * `page` key belongs to `@object-ui/components`'s `PageRenderer`), and
 * tightening the pass-through props of an unregistered renderer is a behaviour
 * change, not a rename. Tracked in objectui#3223.
 */
export function PageNodeRenderer({ schema, className, style, id, ...props }: { schema: PageNodeSchema; className?: string; style?: React.CSSProperties; id?: string } & any) {
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
