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
import { enableTouchDrag, isTouchDevice } from '../utils/touchDragPolyfill';

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

// Component item with touch support
interface ComponentItemProps {
  type: string;
  config: any;
  Icon: any;
  isResizable: boolean;
  onDragStart: (e: React.DragEvent, type: string) => void;
  onDragEnd: () => void;
}

const ComponentItem: React.FC<ComponentItemProps> = React.memo(({ 
  type, 
  config, 
  Icon, 
  isResizable, 
  onDragStart, 
  onDragEnd 
}) => {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const { setDraggingType } = useDesigner();

  // Setup touch drag support
  React.useEffect(() => {
    if (!itemRef.current || !isTouchDevice()) return;

    const cleanup = enableTouchDrag(itemRef.current, {
      dragData: { componentType: type },
      onDragStart: () => {
        setDraggingType(type);
      },
      onDragEnd: () => {
        setDraggingType(null);
      }
    });

    return cleanup;
  }, [type, setDraggingType]);

  return (
    <div
      ref={itemRef}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex flex-col items-center justify-center gap-1.5 md:gap-2 p-2.5 md:p-3 rounded-xl border-2 border-transparent hover:border-indigo-200 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:shadow-lg cursor-grab active:cursor-grabbing transition-all duration-200 bg-white relative overflow-hidden",
        "h-20 md:h-24 hover:scale-105 active:scale-95 touch-none"
      )}
      aria-label={`${config.label || type}${isResizable ? ' (resizable)' : ''}`}
    >
      {/* Resizable badge indicator */}
      {isResizable && (
        <div 
          className="absolute top-1 right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm ring-2 ring-white" 
          title="Resizable"
          aria-hidden="true"
        ></div>
      )}
      
      <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-indigo-100 group-hover:to-purple-100 flex items-center justify-center text-gray-600 group-hover:text-indigo-700 transition-all border border-gray-200 group-hover:border-indigo-300 group-hover:shadow-md">
        <Icon size={16} strokeWidth={2} className="md:w-[18px] md:h-[18px]" />
      </div>
      <span className="text-[10px] md:text-xs font-semibold text-gray-700 group-hover:text-indigo-800 text-center w-full truncate px-1 transition-colors leading-tight">
        {config.label || type}
      </span>
    </div>
  );
});

ComponentItem.displayName = 'ComponentItem';

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
      const isResizable = config.resizable || false;
      
      return (
          <ComponentItem
            key={type}
            type={type}
            config={config}
            Icon={Icon}
            isResizable={isResizable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
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
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-gray-50 to-white w-full overflow-hidden", className)}>
        <div className="px-3 md:px-4 py-3 md:py-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm shrink-0 space-y-3">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 md:h-10 px-3 md:px-4 text-sm border-2 border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all placeholder:text-gray-400 font-medium shadow-sm hover:shadow-md"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full p-1 transition-all"
                        aria-label="Clear search"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
        
        <ScrollArea className="flex-1 w-full">
            <div className="p-3 md:p-4 space-y-4 md:space-y-6 pb-20">
                {Object.entries(CATEGORIES).map(([category, types]) => {
                    const availableTypes = filterBySearch(getComponentscategory(types));
                    if (availableTypes.length === 0) return null;
                    
                    return (
                        <div key={category}>
                            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 uppercase tracking-widest mb-2 md:mb-3 px-1 flex items-center gap-2">
                                <span className="w-1 h-3 md:h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                                <span className="truncate">{category}</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
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
                             <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                                 <span className="w-1 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                                 Other
                             </h3>
                             <div className="grid grid-cols-2 gap-2.5">
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
