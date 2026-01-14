import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry, type SchemaNode } from '@object-ui/core';
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
            const currentNode = findNodeInSchema(schema, resizingNode.nodeId);
            const config = currentNode ? ComponentRegistry.getConfig(currentNode.type) : null;
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
                
                // Persist new dimensions via style on the node schema
                updateNode(resizingNode.nodeId, {
                    style: {
                        width,
                        height
                    }
                });
                
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
    const findNodeInSchema = (node: SchemaNode, targetId: string): SchemaNode | null => {
        if (node.id === targetId) return node;
        
        if (Array.isArray(node.body)) {
            for (const child of node.body) {
                if (typeof child === 'object' && child !== null) {
                    const found = findNodeInSchema(child as SchemaNode, targetId);
                    if (found) return found;
                }
            }
        } else if (node.body && typeof node.body === 'object') {
            return findNodeInSchema(node.body as SchemaNode, targetId);
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
    // Enhanced with smooth transitions and gradient effects for premium UX
    const highlightStyles = `
        [data-obj-id] {
            position: relative; 
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        [data-obj-id]:not([data-obj-id="${schema.id}"]) {
            cursor: grab;
        }
        
        [data-obj-id]:not([data-obj-id="${schema.id}"]):active {
            cursor: grabbing;
        }
        
        /* Enhanced hover state with gradient border effect */
        [data-obj-id]:not([data-obj-id="${schema.id}"]):hover {
            outline: 2px solid transparent;
            outline-offset: -2px;
            background: linear-gradient(white, white) padding-box,
                        linear-gradient(135deg, #818cf8 0%, #6366f1 100%) border-box;
            border: 2px solid transparent;
            background-clip: padding-box, border-box;
            background-origin: padding-box, border-box;
            box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.15),
                        0 2px 8px -2px rgba(99, 102, 241, 0.1);
            transform: translateY(-1px);
        }
        
        /* Premium selection state with animated gradient */
        [data-obj-id="${selectedNodeId}"] {
            outline: 3px solid transparent !important;
            outline-offset: -3px;
            z-index: 10;
            background: linear-gradient(white, white) padding-box,
                        linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%) border-box !important;
            border: 3px solid transparent !important;
            background-clip: padding-box, border-box !important;
            background-origin: padding-box, border-box !important;
            box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.2),
                        0 4px 8px -2px rgba(79, 70, 229, 0.15),
                        0 0 0 1px rgba(99, 102, 241, 0.1),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
            animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse-border {
            0%, 100% {
                box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.2),
                            0 4px 8px -2px rgba(79, 70, 229, 0.15),
                            0 0 0 1px rgba(99, 102, 241, 0.1);
            }
            50% {
                box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.3),
                            0 4px 8px -2px rgba(79, 70, 229, 0.25),
                            0 0 0 1px rgba(99, 102, 241, 0.2);
            }
        }
        
        /* Enhanced component type label with icon and gradient */
        [data-obj-id="${selectedNodeId}"]::after {
            content: "◆ " attr(data-obj-type);
            position: absolute;
            top: -26px;
            left: -3px;
            height: 24px;
            padding: 0 12px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%);
            color: white;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            display: flex;
            align-items: center;
            border-radius: 6px 6px 0 0;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 700;
            letter-spacing: 0.75px;
            text-transform: uppercase;
            box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3),
                        0 2px 4px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-bottom: none;
        }
        
        /* Enhanced drop zone indicator with gradient */
        [data-obj-id="${hoveredNodeId}"] {
            outline: 3px dashed transparent !important;
            outline-offset: -3px;
            background: linear-gradient(white, white) padding-box,
                        linear-gradient(135deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%) border-box !important;
            border: 3px dashed transparent !important;
            background-clip: padding-box, border-box !important;
            cursor: ${draggingNodeId ? 'move' : 'copy'};
            animation: pulse-drop-zone 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse-drop-zone {
            0%, 100% {
                background: linear-gradient(white, white) padding-box,
                            linear-gradient(135deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%) border-box;
            }
            50% {
                background: linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)) padding-box,
                            linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%) border-box;
            }
        }
        
        /* Enhanced drop instruction badge */
        [data-obj-id="${hoveredNodeId}"]::before {
            content: ${draggingNodeId ? '"↓ Drop to move here"' : '"+ Drop to add here"'};
            position: absolute;
            bottom: -28px;
            right: 0px;
            height: 24px;
            padding: 0 12px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: white;
            font-size: 11px;
            font-family: ui-sans-serif, system-ui;
            display: flex;
            align-items: center;
            border-radius: 6px;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 700;
            z-index: 20;
            box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3),
                        0 2px 4px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
            pointer-events: none;
            white-space: nowrap;
            font-weight: 600;
            z-index: 20;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        /* Enhanced dragging state with smooth fade */
        [data-obj-id="${draggingNodeId}"] {
            opacity: 0.4;
            filter: grayscale(100%) blur(0.5px);
            transform: scale(0.97);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }
        
        /* Resizing state cursor override */
        ${resizingNode ? `
            * {
                cursor: ${
                    resizingNode.direction === 'ne' || resizingNode.direction === 'sw' ? 'nesw-resize' :
                    resizingNode.direction === 'nw' || resizingNode.direction === 'se' ? 'nwse-resize' :
                    resizingNode.direction.includes('e') || resizingNode.direction.includes('w') ? 'ew-resize' : 
                    'ns-resize'
                } !important;
            }
            
            [data-obj-id="${resizingNode.nodeId}"] {
                outline: 3px solid #4f46e5 !important;
                box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2),
                            0 8px 16px rgba(79, 70, 229, 0.3),
                            inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
            }
        ` : ''}
    `;

    return (
        <div 
            className={cn(
                "h-full overflow-hidden bg-gray-50 flex flex-col relative", 
                className
            )}
        >
            {/* Enhanced Toolbar for Canvas controls with gradient effects */}
            <div className="absolute bottom-6 left-6 z-20 flex gap-3">
                 <div className="bg-white/95 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] rounded-2xl border-2 border-gray-200/50 p-2 flex items-center gap-2 text-xs font-bold text-gray-700 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:border-indigo-200/70 group">
                     <span className="px-4 min-w-[4rem] text-center font-mono text-sm bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:from-indigo-700 group-hover:to-purple-700 transition-all">{Math.round(scale * 100)}%</span>
                     <div className="w-px h-5 bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1"></div>
                     <button 
                        onClick={() => setScale(s => Math.max(0.25, s - 0.1))} 
                        className="w-8 h-8 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 rounded-xl flex items-center justify-center transition-all text-gray-600 hover:text-indigo-700 hover:scale-110 active:scale-95 font-bold text-base"
                        title="Zoom Out (Ctrl+-)"
                     >−</button>
                     <button 
                        onClick={() => setScale(s => Math.min(2, s + 0.1))} 
                        className="w-8 h-8 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 rounded-xl flex items-center justify-center transition-all text-gray-600 hover:text-indigo-700 hover:scale-110 active:scale-95 font-bold text-base"
                        title="Zoom In (Ctrl++)"
                     >+</button>
                     <button 
                        onClick={() => setScale(1)} 
                        className="px-4 py-1.5 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 rounded-xl ml-1 transition-all text-gray-600 hover:text-white hover:shadow-lg hover:shadow-indigo-200 active:scale-95 font-semibold"
                        title="Reset Zoom (Ctrl+0)"
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
                    // Enhanced dot grid background with gradient
                    backgroundImage: `
                        radial-gradient(circle at center, rgba(99, 102, 241, 0.08) 0%, transparent 70%),
                        radial-gradient(#cbd5e1 1px, transparent 1px)
                    `,
                    backgroundSize: '100% 100%, 24px 24px',
                    backgroundPosition: 'center, 0 0',
                    perspective: '1000px'
                }}
            >
                <style>{highlightStyles}</style>
                
                <div 
                    className="bg-white shadow-2xl transition-all origin-top duration-300 ease-out rounded-xl border border-gray-200/50 overflow-hidden"
                    style={{
                        width: canvasWidth,
                        maxWidth: '100%',
                        minHeight: '800px',
                        transform: `scale(${scale})`,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.15), 0 8px 25px -8px rgba(0, 0, 0, 0.1)',
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
