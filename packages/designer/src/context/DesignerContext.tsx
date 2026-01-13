import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SchemaNode } from '@object-ui/protocol';

export interface DesignerContextValue {
  schema: SchemaNode;
  setSchema: (schema: SchemaNode) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  updateNode: (id: string, updates: Partial<SchemaNode>) => void;
  addNode: (parentId: string | null, node: SchemaNode, index?: number) => void;
  deleteNode: (id: string) => void;
  moveNode: (nodeId: string, targetParentId: string | null, targetIndex: number) => void;
}

const DesignerContext = createContext<DesignerContextValue | null>(null);

export const useDesigner = () => {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error('useDesigner must be used within a DesignerProvider');
  }
  return context;
};

interface DesignerProviderProps {
  children: React.ReactNode;
  initialSchema?: SchemaNode;
  onSchemaChange?: (schema: SchemaNode) => void;
}

// Helper function to ensure all nodes have unique IDs
const ensureNodeIds = (node: SchemaNode, idPrefix = ''): SchemaNode => {
  const nodeId = node.id || `${idPrefix}${node.type}-${Math.random().toString(36).substr(2, 9)}`;
  const result: SchemaNode = { ...node, id: nodeId };
  
  if (node.body) {
    if (Array.isArray(node.body)) {
      result.body = node.body.map((child) => ensureNodeIds(child, `${nodeId}-`));
    } else if (typeof node.body === 'object') {
      result.body = ensureNodeIds(node.body, `${nodeId}-`);
    }
  }
  
  return result;
};

// Helper function to find a node by ID
const findNode = (node: SchemaNode, id: string): SchemaNode | null => {
  if (node.id === id) return node;
  
  if (node.body) {
    if (Array.isArray(node.body)) {
      for (const child of node.body) {
        const found = findNode(child, id);
        if (found) return found;
      }
    } else if (typeof node.body === 'object') {
      return findNode(node.body, id);
    }
  }
  
  return null;
};

// Helper function to update a node by ID
const updateNodeById = (node: SchemaNode, id: string, updates: Partial<SchemaNode>): SchemaNode => {
  if (node.id === id) {
    return { ...node, ...updates };
  }
  
  if (node.body) {
    if (Array.isArray(node.body)) {
      return {
        ...node,
        body: node.body.map(child => updateNodeById(child, id, updates))
      };
    } else if (typeof node.body === 'object') {
      return {
        ...node,
        body: updateNodeById(node.body, id, updates)
      };
    }
  }
  
  return node;
};

// Helper function to delete a node by ID
const deleteNodeById = (node: SchemaNode, id: string): SchemaNode | null => {
  if (node.body && Array.isArray(node.body)) {
    const filteredBody = node.body
      .filter(child => child.id !== id)
      .map(child => deleteNodeById(child, id))
      .filter(child => child !== null) as SchemaNode[];
    
    return { ...node, body: filteredBody };
  } else if (node.body && typeof node.body === 'object' && !Array.isArray(node.body)) {
    if (node.body.id === id) {
      return { ...node, body: undefined };
    }
    const updatedBody = deleteNodeById(node.body, id);
    return { ...node, body: updatedBody || undefined };
  }
  
  return node;
};

// Helper function to add a node to a parent
const addNodeToParent = (
  node: SchemaNode,
  parentId: string | null,
  newNode: SchemaNode,
  index?: number
): SchemaNode => {
  // If no parent, replace the root
  if (parentId === null) {
    return newNode;
  }
  
  if (node.id === parentId) {
    const newNodeWithId = ensureNodeIds(newNode, `${node.id}-`);
    
    if (!node.body) {
      return { ...node, body: [newNodeWithId] };
    }
    
    if (Array.isArray(node.body)) {
      const newBody = [...node.body];
      if (index !== undefined && index >= 0 && index <= newBody.length) {
        newBody.splice(index, 0, newNodeWithId);
      } else {
        newBody.push(newNodeWithId);
      }
      return { ...node, body: newBody };
    }
    
    // If body is a single node, convert to array
    return { ...node, body: [node.body, newNodeWithId] };
  }
  
  if (node.body) {
    if (Array.isArray(node.body)) {
      return {
        ...node,
        body: node.body.map(child => addNodeToParent(child, parentId, newNode, index))
      };
    } else if (typeof node.body === 'object') {
      return {
        ...node,
        body: addNodeToParent(node.body, parentId, newNode, index)
      };
    }
  }
  
  return node;
};

export const DesignerProvider: React.FC<DesignerProviderProps> = ({
  children,
  initialSchema,
  onSchemaChange
}) => {
  const [schema, setSchemaState] = useState<SchemaNode>(() => {
    const defaultSchema: SchemaNode = {
      type: 'div',
      id: 'root',
      className: 'p-4',
      body: []
    };
    return ensureNodeIds(initialSchema || defaultSchema);
  });
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  const setSchema = useCallback((newSchema: SchemaNode) => {
    const schemaWithIds = ensureNodeIds(newSchema);
    setSchemaState(schemaWithIds);
    onSchemaChange?.(schemaWithIds);
  }, [onSchemaChange]);
  
  const updateNode = useCallback((id: string, updates: Partial<SchemaNode>) => {
    setSchemaState(prev => {
      const updated = updateNodeById(prev, id, updates);
      onSchemaChange?.(updated);
      return updated;
    });
  }, [onSchemaChange]);
  
  const addNode = useCallback((parentId: string | null, node: SchemaNode, index?: number) => {
    setSchemaState(prev => {
      const updated = addNodeToParent(prev, parentId, node, index);
      onSchemaChange?.(updated);
      return updated;
    });
  }, [onSchemaChange]);
  
  const deleteNode = useCallback((id: string) => {
    setSchemaState(prev => {
      const updated = deleteNodeById(prev, id);
      if (updated) {
        onSchemaChange?.(updated);
        return updated;
      }
      return prev;
    });
    
    // Clear selection if deleted node was selected
    setSelectedNodeId(prev => prev === id ? null : prev);
  }, [onSchemaChange]);
  
  const moveNode = useCallback((nodeId: string, targetParentId: string | null, targetIndex: number) => {
    setSchemaState(prev => {
      // Find and extract the node
      const node = findNode(prev, nodeId);
      if (!node) return prev;
      
      // Remove from current location
      let updated = deleteNodeById(prev, nodeId);
      if (!updated) return prev;
      
      // Add to new location
      updated = addNodeToParent(updated, targetParentId, node, targetIndex);
      onSchemaChange?.(updated);
      return updated;
    });
  }, [onSchemaChange]);
  
  const value: DesignerContextValue = {
    schema,
    setSchema,
    selectedNodeId,
    setSelectedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    updateNode,
    addNode,
    deleteNode,
    moveNode
  };
  
  return (
    <DesignerContext.Provider value={value}>
      {children}
    </DesignerContext.Provider>
  );
};
