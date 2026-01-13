import React, { useState } from 'react';
import { Designer } from '@object-ui/designer';
import type { SchemaNode } from '@object-ui/core';

function App() {
  const [schema, setSchema] = useState<SchemaNode>({
    type: 'div',
    className: 'grid grid-cols-2 gap-4 p-4',
    body: [
      {
        type: 'card',
        body: [
          { type: 'text', value: 'Card 1' }
        ]
      },
      {
        type: 'card',
        body: [
          { type: 'text', value: 'Card 2' }
        ]
      }
    ]
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="p-4 border-b">
        <h1 className="text-xl font-bold">Designer Demo</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <Designer 
          initialSchema={schema} 
          onSchemaChange={setSchema} 
        />
      </div>
    </div>
  );
}

export default App;
