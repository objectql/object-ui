import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { SchemaNode } from '@object-ui/core';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface DesignerContextValue {
  schema: SchemaNode;
  setSchema: (schema: SchemaNode) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredNodeId: string | null;
  setHoveredNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingType: string | null;
  setDraggingType: React.Dispatch<React.SetStateAction<string | null>>;
  draggingNodeId: string | null;
  setDraggingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  viewportMode: ViewportMode;
  setViewportMode: React.Dispatch<React.SetStateAction<ViewportMode>>;
  showComponentTree: boolean;
  setShowComponentTree: React.Dispatch<React.SetStateAction<boolean>>;
  addNode: (parentId: string | null, node: SchemaNode, index?: number) => void;
  updateNode: (id: string, updates: Partial<SchemaNode>) => void;
  removeNode: (id: string) => void;
  moveNode: (nodeId: string, targetParentId: string | null, targetIndex: number) => void;
  copyNode: (id: string) => void;
  pasteNode: (parentId: string | null) => void;
  canPaste: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const DesignerContext = createContext<DesignerContextValue | undefined>(undefined);

export const useDesigner = () => {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error('useDesigner must be used within a DesignerProvider');
  }
  return context;
};

// --- Helpers ---

// Generate ID
const generateId = (prefix = 'node') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

// Ensure all nodes have IDs
const ensureNodeIds = (node: SchemaNode, prefix = 'node'): SchemaNode => {
    const id = node.id || generateId(node.type);
    let body = node.body;
    
    if (Array.isArray(body)) {
        body = body.map((child, idx) => ensureNodeIds(child, `${id}-${idx}`));
    } else if (body && typeof body === 'object') {
        body = ensureNodeIds(body as SchemaNode, `${id}-child`);
    }

    return { ...node, id, body };
};

// Add Node to Schema Tree
const addNodeToParent = (root: SchemaNode, parentId: string | null, newNode: SchemaNode, index?: number): SchemaNode => {
    // If adding to root (parentId is null or matches root), but usually parentId is required.
    // However, if we drop on empty canvas, we might mean "add to root body".
    // For this logic, we assume we always target a container ID.
    
    if (root.id === parentId) {
        const body = Array.isArray(root.body) ? [...root.body] : (root.body ? [root.body as SchemaNode] : []);
        // Check if index is valid
        if (typeof index === 'number' && index >= 0 && index <= body.length) {
            body.splice(index, 0, newNode);
        } else {
            body.push(newNode);
        }
        return { ...root, body };
    }
    
    // Recursive
    if (Array.isArray(root.body)) {
        return {
            ...root,
            body: root.body.map(child => addNodeToParent(child, parentId, newNode, index))
        };
    } else if (root.body && typeof root.body === 'object') {
        return {
            ...root,
            body: addNodeToParent(root.body as SchemaNode, parentId, newNode, index)
        };
    }
    
    return root;
};

// Update Node
const updateNodeById = (node: SchemaNode, id: string, updates: Partial<SchemaNode>): SchemaNode => {
    if (node.id === id) {
        // Special merging for props/style? For now shallow merge
        return { ...node, ...updates };
    }
    
    if (Array.isArray(node.body)) {
        return {
            ...node,
            body: node.body.map(child => updateNodeById(child, id, updates))
        };
    } else if (node.body && typeof node.body === 'object') {
         return {
            ...node,
            body: updateNodeById(node.body as SchemaNode, id, updates)
        };
    }
    
    return node;
};

// Remove Node
const removeNodeById = (node: SchemaNode, id: string): SchemaNode | null => {
    if (node.id === id) return null; // Remove self
    
    if (Array.isArray(node.body)) {
        const newBody = node.body
            .map(child => removeNodeById(child, id))
            .filter(child => child !== null) as SchemaNode[];
        return { ...node, body: newBody };
    } else if (node.body && typeof node.body === 'object') {
        const newBody = removeNodeById(node.body as SchemaNode, id);
        // If child removed and was single object, what to do? undefined?
        return { ...node, body: newBody || undefined };
    }
    
    return node;
};

// Find Node by ID and return it
const findNodeById = (node: SchemaNode, id: string): SchemaNode | null => {
    if (node.id === id) return node;
    
    if (Array.isArray(node.body)) {
        for (const child of node.body) {
            const found = findNodeById(child, id);
            if (found) return found;
        }
    } else if (node.body && typeof node.body === 'object') {
        return findNodeById(node.body as SchemaNode, id);
    }
    
    return null;
};

// Move Node - removes from current location and adds to new location
const moveNodeInTree = (
    root: SchemaNode, 
    nodeId: string, 
    targetParentId: string | null, 
    targetIndex: number
): SchemaNode => {
    // First, find and extract the node
    const nodeToMove = findNodeById(root, nodeId);
    if (!nodeToMove) return root;
    
    // Don't allow moving a node into itself or its descendants
    if (targetParentId === nodeId || findNodeById(nodeToMove, targetParentId || '')) {
        return root;
    }
    
    // Remove the node from its current location
    const treeWithoutNode = removeNodeById(root, nodeId);
    if (!treeWithoutNode) return root;
    
    // Add it to the new location
    const finalTargetId = targetParentId || treeWithoutNode.id;
    return addNodeToParent(treeWithoutNode, finalTargetId, nodeToMove, targetIndex);
};


interface DesignerProviderProps {
  children?: React.ReactNode;
  initialSchema?: SchemaNode;
  onSchemaChange?: (schema: SchemaNode) => void;
}

const defaultSchema: SchemaNode = {
  type: 'div',
  className: 'h-full w-full p-8 grid grid-cols-2 gap-4',
  id: 'root',
  body: []
};


export const DesignerProvider: React.FC<DesignerProviderProps> = ({ 
  children, 
  initialSchema, 
  onSchemaChange 
}) => {
  // Initialize state
  const [schema, setSchemaState] = useState<SchemaNode>(() => ensureNodeIds(initialSchema || defaultSchema));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [showComponentTree, setShowComponentTree] = useState(true);
  
  // Undo/Redo state
  const [history, setHistory] = useState<SchemaNode[]>([ensureNodeIds(initialSchema || defaultSchema)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Copy/Paste state
  const [clipboard, setClipboard] = useState<SchemaNode | null>(null);

  // Notify parent on change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }
    onSchemaChange?.(schema);
  }, [schema, onSchemaChange]);

  // Add to history when schema changes (debounced)
  const addToHistory = useCallback((newSchema: SchemaNode) => {
    setHistory(prev => {
      // Remove any history after current index
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(newSchema);
      // Limit history to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
        // Index is now one less since we removed from start
        setHistoryIndex(newHistory.length - 1);
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  }, [historyIndex]);

  const setSchema = useCallback((newSchema: SchemaNode) => {
    const withIds = ensureNodeIds(newSchema);
    setSchemaState(withIds);
    addToHistory(withIds);
  }, [addToHistory]);

  const addNode = useCallback((parentId: string | null, node: SchemaNode, index?: number) => {
    const nodeWithId = ensureNodeIds(node);
    
    setSchemaState(prev => {
        const targetId = parentId || prev.id;
        const newSchema = addNodeToParent(prev, targetId, nodeWithId, index);
        addToHistory(newSchema);
        return newSchema;
    });
    
    // Select the new node
    setTimeout(() => setSelectedNodeId(nodeWithId.id || null), 50);
  }, [addToHistory]);

  const updateNode = useCallback((id: string, updates: Partial<SchemaNode>) => {
    setSchemaState(prev => {
      const newSchema = updateNodeById(prev, id, updates);
      addToHistory(newSchema);
      return newSchema;
    });
  }, [addToHistory]);
  
  const removeNode = useCallback((id: string) => {
    setSchemaState(prev => {
        const res = removeNodeById(prev, id);
        const newSchema = res || prev;
        addToHistory(newSchema);
        return newSchema;
    });
    setSelectedNodeId(null);
  }, [addToHistory]);

  const moveNode = useCallback((nodeId: string, targetParentId: string | null, targetIndex: number) => {
    setSchemaState(prev => {
      const newSchema = moveNodeInTree(prev, nodeId, targetParentId, targetIndex);
      addToHistory(newSchema);
      return newSchema;
    });
  }, [addToHistory]);

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSchemaState(history[newIndex]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSchemaState(history[newIndex]);
    }
  }, [historyIndex, history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Copy/Paste functions
  const copyNode = useCallback((id: string) => {
    const node = findNodeById(schema, id);
    if (node) {
      // Create a deep copy without the ID so it gets a new one when pasted
      const { id: originalId, ...nodeWithoutId } = node;
      setClipboard(nodeWithoutId as SchemaNode);
    }
  }, [schema]);

  const pasteNode = useCallback((parentId: string | null) => {
    if (clipboard) {
      addNode(parentId, clipboard);
    }
  }, [clipboard, addNode]);

  const canPaste = clipboard !== null;

  return (
    <DesignerContext.Provider value={{
      schema,
      setSchema,
      selectedNodeId,
      setSelectedNodeId,
      hoveredNodeId,
      setHoveredNodeId,
      draggingType,
      setDraggingType,
      draggingNodeId,
      setDraggingNodeId,
      viewportMode,
      setViewportMode,
      showComponentTree,
      setShowComponentTree,
      addNode,
      updateNode,
      removeNode,
      moveNode,
      copyNode,
      pasteNode,
      canPaste,
      undo,
      redo,
      canUndo,
      canRedo
    }}>
      {children}
    </DesignerContext.Provider>
  );
};
