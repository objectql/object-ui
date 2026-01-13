import React from 'react';
import { ComponentRegistry } from '@object-ui/renderer';
import type { SchemaNode } from '@object-ui/protocol';
import { useDesigner } from '../context/DesignerContext';

interface ComponentPaletteProps {
  className?: string;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ className }) => {
  const { addNode, selectedNodeId } = useDesigner();
  const allConfigs = ComponentRegistry.getAllConfigs();
  
  const handleComponentClick = (type: string) => {
    const config = ComponentRegistry.getConfig(type);
    if (!config) return;
    
    const newNode: SchemaNode = {
      type,
      ...(config.defaultProps || {}),
      body: config.defaultChildren || undefined
    };
    
    // Add to selected node if it exists, otherwise add to root
    const parentId = selectedNodeId || 'root';
    addNode(parentId, newNode);
  };
  
  // Group components by category
  const categories = allConfigs.reduce((acc, config) => {
    const category = getCategoryForType(config.type);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(config);
    return acc;
  }, {} as Record<string, typeof allConfigs>);
  
  return (
    <div className={`h-full overflow-y-auto bg-gray-50 border-r ${className || ''}`}>
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Components</h2>
        
        {Object.entries(categories).map(([category, components]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2 uppercase">
              {category}
            </h3>
            <div className="space-y-1">
              {components.map(config => (
                <button
                  key={config.type}
                  onClick={() => handleComponentClick(config.type)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  {config.icon && <span className="text-gray-500">{config.icon}</span>}
                  <span>{config.label || config.type}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to categorize components
function getCategoryForType(type: string): string {
  if (['button', 'input', 'textarea', 'select', 'checkbox', 'switch', 'radio-group', 'slider', 'toggle', 'input-otp', 'calendar'].includes(type)) {
    return 'Form';
  }
  if (['div', 'span', 'text', 'separator'].includes(type)) {
    return 'Basic';
  }
  if (['card', 'tabs', 'accordion', 'collapsible'].includes(type)) {
    return 'Layout';
  }
  if (['dialog', 'sheet', 'popover', 'tooltip', 'alert-dialog', 'drawer', 'hover-card', 'dropdown-menu', 'context-menu'].includes(type)) {
    return 'Overlay';
  }
  if (['badge', 'avatar', 'alert'].includes(type)) {
    return 'Data Display';
  }
  if (['progress', 'skeleton', 'toaster'].includes(type)) {
    return 'Feedback';
  }
  if (['sidebar', 'sidebar-provider', 'sidebar-inset', 'header-bar'].includes(type)) {
    return 'Navigation';
  }
  if (['table', 'carousel', 'scroll-area', 'resizable'].includes(type)) {
    return 'Complex';
  }
  return 'Other';
}
