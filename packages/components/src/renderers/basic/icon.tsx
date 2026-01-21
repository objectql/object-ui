/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { IconSchema } from '@object-ui/types';
import { icons } from 'lucide-react';
import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// Convert kebab-case to PascalCase for Lucide icon names
// e.g., "arrow-right" -> "ArrowRight", "home" -> "Home"
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

const IconRenderer = forwardRef<SVGSVGElement, { schema: IconSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    // Extract designer-related props
    const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style,
      ...iconProps
    } = props;
    
    // Convert icon name to PascalCase for Lucide lookup
    const iconName = toPascalCase(schema.name);
    const Icon = (icons as any)[iconName];
    
    if (!Icon) {
      console.warn(`Icon "${schema.name}" (lookup: "${iconName}") not found in lucide-react`);
      return null;
    }
    
    // Build size style
    const sizeStyle = schema.size ? { width: schema.size, height: schema.size } : undefined;
    
    // Merge classNames: schema color, schema className, prop className
    const mergedClassName = cn(
      schema.color,
      schema.className,
      className
    );
    
    return (
      <Icon 
        ref={ref} 
        className={mergedClassName}
        style={{ ...sizeStyle, ...style }}
        {...iconProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType }}
      />
    );
  }
);

IconRenderer.displayName = 'IconRenderer';

ComponentRegistry.register('icon',
  IconRenderer,
  {
    label: 'Icon',
    icon: 'smile',
    category: 'basic',
    inputs: [
      { name: 'name', type: 'string', label: 'Icon Name', defaultValue: 'smile' },
      { name: 'size', type: 'number', label: 'Size (px)' },
      { name: 'color', type: 'string', label: 'Color Class' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
