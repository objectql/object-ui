'use client';

import React, { useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { SchemaNode } from '@object-ui/core';
import dynamic from 'next/dynamic';
import { ObjectUIProvider } from '@/app/components/ObjectUIProvider';

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Default example schema
const DEFAULT_SCHEMA = {
  type: "div",
  className: "space-y-4",
  children: [
    {
      type: "text",
      content: "Welcome to ObjectUI Playground",
      className: "text-2xl font-bold"
    },
    {
      type: "text",
      content: "Edit the JSON schema on the left to see live updates here."
    },
    {
      type: "card",
      className: "p-6",
      children: [
        {
          type: "text",
          content: "Quick Example",
          className: "text-xl font-semibold mb-2"
        },
        {
          type: "text",
          content: "Try changing the text or adding new components!",
          className: "mb-4"
        },
        {
          type: "button",
          variant: "default",
          label: "Click me"
        }
      ]
    }
  ]
};

// Example schemas for users to try
const EXAMPLE_SCHEMAS = {
  basic: DEFAULT_SCHEMA,
  form: {
    type: "div",
    className: "space-y-4 max-w-md",
    children: [
      {
        type: "text",
        content: "Contact Form",
        className: "text-2xl font-bold mb-4"
      },
      {
        type: "input",
        name: "name",
        placeholder: "Your name"
      },
      {
        type: "input",
        name: "email",
        inputType: "email",
        placeholder: "your@email.com"
      },
      {
        type: "textarea",
        name: "message",
        placeholder: "Your message",
        rows: 4
      },
      {
        type: "button",
        variant: "default",
        label: "Submit"
      }
    ]
  },
  dashboard: {
    type: "div",
    className: "space-y-6",
    children: [
      {
        type: "text",
        content: "Dashboard",
        className: "text-3xl font-bold"
      },
      {
        type: "grid",
        columns: 3,
        gap: 4,
        children: [
          {
            type: "card",
            className: "p-6",
            children: [
              {
                type: "text",
                content: "Total Users",
                className: "text-sm text-muted-foreground"
              },
              {
                type: "text",
                content: "1,234",
                className: "text-2xl font-bold mt-2"
              }
            ]
          },
          {
            type: "card",
            className: "p-6",
            children: [
              {
                type: "text",
                content: "Revenue",
                className: "text-sm text-muted-foreground"
              },
              {
                type: "text",
                content: "$12,345",
                className: "text-2xl font-bold mt-2"
              }
            ]
          },
          {
            type: "card",
            className: "p-6",
            children: [
              {
                type: "text",
                content: "Active Projects",
                className: "text-sm text-muted-foreground"
              },
              {
                type: "text",
                content: "42",
                className: "text-2xl font-bold mt-2"
              }
            ]
          }
        ]
      }
    ]
  },
  list: {
    type: "div",
    className: "space-y-4 max-w-2xl",
    children: [
      {
        type: "text",
        content: "Task List",
        className: "text-2xl font-bold mb-4"
      },
      {
        type: "card",
        className: "divide-y",
        children: [
          {
            type: "div",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task1"
              },
              {
                type: "text",
                content: "Complete documentation"
              }
            ]
          },
          {
            type: "div",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task2"
              },
              {
                type: "text",
                content: "Review pull requests"
              }
            ]
          },
          {
            type: "div",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task3"
              },
              {
                type: "text",
                content: "Deploy to production"
              }
            ]
          }
        ]
      }
    ]
  }
};

export default function PlaygroundPage() {
  const [schema, setSchema] = useState<SchemaNode>(DEFAULT_SCHEMA);
  const [editorValue, setEditorValue] = useState(JSON.stringify(DEFAULT_SCHEMA, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [selectedExample, setSelectedExample] = useState<keyof typeof EXAMPLE_SCHEMAS>('basic');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  // Detect system theme
  React.useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setEditorTheme(darkModeQuery.matches ? 'vs-dark' : 'light');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? 'vs-dark' : 'light');
    };
    
    darkModeQuery.addEventListener('change', handleChange);
    return () => darkModeQuery.removeEventListener('change', handleChange);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    
    setEditorValue(value);
    
    try {
      const parsed = JSON.parse(value);
      setSchema(parsed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const loadExample = (exampleKey: keyof typeof EXAMPLE_SCHEMAS) => {
    const exampleSchema = EXAMPLE_SCHEMAS[exampleKey];
    setSelectedExample(exampleKey);
    setSchema(exampleSchema);
    setEditorValue(JSON.stringify(exampleSchema, null, 2));
    setError(null);
  };

  return (
    <ObjectUIProvider>
      <div className="flex flex-col h-screen bg-fd-background">
      {/* Header */}
      <div className="border-b border-fd-border bg-fd-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-fd-foreground">ObjectUI Playground</h1>
              <p className="text-sm text-fd-muted-foreground mt-1">
                Edit JSON schema and see live preview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-fd-muted-foreground">Examples:</span>
              {(Object.keys(EXAMPLE_SCHEMAS) as Array<keyof typeof EXAMPLE_SCHEMAS>).map((key) => (
                <button
                  key={key}
                  onClick={() => loadExample(key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedExample === key
                      ? 'bg-fd-primary text-fd-primary-foreground'
                      : 'bg-fd-muted text-fd-muted-foreground hover:bg-fd-accent'
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 border-r border-fd-border flex flex-col">
          <div className="bg-fd-muted px-4 py-2 border-b border-fd-border">
            <h2 className="text-sm font-semibold text-fd-foreground">JSON Schema</h2>
            {error && (
              <div className="mt-2 text-xs text-fd-destructive bg-fd-destructive/10 p-2 rounded border border-fd-destructive/20">
                {error}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={editorValue}
              onChange={handleEditorChange}
              theme={editorTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
              }}
            />
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 flex flex-col bg-fd-background">
          <div className="bg-fd-muted px-4 py-2 border-b border-fd-border">
            <h2 className="text-sm font-semibold text-fd-foreground">Live Preview</h2>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="text-4xl">⚠️</div>
                  <div className="text-fd-muted-foreground">
                    Fix the JSON syntax to see preview
                  </div>
                </div>
              </div>
            ) : (
              <SchemaRenderer schema={schema} />
            )}
          </div>
        </div>
      </div>
      </div>
    </ObjectUIProvider>
  );
}
