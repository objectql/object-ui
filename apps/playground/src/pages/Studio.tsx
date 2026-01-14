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
    Download,
    Save,
    Share2
} from 'lucide-react';
import { toast } from 'sonner';
import '@object-ui/components';
import { examples, ExampleKey } from '../data/examples';
import { designStorage } from '../services/designStorage';

// Helper function to format design titles
function formatDesignTitle(exampleId: string): string {
  if (exampleId === 'new') return 'New Design';
  if (typeof exampleId !== 'string') return 'Untitled';
  return exampleId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

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
  onCopyJson,
  onSave,
  onShare
}: { 
  exampleTitle: string, 
  jsonError: string | null, 
  viewMode: ViewMode, 
  setViewMode: (m: ViewMode) => void,
  onCopyJson: () => void,
  onSave: () => void,
  onShare: () => void
}) => {
  const navigate = useNavigate();
  const { canUndo, undo, canRedo, redo, schema } = useDesigner();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = () => {
    onCopyJson();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    try {
      const { json, filename } = designStorage.exportDesign(schema.id || 'temp');
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Design exported successfully');
    } catch {
      toast.error('Failed to export design');
    }
  };

  return (
      <header className="h-16 border-b bg-white/80 backdrop-blur-md flex items-center px-4 justify-between flex-shrink-0 z-50 relative shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Back to Gallery"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 tracking-tight flex items-center gap-2">
                  <span className="bg-gradient-to-br from-indigo-600 to-purple-600 text-transparent bg-clip-text">Object Studio</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-700 font-semibold">{exampleTitle}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${jsonError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'} ring-2 ring-opacity-30 ${jsonError ? 'ring-red-500' : 'ring-emerald-500'}`}></span>
                <span className="text-[10px] uppercase tracking-wider font-bold ${jsonError ? 'text-red-600' : 'text-emerald-600'}">
                  {jsonError ? 'Error' : 'Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: View Mode Switcher */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex p-1 bg-gradient-to-r from-gray-100 to-slate-100 backdrop-blur-sm rounded-xl border border-gray-300 shadow-lg">
             <button
                onClick={() => setViewMode('design')}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  viewMode === 'design' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-300/50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Design
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  viewMode === 'preview' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-300/50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  viewMode === 'code' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-300/50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
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
             <div className="flex items-center bg-white rounded-xl border-2 border-gray-200 p-0.5 mr-2 shadow-sm">
               <button 
                 onClick={undo} 
                 disabled={!canUndo}
                 className={`p-2 rounded-lg transition-all ${!canUndo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'}`}
                 title="Undo (Cmd+Z)"
               >
                 <Undo className="w-4 h-4" />
               </button>
               <button 
                 onClick={redo} 
                 disabled={!canRedo}
                 className={`p-2 rounded-lg transition-all ${!canRedo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'}`}
                 title="Redo (Cmd+Y)"
               >
                 <Redo className="w-4 h-4" />
               </button>
             </div>
           )}
           
           <div className="h-6 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-2"></div>

           <button 
             onClick={onShare}
             className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all shadow-sm hover:shadow"
             title="Share Design"
           >
              <Share2 className="w-4 h-4" />
              Share
           </button>

           <button 
             onClick={handleExport}
             className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all shadow-sm hover:shadow"
             title="Download JSON"
           >
              <Download className="w-4 h-4" />
              Export
           </button>

           <button 
             onClick={handleSave}
             className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg ${
               saved 
                 ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-emerald-300/50' 
                 : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-300/50'
             }`}
           >
             {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
             {saved ? 'Saved!' : 'Save'}
           </button>

           <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg ${
                  copied 
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-emerald-300/50' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-300/50'
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy JSON'}
            </button>
        </div>
      </header>
  );
};

// Inner Component handles state for a specific example
const StudioEditor = ({ exampleId, initialJson, isUserDesign, currentDesignId }: { 
  exampleId: ExampleKey | 'new' | string, 
  initialJson: string,
  isUserDesign?: boolean,
  currentDesignId?: string
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('design');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  
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

  const handleSave = () => {
    if (currentDesignId && isUserDesign) {
      // Update existing design
      try {
        designStorage.updateDesign(currentDesignId, {
          schema: JSON.parse(code)
        });
        toast.success('Design saved successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to save design: ${message}`);
      }
    } else {
      // Show save modal for new design
      setShowSaveModal(true);
    }
  };

  const handleSaveNew = () => {
    try {
      const saved = designStorage.saveDesign({
        name: saveName || 'Untitled Design',
        description: saveDescription,
        schema: JSON.parse(code),
        tags: []
      });
      setShowSaveModal(false);
      setSaveName('');
      setSaveDescription('');
      toast.success('Design saved successfully');
      navigate(`/studio/${saved.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save design: ${message}`);
    }
  };

  const handleShare = () => {
    if (currentDesignId && isUserDesign) {
      try {
        const shareUrl = designStorage.shareDesign(currentDesignId);
        navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard!');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to share design: ${message}`);
      }
    } else {
      // Automatically trigger save modal instead of showing alert
      setShowSaveModal(true);
      toast.info('Please save the design first before sharing');
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
           exampleTitle={formatDesignTitle(exampleId)}
           jsonError={jsonError}
           viewMode={viewMode}
           setViewMode={setViewMode}
           onCopyJson={handleCopySchema}
           onSave={handleSave}
           onShare={handleShare}
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
        <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden absolute inset-0">
          <div className="border-b px-4 py-3 bg-white/90 backdrop-blur-md flex items-center justify-center z-10 sticky top-0 shadow-sm">
            {/* Viewport Size Toggles */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-gray-100 to-slate-100 p-1 rounded-xl border-2 border-gray-300 shadow-lg">
              <button
                onClick={() => setViewportSize('desktop')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewportSize === 'desktop' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-300/50 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
                }`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('tablet')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewportSize === 'tablet' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-300/50 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
                }`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportSize('mobile')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewportSize === 'mobile' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-300/50 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
                }`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div 
            className="flex-1 overflow-auto p-8 flex justify-center bg-gradient-to-br from-slate-100 via-gray-50 to-indigo-100 relative bg-dot-pattern"
          >
            <div className={`${viewportStyles[viewportSize]} transition-all duration-300 ease-in-out`}>
              <div 
                className={`
                  bg-background h-full min-h-[500px] 
                  ${viewportSize === 'mobile' 
                    ? 'rounded-[3rem] border-[10px] border-gray-800 shadow-2xl shadow-gray-900/50' 
                    : viewportSize === 'tablet' 
                      ? 'rounded-[2rem] border-[10px] border-gray-800 shadow-2xl shadow-gray-900/50' 
                      : 'rounded-2xl border-2 border-gray-300 shadow-2xl'}
                  ${viewportSize !== 'desktop' ? 'overflow-hidden' : 'p-6'} 
                  transition-all duration-300
                `}
              >
                {/* Mobile/Tablet Bar */}
                {viewportSize !== 'desktop' && (
                  <div className="h-6 bg-gray-900 w-full absolute top-0 left-0 z-50 flex justify-center items-center rounded-t-[2.5rem]">
                    <div className="w-20 h-1.5 bg-gray-700 rounded-full"></div>
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
                        <div className="space-y-3 p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl border-2 border-red-200 shadow-lg max-w-md">
                          <p className="text-red-700 font-bold text-lg flex items-center gap-2 justify-center">
                            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                            Invalid JSON
                          </p>
                          <p className="text-xs text-red-600 font-mono text-left bg-white/80 p-3 rounded-lg border border-red-200">{jsonError}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                           <div className="relative">
                             {/* Dual spinner: outer uses animate-spin and inner uses animate-spin-reverse for a counter-rotating loading effect */}
                             <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                             <div className="absolute inset-0 w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin-reverse"></div>
                           </div>
                           <p className="text-sm font-semibold text-gray-600">Rendering your UI...</p>
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
          <div className="w-1/2 h-full flex flex-col bg-gradient-to-br from-slate-100 via-gray-50 to-indigo-100 relative bg-dot-pattern">
             <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                <div className="w-full max-w-xl mx-auto rounded-2xl shadow-2xl bg-background border-2 border-gray-300 overflow-hidden">
                  <div className="h-9 bg-gradient-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300 flex items-center px-3 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
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

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Save Design</h2>
              <p className="text-sm text-gray-600 mt-1">Give your design a name and description</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Design Name *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My Awesome Design"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="A brief description of your design..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none h-24 transition-colors"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                  setSaveDescription('');
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNew}
                disabled={!saveName.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-300/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DesignerProvider>
  );
};

export const Studio = () => {
  const { id } = useParams<{ id: string }>();
  
  // Check if this is a new design
  if (id === 'new') {
    const blankSchema = JSON.stringify({
      type: 'page',
      title: 'New Page',
      body: []
    }, null, 2);
    return <StudioEditor key="new" exampleId="new" initialJson={blankSchema} />;
  }
  
  // Check if this is a user design
  const userDesign = designStorage.getDesign(id || '');
  if (userDesign) {
    const initialCode = JSON.stringify(userDesign.schema, null, 2);
    return (
      <StudioEditor 
        key={userDesign.id} 
        exampleId={userDesign.id} 
        initialJson={initialCode}
        isUserDesign={true}
        currentDesignId={userDesign.id}
      />
    );
  }
  
  // Check if this is a shared design
  if (id?.startsWith('shared/')) {
    const shareId = id.substring(7);
    const sharedDesign = designStorage.getSharedDesign(shareId);
    if (sharedDesign) {
      const initialCode = JSON.stringify(sharedDesign.schema, null, 2);
      return <StudioEditor key={shareId} exampleId={sharedDesign.name} initialJson={initialCode} />;
    }
  }
  
  // Fall back to example templates
  const exampleId = (id && id in examples) ? (id as ExampleKey) : 'dashboard';
  const initialCode = examples[exampleId];

  // Key forces remount when ID changes, resetting state completely
  return <StudioEditor key={exampleId} exampleId={exampleId} initialJson={initialCode} />;
};
