import { Designer } from '@object-ui/designer';
import { useState } from 'react';
import type { SchemaNode } from '@object-ui/protocol';

const initialSchema: SchemaNode = {
  type: 'div',
  className: 'p-8',
  body: [
    {
      type: 'card',
      title: 'Welcome to Object UI Designer',
      body: [
        {
          type: 'text',
          content: 'Start by adding components from the left panel or edit this card.'
        }
      ]
    }
  ]
};

function App() {
  const [schema, setSchema] = useState<SchemaNode>(initialSchema);
  
  const handleSchemaChange = (newSchema: SchemaNode) => {
    setSchema(newSchema);
    console.log('Schema updated:', newSchema);
  };
  
  return (
    <Designer 
      initialSchema={schema} 
      onSchemaChange={handleSchemaChange}
    />
  );
}

export default App;
