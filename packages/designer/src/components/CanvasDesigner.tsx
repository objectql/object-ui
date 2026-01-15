/**
 * CanvasDesigner - Free-form canvas designer with absolute positioning
 * 
 * This component provides a canvas-like interface where components can be:
 * - Dragged to any position (absolute positioning)
 * - Resized freely
 * - Positioned with x,y coordinates
 * - Arranged on a visual canvas
 */

import React, { useCallback, useState, useRef } from 'react';
import { DesignerProvider } from '../context/DesignerContext';
import { PropertyPanel } from './PropertyPanel';
import { FilteredComponentPalette } from './FilteredComponentPalette';
import { ComponentTree } from './ComponentTree';
import { useDesigner } from '../context/DesignerContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { SchemaNode } from '@object-ui/core';
import type { CanvasDesignerConfig } from '../types/designer-modes';
import { SchemaRenderer } from '@object-ui/react';
import { ResizeHandles } from './ResizeHandle';
import { ComponentRegistry } from '@object-ui/core';
import { cn } from '@object-ui/components';

interface CanvasDesignerProps {
  initialSchema?: SchemaNode;
  onSchemaChange?: (schema: SchemaNode) => void;
  config?: Partial<CanvasDesignerConfig>;
}

// Canvas-specific component categories (all visual components)
const CANVAS_CATEGORIES = {
  'Basic': ['div', 'card', 'text', 'button', 'image'],
  'Form': ['input', 'textarea', 'select', 'checkbox', 'switch'],
  'Layout': ['stack', 'grid'],
  'Display': ['badge', 'avatar', 'separator']
};

// Allowed components for canvas designer (all visual components)
const CANVAS_COMPONENTS = [
  'div', 'card', 'text', 'span', 'button', 'image',
  'input', 'textarea', 'select', 'checkbox', 'switch', 'label',
  'stack', 'grid', 'separator',
  'badge', 'avatar'
];

const FreeFormCanvas: React.FC<{ showGrid?: boolean; gridSize?: number }> = ({ 
  showGrid = true, 
  gridSize = 20 
}) => {
  const {
    schema,
    selectedNodeId,
    setSelectedNodeId,
    draggingType,
    setDraggingType,
    addNode,
    updateNode,
    resizingNode,
    setResizingNode,
  } = useDesigner();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedNode, setDraggedNode] = useState<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  // Handle drop from palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!canvasRef.current || !draggingType) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Snap to grid if enabled
    const snappedX = showGrid ? Math.round(x / gridSize) * gridSize : x;
    const snappedY = showGrid ? Math.round(y / gridSize) * gridSize : y;

    // Create new node with absolute positioning
    const config = ComponentRegistry.getConfig(draggingType);
    const newNode: SchemaNode = {
      type: draggingType,
      ...(config?.defaultProps || {}),
      style: {
        position: 'absolute',
        left: `${snappedX}px`,
        top: `${snappedY}px`,
        ...(config?.defaultProps?.style || {}),
      },
    };

    // Add to root
    addNode(schema.id || null, newNode);
    setDraggingType(null);
  }, [draggingType, schema.id, addNode, setDraggingType, showGrid, gridSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle canvas component drag start
  const handleCanvasDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    setDraggedNode({
      id: nodeId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
  }, []);

  // Handle canvas component drag
  const handleCanvasDrag = useCallback((e: MouseEvent) => {
    if (!draggedNode || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - draggedNode.offsetX;
    const y = e.clientY - rect.top - draggedNode.offsetY;

    // Snap to grid
    const snappedX = showGrid ? Math.round(x / gridSize) * gridSize : x;
    const snappedY = showGrid ? Math.round(y / gridSize) * gridSize : y;

    // Update node position
    updateNode(draggedNode.id, {
      style: {
        position: 'absolute',
        left: `${snappedX}px`,
        top: `${snappedY}px`,
      },
    });
  }, [draggedNode, updateNode, showGrid, gridSize]);

  // Setup mouse move/up listeners
  React.useEffect(() => {
    if (!draggedNode) return;

    const handleMouseMove = (e: MouseEvent) => handleCanvasDrag(e);
    const handleMouseUp = () => setDraggedNode(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNode, handleCanvasDrag]);

  // Render canvas children with absolute positioning
  const renderCanvasChildren = (nodes: SchemaNode[]) => {
    if (!Array.isArray(nodes)) return null;

    return nodes.map((node) => {
      const isSelected = node.id === selectedNodeId;
      const isResizable = ComponentRegistry.getConfig(node.type)?.resizable || false;

      return (
        <div
          key={node.id}
          className={cn(
            'canvas-node',
            isSelected && 'ring-2 ring-blue-500',
            'cursor-move'
          )}
          style={{
            ...(node.style as React.CSSProperties),
            position: 'absolute',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeId(node.id || null);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (node.id) handleCanvasDragStart(e, node.id);
          }}
        >
          <SchemaRenderer schema={node} />
          
          {/* Resize handles for selected node */}
          {isSelected && isResizable && (
            <ResizeHandles
              nodeId={node.id || ''}
              onResizeStart={(direction) => {
                const element = document.querySelector(`[data-obj-id="${node.id}"]`) as HTMLElement;
                if (element) {
                  setResizingNode({
                    nodeId: node.id || '',
                    direction,
                    startX: 0,
                    startY: 0,
                    startWidth: element.offsetWidth,
                    startHeight: element.offsetHeight,
                  });
                }
              }}
            />
          )}
        </div>
      );
    });
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto bg-white"
      style={{
        backgroundImage: showGrid
          ? `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `
          : undefined,
        backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : undefined,
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => setSelectedNodeId(null)}
    >
      {/* Canvas content */}
      {schema.body && Array.isArray(schema.body) && renderCanvasChildren(schema.body)}

      {/* Empty state */}
      {(!schema.body || (Array.isArray(schema.body) && schema.body.length === 0)) && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-lg font-medium">Free-form Canvas</p>
            <p className="text-sm mt-2">Drag components here to position them freely</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const CanvasDesignerContent: React.FC<{ config?: Partial<CanvasDesignerConfig> }> = ({ config }) => {
  const { 
    undo, 
    redo, 
    copyNode,
    cutNode,
    duplicateNode,
    pasteNode, 
    removeNode, 
    selectedNodeId, 
    canUndo, 
    canRedo
  } = useDesigner();
  
  // Use shared keyboard shortcuts hook
  useKeyboardShortcuts({
    undo,
    redo,
    copyNode,
    cutNode,
    duplicateNode,
    pasteNode,
    removeNode,
    selectedNodeId,
    canUndo,
    canRedo,
  });

  return (
    <div className="h-full flex flex-col bg-white text-gray-900 font-sans">
      {/* Header */}
      <div className="h-12 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center px-4">
        <h1 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
          Canvas Designer
        </h1>
        <div className="ml-4 text-xs text-gray-500">
          Free-form design with absolute positioning
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Canvas Components & Component Tree */}
        <div className="w-64 md:w-72 flex-shrink-0 z-10 shadow-[1px_0_5px_rgba(0,0,0,0.03)] h-full flex flex-col border-r border-gray-200">
          {/* Component Palette */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <FilteredComponentPalette 
              className="h-full"
              allowedComponents={CANVAS_COMPONENTS}
              categories={CANVAS_CATEGORIES}
              title="Canvas Components"
            />
          </div>
          
          {/* Component Tree */}
          <div className="h-64 border-t border-gray-200 overflow-hidden">
            <ComponentTree className="h-full" />
          </div>
        </div>
        
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-gray-50 z-0 min-w-0">
          <FreeFormCanvas 
            showGrid={config?.showGrid !== false}
            gridSize={config?.gridSize || 20}
          />
        </div>
        
        {/* Right Sidebar - Property Panel */}
        <div className="w-72 md:w-80 flex-shrink-0 z-10 shadow-[-1px_0_5px_rgba(0,0,0,0.03)] h-full">
           <PropertyPanel className="h-full border-l-0 shadow-none border-l custom-scrollbar" />
        </div>
      </div>
    </div>
  );
};

export const CanvasDesigner: React.FC<CanvasDesignerProps> = ({ 
  initialSchema, 
  onSchemaChange,
  config 
}) => {
  // Default initial schema for canvas with absolute positioning root
  const defaultCanvasSchema: SchemaNode = {
    type: 'div',
    className: 'relative',
    style: {
      width: '100%',
      height: '100%',
      minHeight: '600px',
    },
    id: 'canvas-root',
    body: []
  };

  return (
    <DesignerProvider 
      initialSchema={initialSchema || defaultCanvasSchema} 
      onSchemaChange={onSchemaChange}
    >
      <CanvasDesignerContent config={config} />
    </DesignerProvider>
  );
};
