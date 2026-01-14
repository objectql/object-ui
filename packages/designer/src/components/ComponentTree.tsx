import React, { useCallback, useMemo, useState, createContext, useContext } from 'react';
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

// Maximum depth to check when searching for selected descendants
// Prevents stack overflow with extremely deeply nested components
const MAX_TREE_DEPTH = 100;

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

// Context for controlling expansion state globally
interface TreeExpansionContextValue {
    expandAll: boolean;
    collapseAll: boolean;
}

const TreeExpansionContext = createContext<TreeExpansionContextValue>({
    expandAll: false,
    collapseAll: false
});

const TreeNode: React.FC<TreeNodeProps> = React.memo(({ node, level, isSelected, selectedNodeId, onSelect }) => {
    const expansionContext = useContext(TreeExpansionContext);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isVisible, setIsVisible] = useState(true);
    
    // Effect to handle expand/collapse all from parent
    React.useEffect(() => {
        if (expansionContext.expandAll) {
            setIsExpanded(true);
        } else if (expansionContext.collapseAll) {
            setIsExpanded(false);
        }
    }, [expansionContext.expandAll, expansionContext.collapseAll]);
    
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
    // Uses recursive approach with depth limiting to prevent stack overflow
    const hasSelectedDescendant = useMemo(() => {
        if (!selectedNodeId) return false;
        
        const checkNode = (n: SchemaNode, depth = 0): boolean => {
            // Prevent stack overflow with max depth check
            if (depth > MAX_TREE_DEPTH) return false;
            
            if (n.id === selectedNodeId) return true;
            if (!n.body) return false;
            
            const childNodes = Array.isArray(n.body) ? n.body : [n.body as SchemaNode];
            return childNodes.some(child => checkNode(child, depth + 1));
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
    const { schema, selectedNodeId, setSelectedNodeId, moveNodeUp, moveNodeDown } = useDesigner();
    const [expandTrigger, setExpandTrigger] = useState(0);
    const [collapseTrigger, setCollapseTrigger] = useState(0);
    
    const handleSelect = useCallback((id: string) => {
        setSelectedNodeId(id);
    }, [setSelectedNodeId]);
    
    const handleExpandAll = useCallback(() => {
        setExpandTrigger(prev => prev + 1);
    }, []);
    
    const handleCollapseAll = useCallback(() => {
        setCollapseTrigger(prev => prev + 1);
    }, []);
    
    // Keyboard navigation for tree
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle keyboard events when tree is focused and not in an input
            const target = e.target as HTMLElement;
            const isEditing = 
                target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.tagName === 'SELECT' ||
                target.isContentEditable;
            
            if (isEditing || !selectedNodeId) return;
            
            // Arrow Up: Move component up in tree (reorder)
            if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                moveNodeUp(selectedNodeId);
            }
            // Arrow Down: Move component down in tree (reorder)
            else if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                moveNodeDown(selectedNodeId);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, moveNodeUp, moveNodeDown]);
    
    const expansionContextValue = useMemo(() => ({
        expandAll: expandTrigger > 0,
        collapseAll: collapseTrigger > 0
    }), [expandTrigger, collapseTrigger]);
    
    return (
        <TreeExpansionContext.Provider value={expansionContextValue}>
            <div className={cn("flex flex-col h-full bg-white", className)}>
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
                            onClick={handleExpandAll}
                        >
                            Expand All
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs flex-1"
                            title="Collapse all nodes"
                            onClick={handleCollapseAll}
                        >
                            Collapse All
                        </Button>
                    </div>
                </div>
            </div>
        </TreeExpansionContext.Provider>
    );
});

ComponentTree.displayName = 'ComponentTree';
