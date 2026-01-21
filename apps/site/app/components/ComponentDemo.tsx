'use client';

import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { SchemaNode } from '@object-ui/core';

interface ComponentDemoProps {
  schema: SchemaNode;
  title?: string;
  description?: string;
}

export function ComponentDemo({ schema, title, description }: ComponentDemoProps) {
  return (
    <div className="not-prose my-6">
      {(title || description) && (
        <div className="mb-3">
          {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="border rounded-lg p-6 bg-background">
        <SchemaRenderer schema={schema} />
      </div>
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

interface CodeDemoProps {
  schema: SchemaNode;
  code: string;
  title?: string;
}

export function CodeDemo({ schema, code, title }: CodeDemoProps) {
  return (
    <div className="not-prose my-6">
      {title && <h4 className="text-sm font-semibold mb-3">{title}</h4>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border rounded-lg p-6 bg-background">
          <SchemaRenderer schema={schema} />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <pre className="p-4 text-xs overflow-auto max-h-96 bg-muted">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
