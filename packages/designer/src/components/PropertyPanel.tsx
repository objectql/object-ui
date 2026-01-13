import React from 'react';
import { useDesigner } from '../context/DesignerContext';
import { ComponentRegistry } from '@object-ui/renderer';
import type { SchemaNode } from '@object-ui/protocol';
import { Input, Label, Button } from '@object-ui/ui';

interface PropertyPanelProps {
  className?: string;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ className }) => {
  const { selectedNodeId, schema, updateNode, deleteNode } = useDesigner();
  
  if (!selectedNodeId) {
    return (
      <div className={`h-full overflow-y-auto bg-gray-50 border-l p-4 ${className || ''}`}>
        <div className="text-sm text-gray-500">
          Select a component to edit its properties
        </div>
      </div>
    );
  }
  
  // Find the selected node
  const selectedNode = findNodeById(schema, selectedNodeId);
  if (!selectedNode) {
    return (
      <div className={`h-full overflow-y-auto bg-gray-50 border-l p-4 ${className || ''}`}>
        <div className="text-sm text-red-500">
          Selected node not found
        </div>
      </div>
    );
  }
  
  const config = ComponentRegistry.getConfig(selectedNode.type);
  
  const handlePropertyChange = (propertyName: string, value: any) => {
    updateNode(selectedNodeId, { [propertyName]: value });
  };
  
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this component?')) {
      deleteNode(selectedNodeId);
    }
  };
  
  return (
    <div className={`h-full overflow-y-auto bg-gray-50 border-l ${className || ''}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Properties</h2>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
        
        <div className="mb-4 p-3 bg-white rounded border">
          <div className="text-xs text-gray-500 mb-1">Component Type</div>
          <div className="font-medium">{config?.label || selectedNode.type}</div>
          <div className="text-xs text-gray-400 mt-1">ID: {selectedNode.id}</div>
        </div>
        
        <div className="space-y-4">
          {/* Render input fields based on component metadata */}
          {config?.inputs?.map(input => {
            const currentValue = (selectedNode as any)[input.name];
            
            return (
              <div key={input.name} className="space-y-2">
                <Label htmlFor={`prop-${input.name}`}>
                  {input.label || input.name}
                  {input.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                
                {input.type === 'enum' && input.enum ? (
                  <select
                    id={`prop-${input.name}`}
                    value={currentValue || input.defaultValue || ''}
                    onChange={(e) => handlePropertyChange(input.name, e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select...</option>
                    {input.enum.map(option => {
                      const value = typeof option === 'string' ? option : option.value;
                      const label = typeof option === 'string' ? option : option.label;
                      return (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : input.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={`prop-${input.name}`}
                      type="checkbox"
                      checked={currentValue || false}
                      onChange={(e) => handlePropertyChange(input.name, e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor={`prop-${input.name}`} className="text-sm">
                      {input.description || 'Enable'}
                    </label>
                  </div>
                ) : input.type === 'number' ? (
                  <Input
                    id={`prop-${input.name}`}
                    type="number"
                    value={currentValue || input.defaultValue || ''}
                    onChange={(e) => handlePropertyChange(input.name, e.target.value ? Number(e.target.value) : undefined)}
                    placeholder={input.description}
                  />
                ) : (
                  <Input
                    id={`prop-${input.name}`}
                    type="text"
                    value={currentValue || input.defaultValue || ''}
                    onChange={(e) => handlePropertyChange(input.name, e.target.value)}
                    placeholder={input.description}
                  />
                )}
                
                {input.description && (
                  <div className="text-xs text-gray-500">{input.description}</div>
                )}
              </div>
            );
          })}
          
          {/* Always show className editor */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="prop-className">CSS Classes</Label>
            <Input
              id="prop-className"
              type="text"
              value={selectedNode.className || ''}
              onChange={(e) => handlePropertyChange('className', e.target.value)}
              placeholder="e.g., p-4 bg-white rounded"
            />
            <div className="text-xs text-gray-500">
              Tailwind CSS utility classes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to find a node by ID
function findNodeById(node: SchemaNode, id: string): SchemaNode | null {
  if (node.id === id) return node;
  
  if (node.body) {
    if (Array.isArray(node.body)) {
      for (const child of node.body) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    } else if (typeof node.body === 'object') {
      return findNodeById(node.body, id);
    }
  }
  
  return null;
}
