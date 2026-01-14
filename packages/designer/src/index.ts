// Main Designer Component
export { Designer, DesignerContent } from './components/Designer';

// Context and Hooks
export { DesignerProvider, useDesigner } from './context/DesignerContext';
export type { DesignerContextValue, ViewportMode } from './context/DesignerContext';

// Individual Components (for custom layouts)
export { Canvas } from './components/Canvas';
export { ComponentPalette } from './components/ComponentPalette';
export { PropertyPanel } from './components/PropertyPanel';
export { Toolbar } from './components/Toolbar';
export { ComponentTree } from './components/ComponentTree';
export { ContextMenu } from './components/ContextMenu';
export { LeftSidebar } from './components/LeftSidebar';

export const name = '@object-ui/designer';
export const version = '0.1.0';
