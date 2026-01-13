// Main Designer Component
export { Designer } from './components/Designer';

// Context and Hooks
export { DesignerProvider, useDesigner } from './context/DesignerContext';
export type { DesignerContextValue } from './context/DesignerContext';

// Individual Components (for custom layouts)
export { Canvas } from './components/Canvas';
export { ComponentPalette } from './components/ComponentPalette';
export { PropertyPanel } from './components/PropertyPanel';
export { Toolbar } from './components/Toolbar';

export const version = '0.1.0';
