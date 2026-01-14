import { useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import { examples, exampleCategories, ExampleKey } from './data/examples';
import { Monitor, Tablet, Smartphone, Copy, Check, Code2 } from 'lucide-react';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export default function Playground() {
  const [selectedExample, setSelectedExample] = useState<ExampleKey>('dashboard');
  
  // Initialize state based on default example
  const initialCode = examples['dashboard'];
  const [code, setCode] = useState(initialCode);
  
  const [schema, setSchema] = useState<unknown>(() => {
    try {
      return JSON.parse(initialCode);
    } catch {
      return null;
    }
  });
  
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [copied, setCopied] = useState(false);

  const updateCode = (newCode: string) => {
    setCode(newCode);
    try {
      const parsed = JSON.parse(newCode);
      setSchema(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
      // Keep previous schema on error
    }
  };

  const handleExampleChange = (key: ExampleKey) => {
    setSelectedExample(key);
    updateCode(examples[key]);
  };

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: 'w-full',
    tablet: 'max-w-3xl mx-auto',
    mobile: 'max-w-md mx-auto'
  };

  return (
    <div className="flex h-screen w-screen bg-background">
      {/* 1. Sidebar: Example Selector */}
      <aside className="w-64 bg-muted/30 border-r overflow-auto">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">Object UI</h1>
          <p className="text-sm text-muted-foreground mt-1">Live Playground</p>
        </div>
        
        <div className="p-4 space-y-6">
          {Object.entries(exampleCategories).map(([category, keys]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
              </h2>
              <div className="space-y-1">
                {keys.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleExampleChange(key as ExampleKey)}
                    className={`
                      block w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                      ${key === selectedExample 
                        ? 'bg-primary text-primary-foreground font-medium' 
                        : 'hover:bg-muted text-foreground'
                      }
                    `}
                  >
                    {key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Middle: Code Editor */}
      <div className="w-1/2 h-full border-r flex flex-col">
        <div className="border-b px-4 py-3 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">JSON Schema</h2>
          </div>
          <button
            onClick={handleCopySchema}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-background hover:bg-muted transition-colors border"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy Schema
              </>
            )}
          </button>
        </div>
        
        {jsonError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            <strong>JSON Error:</strong> {jsonError}
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          <textarea
            value={code}
            onChange={(e) => updateCode(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none border-0 bg-background"
            spellCheck={false}
            style={{ 
              tabSize: 2,
              lineHeight: '1.6'
            }}
          />
        </div>
      </div>

      {/* 3. Right: Live Preview */}
      <div className="w-1/2 h-full flex flex-col bg-muted/10">
        <div className="border-b px-4 py-3 bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Preview</h2>
          
          {/* Viewport Size Toggles */}
          <div className="flex items-center gap-1 bg-background rounded-md p-1 border">
            <button
              onClick={() => setViewportSize('desktop')}
              className={`p-1.5 rounded transition-colors ${
                viewportSize === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title="Desktop View"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewportSize('tablet')}
              className={`p-1.5 rounded transition-colors ${
                viewportSize === 'tablet' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title="Tablet View"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewportSize('mobile')}
              className={`p-1.5 rounded transition-colors ${
                viewportSize === 'mobile' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title="Mobile View"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          <div className={`${viewportStyles[viewportSize]} transition-all duration-300`}>
            <div className="rounded-lg border shadow-sm bg-background p-6">
              {schema && !jsonError ? (
                <SchemaRenderer schema={schema} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {jsonError ? (
                    <div className="space-y-2">
                      <p className="text-red-500 font-semibold">Invalid JSON</p>
                      <p className="text-sm">Fix the syntax error to see the preview</p>
                    </div>
                  ) : (
                    <p>Select an example to get started</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
