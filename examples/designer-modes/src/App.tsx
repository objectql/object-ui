import { useState } from 'react';
import { Designer, type DesignerMode } from '@object-ui/designer';
import type { SchemaNode } from '@object-ui/core';

function App() {
  const [mode, setMode] = useState<DesignerMode>('general');
  const [schema, setSchema] = useState<SchemaNode>({
    type: 'div',
    className: 'p-8',
    body: []
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Mode Selector */}
      <div className="h-16 bg-gray-900 text-white flex items-center px-6 gap-4 shadow-lg z-50">
        <h1 className="text-xl font-bold">Object UI Designer Modes</h1>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button
            onClick={() => setMode('form')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'form'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Form
          </button>
          <button
            onClick={() => setMode('layout')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'layout'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Layout
          </button>
          <button
            onClick={() => setMode('canvas')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'canvas'
                ? 'bg-amber-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Canvas
          </button>
          <button
            onClick={() => setMode('general')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'general'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            General
          </button>
        </div>
      </div>

      {/* Designer */}
      <div className="flex-1 overflow-hidden">
        <Designer
          key={mode} // Re-mount when mode changes
          mode={mode}
          initialSchema={schema}
          onSchemaChange={(newSchema) => {
            setSchema(newSchema);
            console.log('Schema updated:', newSchema);
          }}
        />
      </div>
    </div>
  );
}

export default App;
