import { ComponentRegistry } from '@object-ui/core';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: any;
}

const TreeNodeComponent = ({ 
  node, 
  level = 0, 
  onNodeClick 
}: { 
  node: TreeNode; 
  level?: number;
  onNodeClick?: (node: TreeNode) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center py-1.5 px-2 hover:bg-accent rounded-md cursor-pointer',
          'transition-colors'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="mr-1 p-0 h-4 w-4 flex items-center justify-center hover:bg-accent/50 rounded"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="mr-1 w-4" />
        )}
        {node.icon === 'folder' ? (
          <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
        ) : node.icon === 'file' ? (
          <File className="h-4 w-4 mr-2 text-muted-foreground" />
        ) : null}
        <span className="text-sm">{node.label}</span>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

ComponentRegistry.register('tree-view', 
  ({ schema, className, ...props }) => {
    const handleNodeClick = (node: TreeNode) => {
      if (schema.onNodeClick) {
        schema.onNodeClick(node);
      }
    };

    return (
      <div className={cn('border rounded-md p-2 bg-background', className)} {...props}>
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2 px-2">{schema.title}</h3>
        )}
        <div className="space-y-0.5">
          {schema.nodes?.map((node: TreeNode) => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              onNodeClick={handleNodeClick}
            />
          ))}
        </div>
      </div>
    );
  },
  {
    label: 'Tree View',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { 
        name: 'nodes', 
        type: 'array', 
        label: 'Tree Nodes',
        description: 'Array of { id, label, icon, children, data }'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'File Explorer',
      nodes: [
        {
          id: '1',
          label: 'Documents',
          icon: 'folder',
          children: [
            { id: '1-1', label: 'Resume.pdf', icon: 'file' },
            { id: '1-2', label: 'Cover Letter.docx', icon: 'file' }
          ]
        },
        {
          id: '2',
          label: 'Photos',
          icon: 'folder',
          children: [
            { id: '2-1', label: 'Vacation', icon: 'folder', children: [
              { id: '2-1-1', label: 'Beach.jpg', icon: 'file' }
            ]},
            { id: '2-2', label: 'Family.jpg', icon: 'file' }
          ]
        },
        {
          id: '3',
          label: 'README.md',
          icon: 'file'
        }
      ]
    }
  }
);
