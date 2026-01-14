import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { DesignerProvider, useDesigner } from '../context/DesignerContext';
import { ComponentRegistry } from '@object-ui/core';
import type { SchemaNode } from '@object-ui/core';
import React from 'react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  cleanup();
});

// Mock component registry with resizable component
beforeEach(() => {
  ComponentRegistry.register('resizable-card', 
    () => <div>Resizable Card</div>,
    {
      label: 'Resizable Card',
      resizable: true,
      resizeConstraints: {
        width: true,
        height: true,
        minWidth: 200,
        maxWidth: 800,
        minHeight: 100,
        maxHeight: 600
      }
    }
  );
  
  ComponentRegistry.register('non-resizable-button',
    () => <button>Button</button>,
    {
      label: 'Button',
      resizable: false
    }
  );
});

// Test component to access designer context
const TestComponent = () => {
  const { 
    schema,
    resizingNode,
    setResizingNode,
    updateNode,
    selectedNodeId,
    setSelectedNodeId
  } = useDesigner();
  
  return (
    <div>
      <div data-testid="schema">{JSON.stringify(schema)}</div>
      <div data-testid="resizing-node">{resizingNode ? JSON.stringify(resizingNode) : 'null'}</div>
      <div data-testid="selected-node-id">{selectedNodeId || 'null'}</div>
      <button onClick={() => {
        setResizingNode({
          nodeId: 'resizable-1',
          direction: 'se',
          startX: 100,
          startY: 100,
          startWidth: 400,
          startHeight: 300
        });
      }}>Start Resize</button>
      <button onClick={() => setResizingNode(null)}>Stop Resize</button>
      <button onClick={() => {
        updateNode('resizable-1', {
          style: {
            width: '500px',
            height: '400px'
          }
        });
      }}>Update Size</button>
      <button onClick={() => setSelectedNodeId('resizable-1')}>Select Resizable</button>
    </div>
  );
};

describe('Resize Functionality', () => {
  const initialSchema: SchemaNode = {
    type: 'div',
    id: 'root',
    body: [
      { type: 'resizable-card', id: 'resizable-1' },
      { type: 'non-resizable-button', id: 'button-1' }
    ]
  };

  it('should initialize resizingNode as null', () => {
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    expect(screen.getByTestId('resizing-node').textContent).toBe('null');
  });

  it('should set resizing state when starting resize', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const startButton = screen.getByText('Start Resize');
    
    // Start resizing
    await user.click(startButton);
    
    const resizingText = screen.getByTestId('resizing-node').textContent;
    const resizing = JSON.parse(resizingText || '{}');
    
    expect(resizing.nodeId).toBe('resizable-1');
    expect(resizing.direction).toBe('se');
    expect(resizing.startWidth).toBe(400);
    expect(resizing.startHeight).toBe(300);
  });

  it('should clear resizing state when stopping resize', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const startButton = screen.getByText('Start Resize');
    const stopButton = screen.getByText('Stop Resize');
    
    // Start then stop resizing
    await user.click(startButton);
    expect(screen.getByTestId('resizing-node').textContent).not.toBe('null');
    
    await user.click(stopButton);
    expect(screen.getByTestId('resizing-node').textContent).toBe('null');
  });

  it('should update node dimensions after resize', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const updateButton = screen.getByText('Update Size');
    
    // Get initial schema
    const initialSchemaText = screen.getByTestId('schema').textContent;
    const initial = JSON.parse(initialSchemaText || '{}');
    expect(initial.body[0].style).toBeUndefined();
    
    // Update node size
    await user.click(updateButton);
    
    // Get updated schema
    const updatedSchemaText = screen.getByTestId('schema').textContent;
    const updated = JSON.parse(updatedSchemaText || '{}');
    
    // Should have style with dimensions
    expect(updated.body[0].style).toBeDefined();
    expect(updated.body[0].style.width).toBe('500px');
    expect(updated.body[0].style.height).toBe('400px');
  });

  it('should identify resizable components from registry', () => {
    const resizableConfig = ComponentRegistry.getConfig('resizable-card');
    const nonResizableConfig = ComponentRegistry.getConfig('non-resizable-button');
    
    expect(resizableConfig?.resizable).toBe(true);
    expect(resizableConfig?.resizeConstraints).toBeDefined();
    expect(resizableConfig?.resizeConstraints?.minWidth).toBe(200);
    expect(resizableConfig?.resizeConstraints?.maxWidth).toBe(800);
    
    expect(nonResizableConfig?.resizable).toBe(false);
    expect(nonResizableConfig?.resizeConstraints).toBeUndefined();
  });

  it('should allow selecting a component', async () => {
    const user = userEvent.setup();
    
    render(
      <DesignerProvider initialSchema={initialSchema}>
        <TestComponent />
      </DesignerProvider>
    );
    
    const selectButton = screen.getByText('Select Resizable');
    
    // Initially no selection
    expect(screen.getByTestId('selected-node-id').textContent).toBe('null');
    
    // Select component
    await user.click(selectButton);
    expect(screen.getByTestId('selected-node-id').textContent).toBe('resizable-1');
  });

  it('should handle resize with constraints', () => {
    const config = ComponentRegistry.getConfig('resizable-card');
    const constraints = config?.resizeConstraints;
    
    expect(constraints).toBeDefined();
    if (constraints) {
      // Test min constraints
      let width = 150; // Below min
      let height = 50;  // Below min
      
      width = Math.max(constraints.minWidth || 0, width);
      height = Math.max(constraints.minHeight || 0, height);
      
      expect(width).toBe(200); // Should be clamped to min
      expect(height).toBe(100);
      
      // Test max constraints
      width = 1000; // Above max
      height = 700;  // Above max
      
      width = Math.min(constraints.maxWidth || Infinity, width);
      height = Math.min(constraints.maxHeight || Infinity, height);
      
      expect(width).toBe(800); // Should be clamped to max
      expect(height).toBe(600);
    }
  });
});
