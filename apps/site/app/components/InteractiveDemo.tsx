'use client';

import React, { useState, useEffect } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { SchemaNode } from '@object-ui/core';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

// Re-export SchemaNode type for use in MDX files
export type { SchemaNode } from '@object-ui/core';

// Load plugins promise that we can await
const pluginsLoading = typeof window !== 'undefined' 
  ? Promise.all([
      import('@object-ui/plugin-aggrid'),
      import('@object-ui/plugin-editor'),
      import('@object-ui/plugin-charts'),
      import('@object-ui/plugin-kanban'),
      import('@object-ui/plugin-markdown'),
      import('@object-ui/plugin-timeline'),
      import('@object-ui/plugin-calendar'),
      import('@object-ui/plugin-gantt'),
      import('@object-ui/plugin-map'),
      import('@object-ui/plugin-chatbot'),
      import('@object-ui/plugin-form'),
      import('@object-ui/plugin-grid'),
      import('@object-ui/plugin-view'),
    ])
  : Promise.resolve([]);

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
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  useEffect(() => {
    // Wait for plugins to load before rendering
    pluginsLoading.then(() => {
      setPluginsLoaded(true);
    });
  }, []);

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
            {!pluginsLoaded ? (
              <div className="p-6 text-center text-muted-foreground">Loading plugins...</div>
            ) : (
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
                      <SchemaRenderer schema={example.schema} />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            {!pluginsLoaded ? (
              <div className="text-center text-muted-foreground">Loading plugins...</div>
            ) : (
              <SchemaRenderer schema={schema} />
            )}
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
