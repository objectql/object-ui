import React, { useEffect } from 'react';
import { DesignerProvider } from '../context/DesignerContext';
import { LeftSidebar } from './LeftSidebar';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { useDesigner } from '../context/DesignerContext';
import type { SchemaNode } from '@object-ui/core';

interface DesignerProps {
  initialSchema?: SchemaNode;
  onSchemaChange?: (schema: SchemaNode) => void;
}


export const DesignerContent: React.FC = () => {
  const { 
    undo, 
    redo, 
    copyNode, 
    pasteNode, 
    removeNode, 
    selectedNodeId, 
    canUndo, 
    canRedo
  } = useDesigner();
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an editable element
      const target = e.target as HTMLElement;
      const isEditing = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y / Cmd+Shift+Z
      else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
      // Copy: Ctrl+C / Cmd+C (only when not editing)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isEditing && selectedNodeId) {
        e.preventDefault();
        copyNode(selectedNodeId);
      }
      // Paste: Ctrl+V / Cmd+V (only when not editing)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isEditing) {
        e.preventDefault();
        pasteNode(selectedNodeId);
      }
      // Delete: Delete / Backspace (only when not editing)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copyNode, pasteNode, removeNode, selectedNodeId, canUndo, canRedo]);

  return (
    <div className="h-full flex flex-col bg-white text-gray-900 font-sans">
      {/* <Toolbar /> removed, moved to parent */}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Combined Component Palette and Tree */}
        <div className="w-72 flex-shrink-0 z-10 shadow-[1px_0_5px_rgba(0,0,0,0.03)] h-full">
           <LeftSidebar className="h-full border-r-0" />
        </div>
        
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-gray-100 z-0">
           <Canvas className="h-full w-full" />
        </div>
        
        {/* Right Sidebar - Property Panel */}
        <div className="w-80 flex-shrink-0 z-10 shadow-[-1px_0_5px_rgba(0,0,0,0.03)] h-full">
           <PropertyPanel className="h-full border-l-0 shadow-none border-l custom-scrollbar" />
        </div>
      </div>
    </div>
  );
};

export const Designer: React.FC<DesignerProps> = ({ initialSchema, onSchemaChange }) => {
  return (
    <DesignerProvider initialSchema={initialSchema} onSchemaChange={onSchemaChange}>
      <DesignerContent />
    </DesignerProvider>
  );
};
