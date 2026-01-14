import { useState, useEffect, Component, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import { DesignerContent, DesignerProvider, useDesigner } from '@object-ui/designer';
import { SchemaNode } from '@object-ui/core';
import { 
    Monitor, 
    Smartphone, 
    Tablet, 
    Undo, 
    Redo, 
    Copy, 
    Check, 
    Code2, 
    PenTool, 
    ArrowLeft, 
    Download 
} from 'lucide-react';
import '@object-ui/components';
import { examples, ExampleKey } from '../data/examples';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';
type ViewMode = 'code' | 'design' | 'preview';

// Error Boundary for Designer
class DesignerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-red-50 p-8 text-center">
          <h2 className="text-xl font-bold text-red-700 mb-2">Designer Error</h2>
          <p className="text-red-600 mb-4 max-w-lg">{this.state.error?.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Reload Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// Wrapper component to access Designer context
const StudioToolbarContext = ({ 
  exampleTitle, 
  jsonError, 
  viewMode, 
  setViewMode, 
  onCopyJson 
}: { 
  exampleTitle: string, 
  jsonError: string | null, 
  viewMode: ViewMode, 
  setViewMode: (m: ViewMode) => void,
  onCopyJson: () => void
}) => {
  const navigate = useNavigate();
  const { canUndo, undo, canRedo, redo, schema } = useDesigner();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyJson();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
      <header className="h-16 border-b bg-white flex items-center px-4 justify-between flex-shrink-0 z-50 relative shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
              title="Back to Gallery"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-200 mx-1"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 tracking-tight">Object Studio</span>
                <span className="text-gray-300">/</span>
                <span className="text-gray-600 font-medium">{exampleTitle}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${jsonError ? 'bg-red-500' : 'bg-green-500'} ring-2 ring-opacity-20 ${jsonError ? 'ring-red-500' : 'ring-green-500'}`}></span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                  {jsonError ? 'Error' : 'Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: View Mode Switcher */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex p-1 bg-gray-100/80 backdrop-blur-sm rounded-lg border border-gray-200/50">
             <button
                onClick={() => setViewMode('design')}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'design' 
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Design
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'preview' 
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'code' 
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Code
              </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
           {viewMode === 'design' && (
             <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-0.5 mr-2">
               <button 
                 onClick={undo} 
                 disabled={!canUndo}
                 className={`p-1.5 rounded-md transition-all ${!canUndo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'}`}
                 title="Undo (Cmd+Z)"
               >
                 <Undo className="w-4 h-4" />
               </button>
               <button 
                 onClick={redo} 
                 disabled={!canRedo}
                 className={`p-1.5 rounded-md transition-all ${!canRedo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'}`}
                 title="Redo (Cmd+Y)"
               >
                 <Redo className="w-4 h-4" />
               </button>
             </div>
           )}
           
           <div className="h-6 w-px bg-gray-200 mx-2"></div>

           <button 
             onClick={handleExport}
             className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
             title="Download JSON"
           >
              <Download className="w-4 h-4" />
              Export
           </button>

           <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all shadow-sm ${
                  copied 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
      </header>
  );
};

// Inner Component handles state for a specific example
const StudioEditor = ({ exampleId, initialJson }: { exampleId: ExampleKey, initialJson: string }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('design');
  // ... state setup ...
  
  // Initialize state based on props (which change on example switch)
  const [code, setCode] = useState(initialJson);
  const [schema, setSchema] = useState<SchemaNode | null>(() => {
    try {
      return JSON.parse(initialJson) as SchemaNode;
    } catch {
      return null;
    }
  });

  // Also update when props change (though key={exampleId} on parent usually handles this, double safety)
  useEffect(() => {
    setCode(initialJson);
    try {
      setSchema(JSON.parse(initialJson));
    } catch {
      // ignore
    }
  }, [initialJson]);
  
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');

  const updateCode = (newCode: string) => {
    setCode(newCode);
    try {
      const parsed = JSON.parse(newCode) as SchemaNode;
      setSchema(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const handleDesignerChange = (newSchema: SchemaNode) => {
    const newCode = JSON.stringify(newSchema, null, 2);
    setCode(newCode);
    setSchema(newSchema);
  };
  
  const handleCopySchema = async () => {
     try {
       await navigator.clipboard.writeText(JSON.stringify(JSON.parse(code), null, 2));
     } catch (err) {
       console.error('Failed to copy', err);
     }
  };

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: 'w-full',
    tablet: 'max-w-3xl mx-auto',
    mobile: 'max-w-md mx-auto'
  };

  return (
    <DesignerProvider initialSchema={schema || undefined} onSchemaChange={handleDesignerChange}>
      <div className="flex h-screen w-screen bg-background text-foreground flex-col">
        {/* Top Header injected into Designer Context */}
        <StudioToolbarContext 
           exampleTitle={exampleId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
           jsonError={jsonError}
           viewMode={viewMode}
           setViewMode={setViewMode}
           onCopyJson={handleCopySchema}
        />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
      {viewMode === 'design' ? (
        <div className="h-full bg-background absolute inset-0">
          <DesignerErrorBoundary>
            {/* We can render DesignerContent directly now since we are inside Provider */}
             <DesignerContent />
          </DesignerErrorBoundary>
        </div>
      ) : viewMode === 'preview' ? (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden absolute inset-0">
          <div className="border-b px-4 py-2 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 sticky top-0">
            {/* Viewport Size Toggles */}
            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => setViewportSize('desktop')}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewportSize === 'desktop' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('tablet')}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewportSize === 'tablet' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('mobile')}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewportSize === 'mobile' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-700'
                }`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div 
            className="flex-1 overflow-auto p-8 flex justify-center bg-slate-50 relative"
            style={{ 
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }}
          >
            <div className={`${viewportStyles[viewportSize]} transition-all duration-300 ease-in-out`}>
              <div 
                className={`
                  bg-background h-full min-h-[500px] 
                  ${viewportSize === 'mobile' 
                    ? 'rounded-[3rem] border-[8px] border-slate-800 shadow-2xl' 
                    : viewportSize === 'tablet' 
                      ? 'rounded-[2rem] border-[8px] border-slate-800 shadow-2xl' 
                      : 'rounded-xl border border-gray-200 shadow-xl'
                  }
                  ${viewportSize !== 'desktop' ? 'overflow-hidden' : 'p-6'} 
                  transition-all duration-300
                `}
              >
                {/* Mobile/Tablet Bar */}
                {viewportSize !== 'desktop' && (
                  <div className="h-6 bg-slate-800 w-full absolute top-0 left-0 z-50 flex justify-center items-center">
                    <div className="w-16 h-1 bg-slate-700 rounded-full"></div>
                  </div>
                )}

                <div className={`h-full w-full ${viewportSize !== 'desktop' ? 'mt-0 pt-2 bg-white overflow-auto h-[calc(100%-0px)]' : ''}`}>
                 {viewportSize !== 'desktop' && <div className="h-6 w-full flex-shrink-0"></div>} {/* Notch spacer */}
                 
                 <div className={viewportSize !== 'desktop' ? 'p-4' : ''}>
                  {schema && !jsonError ? (
                    <SchemaRenderer schema={schema} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center h-full">
                      {jsonError ? (
                        <div className="space-y-2 p-4 bg-red-50 rounded-lg border border-red-100">
                          <p className="text-red-600 font-semibold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Invalid JSON
                          </p>
                          <p className="text-xs text-red-500 font-mono text-left">{jsonError}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                           <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                           <p className="text-sm text-gray-400">Rendering...</p>
                        </div>
                      )}
                    </div>
                  )}
                 </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full overflow-hidden absolute inset-0">
          {/* Code Editor */}
          <div className="w-1/2 h-full flex flex-col relative z-10 shadow-xl border-r border-[#333]">
            {jsonError && (
              <div className="px-4 py-2 bg-red-900/20 border-b border-red-900/50 text-red-400 text-xs font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <strong>Error:</strong> {jsonError}
              </div>
            )}
            
            <div className="h-9 bg-[#252526] flex items-center px-4 text-xs text-[#969696] select-none border-b border-[#333]">
               <Code2 className="w-3.5 h-3.5 mr-2" />
               <span>schema.json</span>
            </div>

            <div className="flex-1 overflow-hidden relative bg-[#1e1e1e]">
              <textarea
                value={code}
                onChange={(e) => updateCode(e.target.value)}
                className="w-full h-full p-6 font-mono text-sm resize-none focus:outline-none border-0 bg-[#1e1e1e] text-[#d4d4d4]"
                spellCheck={false}
                style={{ 
                  tabSize: 2,
                  lineHeight: '1.6',
                  fontFamily: '"Menlo", "Monaco", "Courier New", monospace'
                }}
              />
            </div>
          </div>

          {/* Side Preview */}
          <div className="w-1/2 h-full flex flex-col bg-slate-50 relative" 
            style={{ 
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }}
          >
             <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                <div className="w-full max-w-xl mx-auto rounded-xl shadow-xl bg-background border ring-1 ring-black/5 overflow-hidden">
                  <div className="h-9 bg-white border-b flex items-center px-3 gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                  </div>
                  <div className="p-6">
                    {schema && !jsonError ? (
                      <SchemaRenderer schema={schema} />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                         {jsonError ? 'Waiting for valid JSON...' : 'Rendering...'}
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </DesignerProvider>
  );
};

export const Studio = () => {
  const { id } = useParams<{ id: string }>();
  
  // Validate ID
  const exampleId = (id && id in examples) ? (id as ExampleKey) : 'dashboard';
  const initialCode = examples[exampleId];

  // Key forces remount when ID changes, resetting state completely
  return <StudioEditor key={exampleId} exampleId={exampleId} initialJson={initialCode} />;
};
