import React from 'react';
import { SchemaRenderer } from '@object-ui/renderer';
import { useDesigner } from '../context/DesignerContext';
import type { SchemaNode } from '@object-ui/protocol';

interface CanvasProps {
  className?: string;
}

export const Canvas: React.FC<CanvasProps> = ({ className }) => {
  const { schema, selectedNodeId, setSelectedNodeId, hoveredNodeId, setHoveredNodeId } = useDesigner();
  
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };
  
  const handleNodeHover = (nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  };
  
  return (
    <div className={`h-full overflow-auto bg-white ${className || ''}`}>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <DesignerSchemaRenderer 
            schema={schema} 
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        </div>
      </div>
    </div>
  );
};

interface DesignerSchemaRendererProps {
  schema: SchemaNode;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
}

const DesignerSchemaRenderer: React.FC<DesignerSchemaRendererProps> = ({
  schema,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onNodeHover
}) => {
  const isSelected = schema.id === selectedNodeId;
  const isHovered = schema.id === hoveredNodeId;
  
  return (
    <div
      onClick={(e) => schema.id && onNodeClick(e, schema.id)}
      onMouseEnter={() => schema.id && onNodeHover(schema.id)}
      onMouseLeave={() => onNodeHover(null)}
      className="relative"
      style={{
        outline: isSelected ? '2px solid #3b82f6' : isHovered ? '2px dashed #93c5fd' : 'none',
        outlineOffset: '2px'
      }}
    >
      {/* Selection label */}
      {isSelected && schema.id && (
        <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded z-10">
          {schema.type} ({schema.id})
        </div>
      )}
      
      <SchemaRenderer schema={schema} />
    </div>
  );
};
