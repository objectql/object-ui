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

// Map of renamed icons in lucide-react (from old name to new name)
const iconNameMap: Record<string, string> = {
  'Home': 'House', // "Home" was renamed to "House" in lucide-react's icons object
};

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const IconRenderer = forwardRef<SVGSVGElement, { schema: IconSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: IconSchema; className?: string; [key: string]: any }, ref) => {
    // Extract designer-related props
    const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style,
      ...iconProps
    } = props;
    
    // Convert icon name to PascalCase for Lucide lookup
    const iconName = toPascalCase(schema.name);
    // Apply icon name mapping for renamed icons
    const mappedIconName = iconNameMap[iconName] || iconName;
    const Icon = (icons as any)[mappedIconName];
    
    if (!Icon) {
      console.warn(`Icon "${schema.name}" (lookup: "${iconName}"${mappedIconName !== iconName ? ` -> "${mappedIconName}"` : ''}) not found in lucide-react`);
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
    namespace: 'ui',
    label: 'Icon',
    // objectui#5622 — `face-slightly-smiling`, NOT `smile`, in BOTH places
    // below. Every lookup in this file goes through lucide's runtime `icons`
    // record, and lucide retires a spelling by dropping it from that record
    // while keeping it as a deprecated named export. `Smile` is gone from the
    // record, so this component's own declared default resolved to nothing:
    // the palette entry's glyph was blank and an `icon` dropped in from the
    // palette rendered nothing plus the `console.warn` below. The two spots
    // must move together — repairing one alone leaves either the default
    // rendering nothing or the palette glyph blank.
    //
    // `face-slightly-smiling` is the record's own spelling of the SAME glyph
    // object (`Smile === FaceSlightlySmiling` is true on the installed
    // lucide), so the palette looks exactly as it did — this is a spelling
    // repair, not a redesign of the default.
    icon: 'face-slightly-smiling',
    category: 'basic',
    inputs: [
      { name: 'name', type: 'string', label: 'Icon Name', defaultValue: 'face-slightly-smiling' },
      { name: 'size', type: 'number', label: 'Size (px)' },
      { name: 'color', type: 'string', label: 'Color Class' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
