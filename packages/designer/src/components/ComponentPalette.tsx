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
    AlignJustify,
    PanelLeft,
    FileText,
    Circle,
    User,
    MessageSquare,
    Bell,
    Zap,
    BarChart3,
    Menu,
    ChevronRight,
    Layers,
    Columns3,
    Minus,
    X
} from 'lucide-react';
import { cn } from '@object-ui/components';
import { ScrollArea } from '@object-ui/components';

interface ComponentPaletteProps {
  className?: string;
}

// Map component types to Lucide icons
const getIconForType = (type: string) => {
    switch (type) {
        // Layout
        case 'div':
        case 'container': return Box;
        case 'card': return CreditCard;
        case 'grid': return Grid;
        case 'stack': return AlignJustify;
        case 'separator': return Minus;
        
        // Form
        case 'button': return MousePointer2;
        case 'input': return Type;
        case 'textarea': return FileText;
        case 'checkbox': return CheckSquare;
        case 'switch': return ToggleLeft;
        case 'select': return List;
        case 'label': return Type;
        
        // Data Display
        case 'text': 
        case 'span': return Type;
        case 'image': return Image;
        case 'badge': return Circle;
        case 'avatar': return User;
        case 'table': return Table;
        
        // Feedback
        case 'alert': return Bell;
        case 'progress': return BarChart3;
        case 'skeleton': return Layers;
        case 'toast': return MessageSquare;
        
        // Overlay
        case 'dialog': 
        case 'drawer': 
        case 'popover': 
        case 'tooltip': 
        case 'sheet': return PanelLeft;
        
        // Navigation
        case 'tabs': return Columns3;
        case 'breadcrumb': return ChevronRight;
        case 'pagination': return Menu;
        case 'menubar': return Menu;
        
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

export const ComponentPalette: React.FC<ComponentPaletteProps> = React.memo(({ className }) => {
  const { setDraggingType } = useDesigner();
  const allConfigs = ComponentRegistry.getAllConfigs();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleDragStart = React.useCallback((e: React.DragEvent, type: string) => {
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
  }, [setDraggingType]);
  
  const handleDragEnd = React.useCallback(() => {
    setDraggingType(null);
  }, [setDraggingType]);

  const renderComponentItem = React.useCallback((type: string) => {
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
  }, [handleDragStart, handleDragEnd]);

  // Filter components by search query
  const filterBySearch = React.useCallback((types: string[]) => {
    if (!searchQuery.trim()) return types;
    
    const query = searchQuery.toLowerCase();
    return types.filter(type => {
      const config = ComponentRegistry.getConfig(type);
      return type.toLowerCase().includes(query) || 
             config?.label?.toLowerCase().includes(query);
    });
  }, [searchQuery]);

  // Filter available components based on category
  const getComponentscategory = React.useCallback((categoryComponents: string[]) => {
      return categoryComponents.filter(type => ComponentRegistry.getConfig(type));
  }, []);

  return (
    <div className={cn("flex flex-col h-full bg-gray-50/50 w-72 overflow-hidden", className)}>
        <div className="px-4 py-3 border-b bg-white shrink-0 space-y-3">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search components..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 px-3 text-xs border rounded-md bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
        
        <ScrollArea className="flex-1 w-full">
            <div className="p-4 space-y-6 pb-20">
                {Object.entries(CATEGORIES).map(([category, types]) => {
                    const availableTypes = filterBySearch(getComponentscategory(types));
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
                    const uncategorized = filterBySearch(Object.keys(allConfigs).filter(t => !categorized.has(t)));
                    
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
});

ComponentPalette.displayName = 'ComponentPalette';
