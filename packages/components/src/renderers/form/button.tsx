/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ButtonSchema } from '@object-ui/types';
import { Button } from '../../ui';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';
import { Loader2, icons, type LucideIcon } from 'lucide-react';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

// Helper to convert icon names to PascalCase (e.g., "arrow-right" -> "ArrowRight")
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Map of renamed icons in lucide-react
const iconNameMap: Record<string, string> = {
  'Home': 'House',
};

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const ButtonRenderer = forwardRef<HTMLButtonElement, { schema: ButtonSchema }>(
  ({ schema, ...props }: { schema: ButtonSchema; [key: string]: any }, ref) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...buttonProps 
    } = props;

    // Resolve icon
    let Icon: LucideIcon | null = null;
    if (schema.icon) {
      const iconName = toPascalCase(schema.icon);
      const mappedIconName = iconNameMap[iconName] || iconName;
      Icon = (icons as any)[mappedIconName] as LucideIcon;
    }
    
    // Determine loading state
    const isLoading = schema.loading || props.loading;
    
    // Determine disabled state
    const isDisabled = schema.disabled || props.disabled || isLoading;

    return (
    <Button 
        ref={ref}
        type={schema.buttonType || "button"}
        variant={schema.variant} 
        size={schema.size} 
        className={schema.className} 
        disabled={isDisabled}
        {...toFormControlDomProps(buttonProps)}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && Icon && schema.iconPosition !== 'right' && <Icon className="mr-2 h-4 w-4" />}
      {schema.label || renderChildren(schema.body || schema.children)}
      {!isLoading && Icon && schema.iconPosition === 'right' && <Icon className="ml-2 h-4 w-4" />}
    </Button>
  );
  }
);
ButtonRenderer.displayName = 'ButtonRenderer';

ComponentRegistry.register('button', ButtonRenderer,
  {
    namespace: 'ui',
    label: 'Button',
    inputs: [
      { name: 'label', type: 'string', label: 'Label', defaultValue: 'Button' },
      { 
        name: 'variant', 
        type: 'enum', 
        label: 'Variant',
        enum: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
        defaultValue: 'default'
      },
      {
        name: 'size',
        type: 'enum',
        label: 'Size',
        enum: ['default', 'sm', 'lg', 'icon'],
        defaultValue: 'default'
      },
      { name: 'className', type: 'string', label: 'CSS Class', advanced: true }
    ],
    defaultProps: {
      label: 'Button',
      variant: 'default',
      size: 'default'
    }
  }
);
