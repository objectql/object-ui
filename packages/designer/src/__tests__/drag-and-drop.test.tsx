import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DesignerProvider, useDesigner } from '../context/DesignerContext';
import type { SchemaNode } from '@object-ui/core';
import React from 'react';
import userEvent from '@testing-library/user-event';

// Test component to access designer context
const TestComponent = () => {
  const { 
    schema, 
    draggingNodeId, 
    setDraggingNodeId, 
    moveNode,
    addNode 
  } = useDesigner();
  
  return (
    <div>
      <div data-testid="schema">{JSON.stringify(schema)}</div>
      <div data-testid="dragging-node-id">{draggingNodeId || 'null'}</div>
      <button onClick={() => setDraggingNodeId('test-node')}>Set Dragging</button>
      <button onClick={() => setDraggingNodeId(null)}>Clear Dragging</button>
      <button onClick={() => {
        const newNode: SchemaNode = { type: 'text', id: 'new-text' };
        addNode(schema.id, newNode);
      }}>Add Node</button>
      <button onClick={() => {
        if (schema.body && Array.isArray(schema.body) && schema.body.length > 0) {
          moveNode(schema.body[0].id!, schema.id, 1);
        }
      }}>Move Node</button>
    </div>
  );
};

describe('Drag and Drop Functionality', () => {
  const initialSchema: SchemaNode = {
    type: 'div',
    id: 'root',
    body: [
      { type: 'card', id: 'card-1' },
      { type: 'card', id: 'card-2' }
    ]
  };

  it('should initialize draggingNodeId as null', () => {
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    expect(screen.getByTestId('dragging-node-id').textContent).toBe('null');
  });

  it('should set and clear draggingNodeId', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const setButton = screen.getByText('Set Dragging');
    const clearButton = screen.getByText('Clear Dragging');
    
    // Set dragging node
    await user.click(setButton);
    expect(screen.getByTestId('dragging-node-id').textContent).toBe('test-node');
    
    // Clear dragging node
    await user.click(clearButton);
    expect(screen.getByTestId('dragging-node-id').textContent).toBe('null');
  });

  it('should move nodes within the schema', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const moveButton = screen.getByText('Move Node');
    
    // Get initial schema
    const initialSchemaText = screen.getByTestId('schema').textContent;
    const initial = JSON.parse(initialSchemaText || '{}');
    expect(initial.body[0].id).toBe('card-1');
    expect(initial.body[1].id).toBe('card-2');
    
    // Move first node to position 1
    await user.click(moveButton);
    
    // Get updated schema
    const updatedSchemaText = screen.getByTestId('schema').textContent;
    const updated = JSON.parse(updatedSchemaText || '{}');
    
    // After moving card-1 to index 1, card-2 should be at index 0
    expect(updated.body[0].id).toBe('card-2');
    expect(updated.body[1].id).toBe('card-1');
  });

  it('should add nodes to the schema', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const addButton = screen.getByText('Add Node');
    
    // Get initial schema
    const initialSchemaText = screen.getByTestId('schema').textContent;
    const initial = JSON.parse(initialSchemaText || '{}');
    expect(initial.body.length).toBe(2);
    
    // Add a new node
    await user.click(addButton);
    
    // Get updated schema
    const updatedSchemaText = screen.getByTestId('schema').textContent;
    const updated = JSON.parse(updatedSchemaText || '{}');
    
    // Should have 3 nodes now
    expect(updated.body.length).toBe(3);
    expect(updated.body[2].type).toBe('text');
  });
});
