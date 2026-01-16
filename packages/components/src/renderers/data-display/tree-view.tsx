import { ComponentRegistry } from '@object-ui/core';
import type { TreeViewSchema, TreeNode } from '@object-ui/types';
import { ChevronRight, ChevronDown, Folder, File, FolderOpen, CircuitBoard } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

const TreeNodeComponent = ({ 
  node, 
  onNodeClick,
  isChild = false
}: { 
  node: TreeNode; 
  onNodeClick?: (node: TreeNode) => void;
  isChild?: boolean;
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
    <div className="relative">
       {/* Connecting line for siblings (visual aid, tricky to do perfectly without depth context, so we focus on the left border of the container) */}
       
      <div
        className={cn(
          'group flex items-center py-1.5 px-2 rounded-sm cursor-pointer transition-all duration-200 border border-transparent',
          'hover:bg-cyan-950/30 hover:border-cyan-500/20 hover:shadow-[inset_0_0_10px_-5px_cyan]',
          isOpen && hasChildren && 'bg-slate-900/40' // Active parent state
        )}
        onClick={handleClick}
      >
        {/* Indentation adjustment triggered by parent's padding/margin, not calculated prop here to allow CSS lines */}
        
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="mr-2 p-0.5 h-5 w-5 flex items-center justify-center rounded-sm hover:bg-cyan-500/20 text-cyan-600 transition-colors"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 drop-shadow-[0_0_5px_cyan]" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="mr-2 w-5 flex justify-center">
             <div className="w-1 h-1 rounded-full bg-slate-700/50 group-hover:bg-cyan-500/50" />
          </span>
        )}
        
        {node.icon === 'folder' || hasChildren ? (
          isOpen ? 
            <FolderOpen className="h-4 w-4 mr-2 text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" /> : 
            <Folder className="h-4 w-4 mr-2 text-cyan-600 group-hover:text-cyan-400 transition-colors" />
        ) : (
          <File className="h-4 w-4 mr-2 text-slate-500 group-hover:text-cyan-200 transition-colors" />
        )}
        
        <span className={cn(
            "text-sm font-mono tracking-wide transition-colors",
            isOpen ? "text-cyan-100 font-bold shadow-cyan-500/20" : "text-slate-400 group-hover:text-cyan-300"
        )}>
            {node.label}
        </span>
      </div>

      {/* Children Container with Circuit Line */}
      {hasChildren && isOpen && (
        <div className="relative ml-[11px] pl-3 border-l border-cyan-800/40 animate-in slide-in-from-left-2 fade-in duration-200">
           {/* Decorative little bulb at the junction */}
           <div className="absolute top-0 -left-[1px] -translate-x-1/2 w-1.5 h-1.5 bg-cyan-700/50 rounded-full" />
           
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              onNodeClick={onNodeClick}
              isChild={true}
            />
          ))}
          
           {/* Decorative end cap */}
           <div className="absolute bottom-0 -left-[1px] -translate-x-1/2 w-1 h-1 bg-cyan-800/50 rounded-full" />
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
      <div className={cn(
          'relative border border-border/60 rounded-lg p-3 bg-card/40 backdrop-blur-md overflow-hidden',
          'shadow-lg shadow-primary/5',
          className
        )} 
        {...props}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.1)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {schema.title && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/20 relative z-10">
            <CircuitBoard className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-primary">{schema.title}</h3>
          </div>
        )}
        <div className="space-y-1 relative z-10">
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
