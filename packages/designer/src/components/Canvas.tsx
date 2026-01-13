import React, { useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import { useDesigner } from '../context/DesignerContext';
import { cn } from '@object-ui/components';
import { MousePointer2 } from 'lucide-react';

interface CanvasProps {
    className?: string;
}

// Constants for drag and drop
const INSERT_AT_START = 0;
const INSERT_AT_END = undefined; // undefined means append to end in addNode/moveNode

export const Canvas: React.FC<CanvasProps> = ({ className }) => {
    const { 
        schema, 
        selectedNodeId, 
        setSelectedNodeId, 
        hoveredNodeId, 
        setHoveredNodeId,
        draggingType,
        draggingNodeId,
        setDraggingNodeId,
        addNode,
        moveNode,
        viewportMode,
    } = useDesigner();

    const [scale, setScale] = useState(1);
    const canvasRef = React.useRef<HTMLDivElement>(null);
    
    // Calculate canvas width based on viewport mode
    const getCanvasWidth = () => {
        switch (viewportMode) {
            case 'mobile': return '375px'; // iPhone size
            case 'tablet': return '768px'; // iPad size
            case 'desktop': return '1024px'; // Desktop size
            default: return '1024px';
        }
    };

    const handleClick = (e: React.MouseEvent) => {
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
    };

    const handleDragOver = (e: React.DragEvent) => {
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
    };
    
    const handleDragLeave = () => {
        setHoveredNodeId(null);
    };

    const handleDrop = (e: React.DragEvent) => {
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
            outline: 1px solid #93c5fd;
            outline-offset: 1px;
        }
        
        [data-obj-id="${selectedNodeId}"] {
            outline: 2px solid #3b82f6 !important;
            outline-offset: 0px;
            z-index: 10;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        [data-obj-id="${selectedNodeId}"]::after {
            content: attr(data-obj-type);
            position: absolute;
            top: -22px;
            left: -2px;
            height: 20px;
            padding: 0 8px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            font-size: 10px;
            font-family: ui-monospace, monospace;
            display: flex;
            align-items: center;
            border-radius: 3px 3px 0 0;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        [data-obj-id="${hoveredNodeId}"] {
            outline: 2px dashed #60a5fa !important;
            outline-offset: 2px;
            background-color: rgba(59, 130, 246, 0.03);
            cursor: ${draggingNodeId ? 'move' : 'copy'};
        }
        
        [data-obj-id="${hoveredNodeId}"]::before {
            content: ${draggingNodeId ? '"Drop to move here"' : '"Drop to add here"'};
            position: absolute;
            bottom: -20px;
            right: 0px;
            height: 18px;
            padding: 0 6px;
            background: #60a5fa;
            color: white;
            font-size: 9px;
            font-family: ui-sans-serif, system-ui;
            display: flex;
            align-items: center;
            border-radius: 3px;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 500;
            z-index: 20;
        }
        
        [data-obj-id="${draggingNodeId}"] {
            opacity: 0.4;
            filter: grayscale(50%);
        }
    `;

    return (
        <div 
            className={cn(
                "h-full overflow-hidden bg-gray-100/50 flex flex-col relative", 
                className
            )}
        >
            {/* Toolbar for Canvas controls (Zoom etc - simplified) */}
            <div className="absolute bottom-6 left-6 z-20 flex gap-2">
                 <div className="bg-white rounded-md shadow-sm border p-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                     <span className="px-2">{Math.round(scale * 100)}%</span>
                     <button onClick={() => setScale(s => Math.max(0.25, s - 0.1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center">-</button>
                     <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center">+</button>
                     <button onClick={() => setScale(1)} className="px-2 hover:bg-gray-100 rounded">Reset</button>
                 </div>
            </div>

            <div 
                ref={canvasRef}
                className="flex-1 overflow-auto p-12 relative flex justify-center"
                onClick={handleClick}
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
                        width: getCanvasWidth(),
                        maxWidth: '100%',
                        minHeight: '800px', // Standard height
                        transform: `scale(${scale})`,
                        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    {/* Render the Schema */}
                    <div className="h-full w-full">
                         <SchemaRenderer schema={schema} />
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
        </div>
    );
};
