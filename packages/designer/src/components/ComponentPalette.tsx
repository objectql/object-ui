import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useDesigner } from '../context/DesignerContext';
import { 
    Layout, 
    Type, 
    Image, 
    Square, 
    List, 
    Table, 
    CreditCard, 
    ToggleLeft, 
    CheckSquare,
    MousePointer2,
    Box,
    Grid,
    AlignJustify
} from 'lucide-react';
import { cn } from '@object-ui/components';
import { ScrollArea } from '@object-ui/components';

interface ComponentPaletteProps {
  className?: string;
}

// Map component types to Lucide icons
const getIconForType = (type: string) => {
    switch (type) {
        case 'div':
        case 'container': return Box;
        case 'card': return CreditCard;
        case 'text': 
        case 'span': return Type;
        case 'image': return Image;
        case 'button': return MousePointer2;
        case 'input': return Type;
        case 'checkbox': return CheckSquare;
        case 'switch': return ToggleLeft;
        case 'select': return List;
        case 'table': return Table;
        case 'grid': return Grid;
        case 'stack': return AlignJustify;
        default: return Square;
    }
};

// Categorize components
const CATEGORIES = {
    'Layout': ['div', 'card', 'stack', 'grid', 'separator'],
    'Form': ['input', 'button', 'checkbox', 'switch', 'select', 'textarea', 'label'],
    'Data Display': ['text', 'span', 'image', 'badge', 'avatar', 'table'],
    'Feedback': ['alert', 'progress', 'skeleton', 'toast'],
    'Overlay': ['dialog', 'drawer', 'popover', 'tooltip', 'sheet'],
    'Navigation': ['tabs', 'breadcrumb', 'pagination', 'menubar']
};

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ className }) => {
  const { setDraggingType } = useDesigner();
  const allConfigs = ComponentRegistry.getAllConfigs();

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('componentType', type);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingType(type);
    
    // Create a custom drag image
    const dragPreview = document.createElement('div');
    dragPreview.className = 'bg-blue-600 text-white px-3 py-1.5 rounded-md shadow-lg font-medium text-sm flex items-center gap-2';
    dragPreview.innerHTML = `<span>${type}</span>`;
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    setTimeout(() => document.body.removeChild(dragPreview), 0);
  };
  
  const handleDragEnd = () => {
    setDraggingType(null);
  };

  const renderComponentItem = (type: string) => {
      const config = ComponentRegistry.getConfig(type);
      if (!config) return null; // Skip if not found
      
      const Icon = getIconForType(type);
      
      return (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onDragEnd={handleDragEnd}
            className={cn(
                "group flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all bg-white relative",
                "h-20"
            )}
          >
            <div className="w-7 h-7 rounded-md bg-gray-50 group-hover:bg-white flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors border border-gray-100 group-hover:border-blue-100">
                <Icon size={16} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium text-gray-600 group-hover:text-blue-700 text-center w-full truncate px-1">
                {config.label || type}
            </span>
          </div>
      );
  };

  // Filter available components based on category
  const getComponentscategory = (categoryComponents: string[]) => {
      return categoryComponents.filter(type => ComponentRegistry.getConfig(type));
  };

  return (
    <div className={cn("flex flex-col h-full bg-gray-50/50 border-r w-72 overflow-hidden", className)}>
        <div className="px-4 py-3 border-b bg-white shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Components</h2>
            <p className="text-xs text-gray-500 mt-0.5">Drag to add to canvas</p>
        </div>
        
        <ScrollArea className="flex-1 w-full">
            <div className="p-4 space-y-6 pb-20">
                {Object.entries(CATEGORIES).map(([category, types]) => {
                    const availableTypes = getComponentscategory(types);
                    if (availableTypes.length === 0) return null;
                    
                    return (
                        <div key={category}>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 px-1">{category}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {availableTypes.map(renderComponentItem)}
                            </div>
                        </div>
                    );
                })}
                
                {/* Fallback for uncategorized */}
                {(() => {
                    const categorized = new Set(Object.values(CATEGORIES).flat());
                    const uncategorized = Object.keys(allConfigs).filter(t => !categorized.has(t));
                    
                    if (uncategorized.length === 0) return null;

                    return (
                        <div>
                             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 px-1">Other</h3>
                             <div className="grid grid-cols-2 gap-2">
                                {uncategorized.map(renderComponentItem)}
                             </div>
                        </div>
                    );
                })()}
            </div>
        </ScrollArea>
    </div>
  );
};
