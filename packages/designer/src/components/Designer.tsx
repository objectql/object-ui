/**
 * Unified Designer Component
 * 
 * This is the main designer entry point that supports four modes:
 * - 'form': Specialized form designer
 * - 'layout': Page layout designer
 * - 'canvas': Free-form canvas designer with absolute positioning
 * - 'general': Full-featured general designer (default)
 */

import React from 'react';
import type { SchemaNode } from '@object-ui/core';
import type { DesignerMode } from '../types/designer-modes';
import { FormDesigner } from './FormDesigner';
import { LayoutDesigner } from './LayoutDesigner';
import { CanvasDesigner } from './CanvasDesigner';
import { GeneralDesigner, GeneralDesignerContent } from './GeneralDesigner';
import { DesignerProvider } from '../context/DesignerContext';

interface DesignerProps {
  initialSchema?: SchemaNode;
  onSchemaChange?: (schema: SchemaNode) => void;
  /**
   * Designer mode - determines which specialized designer to use
   * @default 'general'
   */
  mode?: DesignerMode;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use GeneralDesignerContent or specify mode prop
 */
export const DesignerContent: React.FC = () => {
  return <GeneralDesignerContent />;
};

/**
 * Main Designer component with mode support
 * 
 * @example
 * ```tsx
 * // Form designer
 * <Designer mode="form" initialSchema={formSchema} />
 * 
 * // Layout designer
 * <Designer mode="layout" initialSchema={layoutSchema} />
 * 
 * // Canvas designer
 * <Designer mode="canvas" initialSchema={canvasSchema} />
 * 
 * // General designer (default)
 * <Designer initialSchema={schema} />
 * ```
 */
export const Designer: React.FC<DesignerProps> = ({ 
  initialSchema, 
  onSchemaChange,
  mode = 'general'
}) => {
  // Route to the appropriate specialized designer based on mode
  switch (mode) {
    case 'form':
      return <FormDesigner initialSchema={initialSchema} onSchemaChange={onSchemaChange} />;
    case 'layout':
      return <LayoutDesigner initialSchema={initialSchema} onSchemaChange={onSchemaChange} />;
    case 'canvas':
      return <CanvasDesigner initialSchema={initialSchema} onSchemaChange={onSchemaChange} />;
    case 'general':
    default:
      return <GeneralDesigner initialSchema={initialSchema} onSchemaChange={onSchemaChange} />;
  }
};
