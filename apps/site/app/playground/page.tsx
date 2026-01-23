'use client';

import React, { useState, useEffect } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { SchemaNode } from '@object-ui/core';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Load plugins
const pluginsLoading = typeof window !== 'undefined' 
  ? Promise.all([
      import('@object-ui/plugin-editor'),
      import('@object-ui/plugin-charts'),
      import('@object-ui/plugin-kanban'),
      import('@object-ui/plugin-markdown'),
      import('@object-ui/plugin-object'),
    ])
  : Promise.resolve([]);

// Default example schema
const DEFAULT_SCHEMA = {
  type: "container",
  className: "space-y-4",
  children: [
    {
      type: "heading",
      level: 2,
      children: "Welcome to ObjectUI Playground"
    },
    {
      type: "text",
      children: "Edit the JSON schema on the left to see live updates here."
    },
    {
      type: "card",
      className: "p-6",
      children: {
        type: "container",
        className: "space-y-4",
        children: [
          {
            type: "heading",
            level: 3,
            children: "Quick Example"
          },
          {
            type: "text",
            children: "Try changing the text or adding new components!"
          },
          {
            type: "button",
            variant: "default",
            children: "Click me"
          }
        ]
      }
    }
  ]
};

// Example schemas for users to try
const EXAMPLE_SCHEMAS = {
  basic: DEFAULT_SCHEMA,
  form: {
    type: "container",
    className: "space-y-4 max-w-md",
    children: [
      {
        type: "heading",
        level: 2,
        children: "Contact Form"
      },
      {
        type: "input",
        name: "name",
        placeholder: "Your name"
      },
      {
        type: "input",
        name: "email",
        type: "email",
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
        children: "Submit"
      }
    ]
  },
  dashboard: {
    type: "container",
    className: "space-y-6",
    children: [
      {
        type: "heading",
        level: 1,
        children: "Dashboard"
      },
      {
        type: "grid",
        columns: 3,
        gap: 4,
        children: [
          {
            type: "card",
            className: "p-6",
            children: {
              type: "container",
              className: "space-y-2",
              children: [
                {
                  type: "text",
                  className: "text-sm text-muted-foreground",
                  children: "Total Users"
                },
                {
                  type: "heading",
                  level: 2,
                  children: "1,234"
                }
              ]
            }
          },
          {
            type: "card",
            className: "p-6",
            children: {
              type: "container",
              className: "space-y-2",
              children: [
                {
                  type: "text",
                  className: "text-sm text-muted-foreground",
                  children: "Revenue"
                },
                {
                  type: "heading",
                  level: 2,
                  children: "$12,345"
                }
              ]
            }
          },
          {
            type: "card",
            className: "p-6",
            children: {
              type: "container",
              className: "space-y-2",
              children: [
                {
                  type: "text",
                  className: "text-sm text-muted-foreground",
                  children: "Active Projects"
                },
                {
                  type: "heading",
                  level: 2,
                  children: "42"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  list: {
    type: "container",
    className: "space-y-4 max-w-2xl",
    children: [
      {
        type: "heading",
        level: 2,
        children: "Task List"
      },
      {
        type: "card",
        className: "divide-y",
        children: [
          {
            type: "container",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task1"
              },
              {
                type: "text",
                children: "Complete documentation"
              }
            ]
          },
          {
            type: "container",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task2"
              },
              {
                type: "text",
                children: "Review pull requests"
              }
            ]
          },
          {
            type: "container",
            className: "p-4 flex items-center gap-3",
            children: [
              {
                type: "checkbox",
                name: "task3"
              },
              {
                type: "text",
                children: "Deploy to production"
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
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [selectedExample, setSelectedExample] = useState<keyof typeof EXAMPLE_SCHEMAS>('basic');

  useEffect(() => {
    // Wait for plugins to load before rendering
    pluginsLoading.then(() => {
      setPluginsLoaded(true);
    });
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
              <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
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
              theme="vs-dark"
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
            {!pluginsLoaded ? (
              <div className="flex items-center justify-center h-full text-fd-muted-foreground">
                Loading plugins...
              </div>
            ) : error ? (
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
  );
}
