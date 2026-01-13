import React, { useState } from 'react';
import { useDesigner } from '../context/DesignerContext';
import { Button } from '@object-ui/ui';
import type { SchemaNode } from '@object-ui/protocol';

interface ToolbarProps {
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ className }) => {
  const { schema, setSchema } = useDesigner();
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  
  const handleExportJson = () => {
    const json = JSON.stringify(schema, null, 2);
    setJsonText(json);
    setShowJsonModal(true);
    setJsonError('');
  };
  
  const handleImportJson = () => {
    setJsonText('');
    setShowJsonModal(true);
    setJsonError('');
  };
  
  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as SchemaNode;
      setSchema(parsed);
      setShowJsonModal(false);
      setJsonError('');
    } catch (error) {
      setJsonError('Invalid JSON: ' + (error as Error).message);
    }
  };
  
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    alert('Schema copied to clipboard!');
  };
  
  return (
    <>
      <div className={`flex items-center justify-between px-4 py-3 bg-gray-100 border-b ${className || ''}`}>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Object UI Designer</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImportJson}>
            Import JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyJson}>
            Copy JSON
          </Button>
        </div>
      </div>
      
      {/* JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Schema JSON</h2>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-full min-h-[400px] p-3 border rounded font-mono text-sm"
                placeholder="Paste your schema JSON here..."
              />
              {jsonError && (
                <div className="mt-2 text-sm text-red-500">{jsonError}</div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setShowJsonModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyJson}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
