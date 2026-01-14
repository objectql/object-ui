import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import { useDesigner } from '../context/DesignerContext';
import { ContextMenu } from './ContextMenu';
import { ResizeHandles, ResizeDirection } from './ResizeHandle';
import { cn } from '@object-ui/components';
import { MousePointer2 } from 'lucide-react';

interface CanvasProps {
    className?: string;
}

// Constants for drag and drop
const INSERT_AT_START = 0;
const INSERT_AT_END = undefined; // undefined means append to end in addNode/moveNode

// Context menu configuration
// Set to true to allow context menu on the root component, false to disable it
const ALLOW_ROOT_CONTEXT_MENU = false;

export const Canvas: React.FC<CanvasProps> = React.memo(({ className }) => {
    const { 
        schema, 
        selectedNodeId, 
        setSelectedNodeId, 
        hoveredNodeId, 
        setHoveredNodeId,
        draggingType,
        draggingNodeId,
        setDraggingNodeId,
        resizingNode,
        setResizingNode,
        addNode,
        moveNode,
        updateNode,
        viewportMode,
    } = useDesigner();

    const [scale, setScale] = useState(1);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
    const canvasRef = React.useRef<HTMLDivElement>(null);
    
    // Memoize canvas width calculation
    const canvasWidth = useMemo(() => {
        switch (viewportMode) {
            case 'mobile': return '375px'; // iPhone size
            case 'tablet': return '768px'; // iPad size
            case 'desktop': return '1024px'; // Desktop size
            default: return '1024px';
        }
    }, [viewportMode]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Close context menu if open
        setContextMenu(null);
        
        // Find closest element with data-obj-id
        const target = (e.target as Element).closest('[data-obj-id]');
        if (target) {
            e.stopPropagation();
            const id = target.getAttribute('data-obj-id');
            setSelectedNodeId(id);
        } else {
            // Clicked on empty canvas area
            setSelectedNodeId(null);
        }
    }, [setSelectedNodeId]);
    
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        
        // Find closest element with data-obj-id
        const target = (e.target as Element).closest('[data-obj-id]');
        if (target) {
            const id = target.getAttribute('data-obj-id');
            const isRoot = id === schema.id;
            
            if (id && (!isRoot || ALLOW_ROOT_CONTEXT_MENU)) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    nodeId: id
                });
                setSelectedNodeId(id);
            }
        }
    }, [schema.id, setSelectedNodeId]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (!draggingType && !draggingNodeId) return;
        e.preventDefault();
        
        const target = (e.target as Element).closest('[data-obj-id]');
        if (target) {
            e.stopPropagation();
            const id = target.getAttribute('data-obj-id');
            // Don't allow dropping on the node being dragged
            if (id !== draggingNodeId) {
                setHoveredNodeId(id);
                e.dataTransfer.dropEffect = draggingNodeId ? 'move' : 'copy';
            }
        } else {
            setHoveredNodeId(null);
        }
    }, [draggingType, draggingNodeId, setHoveredNodeId]);
    
    const handleDragLeave = useCallback(() => {
        setHoveredNodeId(null);
    }, [setHoveredNodeId]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        const target = (e.target as Element).closest('[data-obj-id]');
        const targetId = target?.getAttribute('data-obj-id');

        if (targetId) {
            e.stopPropagation();
            
            // Calculate insertion index based on drop position
            const targetRect = target?.getBoundingClientRect();
            let insertIndex: number | undefined = INSERT_AT_START;
            
            if (targetRect) {
                // Calculate relative position within the target
                const relativeY = e.clientY - targetRect.top;
                const relativePosition = relativeY / targetRect.height;
                
                // If dropping in the bottom half, append to end; otherwise insert at beginning
                insertIndex = relativePosition > 0.5 ? INSERT_AT_END : INSERT_AT_START;
            }
            
            // Handle moving existing component
            if (draggingNodeId) {
                // Don't allow dropping on itself
                if (draggingNodeId !== targetId) {
                    moveNode(draggingNodeId, targetId, insertIndex ?? Number.MAX_SAFE_INTEGER);
                }
                setDraggingNodeId(null);
            }
            // Handle adding new component from palette
            else if (draggingType) {
                const config = ComponentRegistry.getConfig(draggingType);
                if (config) {
                    const newNode = {
                        type: draggingType,
                        ...(config.defaultProps || {}),
                        body: config.defaultChildren || undefined
                    };
                    addNode(targetId, newNode, insertIndex);
                }
            }
        }
        
        setHoveredNodeId(null);
    }, [draggingNodeId, draggingType, moveNode, addNode, setDraggingNodeId, setHoveredNodeId]);
    
    // Resize handlers
    const handleResizeStart = useCallback((direction: ResizeDirection, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!selectedNodeId) return;
        
        const element = canvasRef.current?.querySelector(`[data-obj-id="${selectedNodeId}"]`);
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        
        setResizingNode({
            nodeId: selectedNodeId,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height
        });
    }, [selectedNodeId, setResizingNode]);

    // Global mouse move and mouse up for resizing
    useEffect(() => {
        if (!resizingNode) return;
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingNode) return;
            
            const deltaX = e.clientX - resizingNode.startX;
            const deltaY = e.clientY - resizingNode.startY;
            
            let newWidth = resizingNode.startWidth;
            let newHeight = resizingNode.startHeight;
            
            // Calculate new dimensions based on direction
            if (resizingNode.direction.includes('e')) {
                newWidth = Math.max(100, resizingNode.startWidth + deltaX);
            }
            if (resizingNode.direction.includes('w')) {
                newWidth = Math.max(100, resizingNode.startWidth - deltaX);
            }
            if (resizingNode.direction.includes('s')) {
                newHeight = Math.max(50, resizingNode.startHeight + deltaY);
            }
            if (resizingNode.direction.includes('n')) {
                newHeight = Math.max(50, resizingNode.startHeight - deltaY);
            }
            
            // Apply constraints from component config
            const config = ComponentRegistry.getConfig(schema.type);
            if (config?.resizeConstraints) {
                const constraints = config.resizeConstraints;
                if (constraints.minWidth) newWidth = Math.max(constraints.minWidth, newWidth);
                if (constraints.maxWidth) newWidth = Math.min(constraints.maxWidth, newWidth);
                if (constraints.minHeight) newHeight = Math.max(constraints.minHeight, newHeight);
                if (constraints.maxHeight) newHeight = Math.min(constraints.maxHeight, newHeight);
            }
            
            // Update the element's inline style temporarily for visual feedback
            const element = canvasRef.current?.querySelector(`[data-obj-id="${resizingNode.nodeId}"]`) as HTMLElement;
            if (element) {
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
            }
        };
        
        const handleMouseUp = () => {
            if (!resizingNode) return;
            
            // Get final dimensions and update schema
            const element = canvasRef.current?.querySelector(`[data-obj-id="${resizingNode.nodeId}"]`) as HTMLElement;
            if (element) {
                const width = element.style.width;
                const height = element.style.height;
                
                // Update node with new dimensions in className
                // We'll add custom width/height to the existing className
                const currentNode = findNodeInSchema(schema, resizingNode.nodeId);
                if (currentNode) {
                    const existingClasses = currentNode.className || '';
                    // Remove any existing width/height classes
                    let newClassName = existingClasses
                        .split(' ')
                        .filter(c => !c.startsWith('w-') && !c.startsWith('h-') && !c.includes('width') && !c.includes('height'))
                        .join(' ');
                    
                    // Add inline style instead via data attribute for persistent sizing
                    updateNode(resizingNode.nodeId, {
                        style: {
                            width,
                            height
                        }
                    });
                }
                
                // Clear inline style after update
                element.style.width = '';
                element.style.height = '';
            }
            
            setResizingNode(null);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingNode, setResizingNode, updateNode, schema]);
    
    // Helper to find node in schema
    const findNodeInSchema = (node: any, targetId: string): any => {
        if (node.id === targetId) return node;
        
        if (Array.isArray(node.body)) {
            for (const child of node.body) {
                const found = findNodeInSchema(child, targetId);
                if (found) return found;
            }
        } else if (node.body && typeof node.body === 'object') {
            return findNodeInSchema(node.body, targetId);
        }
        
        return null;
    };
    
    // Make components in canvas draggable
    React.useEffect(() => {
        if (!canvasRef.current) return;
        
        const handleDragStart = (e: DragEvent) => {
            const target = (e.target as Element).closest('[data-obj-id]');
            if (target && target.getAttribute('data-obj-id')) {
                const nodeId = target.getAttribute('data-obj-id');
                // Don't allow dragging the root node
                if (nodeId === schema.id) {
                    e.preventDefault();
                    return;
                }
                setDraggingNodeId(nodeId);
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', nodeId || '');
                }
            }
        };

        const handleDragEnd = () => {
            setDraggingNodeId(null);
        };

        // Add draggable attribute and event listeners to all elements with data-obj-id within canvas
        const elements = canvasRef.current.querySelectorAll('[data-obj-id]');
        elements.forEach(el => {
            // Don't make root draggable
            if (el.getAttribute('data-obj-id') !== schema.id) {
                el.setAttribute('draggable', 'true');
                el.addEventListener('dragstart', handleDragStart as EventListener);
                el.addEventListener('dragend', handleDragEnd as EventListener);
            }
        });

        return () => {
            elements.forEach(el => {
                el.removeEventListener('dragstart', handleDragStart as EventListener);
                el.removeEventListener('dragend', handleDragEnd as EventListener);
            });
        };
    }, [schema, setDraggingNodeId]);
    
    // Inject styles for selection/hover using dynamic CSS
    // Using a more refined outline style with enhanced visual feedback
    const highlightStyles = `
        [data-obj-id] {
            position: relative; 
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        [data-obj-id]:not([data-obj-id="${schema.id}"]) {
            cursor: grab;
        }
        
        [data-obj-id]:not([data-obj-id="${schema.id}"]):active {
            cursor: grabbing;
        }
        
        [data-obj-id]:not([data-obj-id="${schema.id}"]):hover {
            outline: 1px solid #818cf8; /* indigo-400 */
            outline-offset: -1px;
            background-color: rgba(99, 102, 241, 0.05); /* indigo tint */
        }
        
        [data-obj-id="${selectedNodeId}"] {
            outline: 2px solid #4f46e5 !important; /* indigo-600 */
            outline-offset: 0px;
            z-index: 10;
            box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06);
        }
        
        [data-obj-id="${selectedNodeId}"]::after {
            content: attr(data-obj-type);
            position: absolute;
            top: -22px;
            left: -2px;
            height: 20px;
            padding: 0 8px;
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); /* indigo-600 to indigo-700 */
            color: white;
            font-size: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            display: flex;
            align-items: center;
            border-radius: 4px 4px 0 0;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        [data-obj-id="${hoveredNodeId}"] {
            outline: 2px dashed #6366f1 !important; /* indigo-500 */
            outline-offset: -2px;
            background-color: rgba(99, 102, 241, 0.1);
            cursor: ${draggingNodeId ? 'move' : 'copy'};
        }
        
        [data-obj-id="${hoveredNodeId}"]::before {
            content: ${draggingNodeId ? '"Drop to move here"' : '"Drop to add here"'};
            position: absolute;
            bottom: -24px;
            right: 0px;
            height: 20px;
            padding: 0 8px;
            background: #6366f1;
            color: white;
            font-size: 10px;
            font-family: ui-sans-serif, system-ui;
            display: flex;
            align-items: center;
            border-radius: 4px;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 600;
            z-index: 20;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        [data-obj-id="${draggingNodeId}"] {
            opacity: 0.5;
            filter: grayscale(100%);
            transform: scale(0.98);
        }
    `;

    return (
        <div 
            className={cn(
                "h-full overflow-hidden bg-gray-50 flex flex-col relative", 
                className
            )}
        >
            {/* Toolbar for Canvas controls */}
            <div className="absolute bottom-6 left-6 z-20 flex gap-2">
                 <div className="bg-white/90 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.08)] rounded-full border border-gray-100 p-1.5 flex items-center gap-1 text-xs font-semibold text-gray-600 transition-all hover:shadow-md">
                     <span className="px-3 min-w-[3.5rem] text-center font-mono">{Math.round(scale * 100)}%</span>
                     <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
                     <button 
                        onClick={() => setScale(s => Math.max(0.25, s - 0.1))} 
                        className="w-7 h-7 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors text-gray-500 hover:text-gray-900"
                        title="Zoom Out"
                     >-</button>
                     <button 
                        onClick={() => setScale(s => Math.min(2, s + 0.1))} 
                        className="w-7 h-7 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors text-gray-500 hover:text-gray-900"
                        title="Zoom In"
                     >+</button>
                     <button 
                        onClick={() => setScale(1)} 
                        className="px-3 py-1 hover:bg-gray-100 rounded-full ml-1 transition-colors text-gray-500 hover:text-gray-900"
                        title="Reset Zoom"
                     >Reset</button>
                 </div>
            </div>

            <div 
                ref={canvasRef}
                className="flex-1 overflow-auto p-12 relative flex justify-center"
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    // Dot grid background
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    perspective: '1000px'
                }}
            >
                <style>{highlightStyles}</style>
                
                <div 
                    className="bg-white shadow-lg transition-transform origin-top duration-200 ease-out"
                    style={{
                        width: canvasWidth,
                        maxWidth: '100%',
                        minHeight: '800px', // Standard height
                        transform: `scale(${scale})`,
                        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    {/* Render the Schema */}
                    <div className="h-full w-full relative">
                         <SchemaRenderer schema={schema} />
                         
                         {/* Resize Handles - show only when a resizable component is selected */}
                         {selectedNodeId && (() => {
                             const selectedNode = findNodeInSchema(schema, selectedNodeId);
                             if (!selectedNode) return null;
                             
                             const config = ComponentRegistry.getConfig(selectedNode.type);
                             if (!config?.resizable) return null;
                             
                             const element = canvasRef.current?.querySelector(`[data-obj-id="${selectedNodeId}"]`);
                             if (!element) return null;
                             
                             const rect = element.getBoundingClientRect();
                             const canvasRect = canvasRef.current?.getBoundingClientRect();
                             if (!canvasRect) return null;
                             
                             // Calculate position relative to canvas
                             const top = rect.top - canvasRect.top;
                             const left = rect.left - canvasRect.left;
                             
                             // Determine which directions to show based on constraints
                             const constraints = config.resizeConstraints || {};
                             const directions: ResizeDirection[] = [];
                             
                             if (constraints.width !== false) {
                                 directions.push('e', 'w');
                             }
                             if (constraints.height !== false) {
                                 directions.push('n', 's');
                             }
                             if (constraints.width !== false && constraints.height !== false) {
                                 directions.push('ne', 'nw', 'se', 'sw');
                             }
                             
                             return (
                                 <div
                                     className="absolute pointer-events-none"
                                     style={{
                                         top: `${top}px`,
                                         left: `${left}px`,
                                         width: `${rect.width}px`,
                                         height: `${rect.height}px`,
                                     }}
                                 >
                                     <ResizeHandles
                                         directions={directions}
                                         onResizeStart={handleResizeStart}
                                         className="pointer-events-auto"
                                     />
                                 </div>
                             );
                         })()}
                    </div>
                </div>

                {/* Empty State Overlay if schema is empty/invalid */}
                {(!schema || !schema.body || (Array.isArray(schema.body) && schema.body.length === 0 && !schema.props)) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                        <div className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl max-w-md">
                             <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-5 border-2 border-blue-200">
                                <MousePointer2 size={36} className="text-blue-600" />
                             </div>
                             <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Building Your UI</h3>
                             <p className="text-sm text-gray-600 mb-4">Drag components from the left panel to begin designing.</p>
                             <div className="flex flex-col gap-2 text-xs text-left text-gray-500 bg-gray-50 p-4 rounded-lg border">
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">→</span>
                                    <span><strong>Drag & Drop:</strong> Add components from the palette</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">→</span>
                                    <span><strong>Click to Select:</strong> Edit properties in the right panel</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold mt-0.5">→</span>
                                    <span><strong>Keyboard Shortcuts:</strong> Ctrl+Z/Y for undo/redo</span>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Context Menu */}
            <ContextMenu
                position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
                targetNodeId={contextMenu?.nodeId || null}
                onClose={() => setContextMenu(null)}
            />
        </div>
    );
});

Canvas.displayName = 'Canvas';
