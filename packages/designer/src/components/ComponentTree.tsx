import React, { useCallback, useMemo, useState } from 'react';
import { useDesigner } from '../context/DesignerContext';
import { ScrollArea } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { 
    ChevronRight, 
    ChevronDown, 
    Layers, 
    Eye, 
    EyeOff,
    GripVertical 
} from 'lucide-react';
import type { SchemaNode } from '@object-ui/core';

interface ComponentTreeProps {
    className?: string;
}

interface TreeNodeProps {
    node: SchemaNode;
    level: number;
    isSelected: boolean;
    selectedNodeId: string | null;
    onSelect: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = React.memo(({ node, level, isSelected, selectedNodeId, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isVisible, setIsVisible] = useState(true);
    
    const hasChildren = useMemo(() => {
        if (!node.body) return false;
        if (Array.isArray(node.body)) return node.body.length > 0;
        return typeof node.body === 'object';
    }, [node.body]);
    
    const children = useMemo(() => {
        if (!node.body) return [];
        if (Array.isArray(node.body)) return node.body;
        return [node.body as SchemaNode];
    }, [node.body]);
    
    // Check if selectedNodeId exists anywhere in this node's subtree
    const hasSelectedDescendant = useMemo(() => {
        if (!selectedNodeId) return false;
        
        const checkNode = (n: SchemaNode): boolean => {
            if (n.id === selectedNodeId) return true;
            if (!n.body) return false;
            
            const childNodes = Array.isArray(n.body) ? n.body : [n.body as SchemaNode];
            return childNodes.some(child => checkNode(child));
        };
        
        return children.some(child => checkNode(child));
    }, [children, selectedNodeId]);
    
    const handleClick = useCallback(() => {
        onSelect(node.id || '');
    }, [node.id, onSelect]);
    
    const toggleExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    }, []);
    
    const toggleVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsVisible(prev => !prev);
    }, []);
    
    return (
        <div>
            <div
                onClick={handleClick}
                className={cn(
                    "flex items-center gap-1 py-1.5 px-2 hover:bg-blue-50 cursor-pointer transition-colors group text-sm border-l-2",
                    isSelected 
                        ? "bg-blue-100 border-blue-600 text-blue-900" 
                        : hasSelectedDescendant 
                            ? "border-blue-300 text-gray-700" 
                            : "border-transparent text-gray-700"
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {/* Expand/Collapse Button */}
                <button
                    onClick={toggleExpand}
                    className={cn(
                        "w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-transform",
                        !hasChildren && "opacity-0 pointer-events-none"
                    )}
                >
                    {isExpanded ? (
                        <ChevronDown size={14} />
                    ) : (
                        <ChevronRight size={14} />
                    )}
                </button>
                
                {/* Drag Handle */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={12} className="text-gray-400" />
                </div>
                
                {/* Node Type/Label */}
                <span className="flex-1 truncate font-medium">
                    {node.type}
                </span>
                
                {/* Node ID Badge */}
                {node.id && (
                    <span className="text-[9px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {node.id.split('-')[0]}
                    </span>
                )}
                
                {/* Visibility Toggle */}
                <button
                    onClick={toggleVisibility}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700"
                    title={isVisible ? "Hide component" : "Show component"}
                >
                    {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>
            
            {/* Children */}
            {hasChildren && isExpanded && (
                <div className={cn(!isVisible && "opacity-50")}>
                    {children.map((child, index) => (
                        <TreeNode
                            key={child.id || `child-${index}`}
                            node={child}
                            level={level + 1}
                            isSelected={child.id === selectedNodeId}
                            selectedNodeId={selectedNodeId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

TreeNode.displayName = 'TreeNode';

export const ComponentTree: React.FC<ComponentTreeProps> = React.memo(({ className }) => {
    const { schema, selectedNodeId, setSelectedNodeId } = useDesigner();
    
    const handleSelect = useCallback((id: string) => {
        setSelectedNodeId(id);
    }, [setSelectedNodeId]);
    
    return (
        <div className={cn("flex flex-col h-full bg-white border-r", className)}>
            <div className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Component Tree</h2>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Navigate and organize components</p>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {schema && (
                        <TreeNode
                            node={schema}
                            level={0}
                            isSelected={selectedNodeId === schema.id}
                            selectedNodeId={selectedNodeId}
                            onSelect={handleSelect}
                        />
                    )}
                </div>
            </ScrollArea>
            
            {/* Tree Actions */}
            <div className="px-4 py-2 border-t shrink-0 bg-gray-50">
                <div className="flex gap-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs flex-1"
                        title="Expand all nodes"
                    >
                        Expand All
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs flex-1"
                        title="Collapse all nodes"
                    >
                        Collapse All
                    </Button>
                </div>
            </div>
        </div>
    );
});

ComponentTree.displayName = 'ComponentTree';
