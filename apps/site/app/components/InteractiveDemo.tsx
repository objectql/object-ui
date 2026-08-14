'use client';

import React, { useMemo } from 'react';
import { SchemaRenderer, SchemaRendererContext, toRenderableSchema } from '@object-ui/react';
import { SidebarProvider } from '@object-ui/components';
// Registers `page-header` & friends — see the module header (objectui#3787).
import './registerLayoutBlocks';
import type { SchemaNode } from '@object-ui/core';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

// Re-export SchemaNode type for use in MDX files
export type { SchemaNode } from '@object-ui/core';

/** Minimal provider so plugins can find SchemaRendererContext */
const defaultCtx = { dataSource: {} };
function DemoProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => defaultCtx, []);
  return (
    <SchemaRendererContext.Provider value={value}>
      {children}
    </SchemaRendererContext.Provider>
  );
}

interface InteractiveDemoProps {
  schema: SchemaNode;
  title?: string;
  description?: string;
  /**
   * Show multiple examples with their own schemas
   */
  examples?: Array<{
    schema: SchemaNode;
    label: string;
    description?: string;
  }>;
}

export function InteractiveDemo({ 
  schema, 
  title, 
  description,
  examples 
}: InteractiveDemoProps) {

  // If examples are provided, show a multi-example view
  if (examples && examples.length > 0) {
    return (
      <div className="not-prose my-6">
        {(title || description) && (
          <div className="mb-3">
            {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        <Tabs items={['Preview', 'Code']} defaultIndex={0}>
          <Tab value="Preview">
            <div className="space-y-6">
              {examples.map((example, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  {example.label && (
                    <div className="border-b bg-muted px-4 py-2">
                      <p className="text-sm font-medium">{example.label}</p>
                      {example.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{example.description}</p>
                      )}
                    </div>
                  )}
                  <div className="p-6 bg-background">
                    <DemoProvider>
                      <SidebarProvider className="min-h-0 w-full" defaultOpen={false}>
                        <div className="w-full">
                          <SchemaRenderer schema={toRenderableSchema(example.schema)} />
                        </div>
                      </SidebarProvider>
                    </DemoProvider>
                  </div>
                </div>
              ))}
            </div>
          </Tab>
          <Tab value="Code">
            <div className="space-y-4">
              {examples.map((example, index) => (
                <div key={index}>
                  {example.label && (
                    <p className="text-sm font-medium mb-2">{example.label}</p>
                  )}
                  <CodeBlock>
                    <Pre>
                      <code>{JSON.stringify(example.schema, null, 2)}</code>
                    </Pre>
                  </CodeBlock>
                </div>
              ))}
            </div>
          </Tab>
        </Tabs>
      </div>
    );
  }

  // Single example view with Preview/Code tabs
  return (
    <div className="not-prose my-6">
      {(title || description) && (
        <div className="mb-3">
          {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <Tabs items={['Preview', 'Code']} defaultIndex={0}>
        <Tab value="Preview">
          <div className="border rounded-lg p-6 bg-background">
            <DemoProvider>
              <SidebarProvider className="min-h-0 w-full" defaultOpen={false}>
                <div className="w-full">
                  <SchemaRenderer schema={toRenderableSchema(schema)} />
                </div>
              </SidebarProvider>
            </DemoProvider>
          </div>
        </Tab>
        <Tab value="Code">
          <CodeBlock>
            <Pre>
              <code>{JSON.stringify(schema, null, 2)}</code>
            </Pre>
          </CodeBlock>
        </Tab>
      </Tabs>
    </div>
  );
}

interface DemoGridProps {
  children: React.ReactNode;
}

export function DemoGrid({ children }: DemoGridProps) {
  return (
    <div className="not-prose grid gap-4 md:grid-cols-2 my-6">
      {children}
    </div>
  );
}
