import { ComponentRegistry } from '@object-ui/core';
import type { ToggleSchema } from '@object-ui/types';
import { Toggle, ToggleGroup, ToggleGroupItem } from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('toggle', 
  ({ schema, ...props }: { schema: ToggleSchema; [key: string]: any }) => (
    <Toggle 
      variant={schema.variant} 
      size={schema.size} 
      pressed={schema.pressed}
      aria-label={schema.ariaLabel}
      {...props}
    >
      {schema.label || renderChildren(schema.children)}
    </Toggle>
  ),
  {
    label: 'Toggle',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'pressed', type: 'boolean', label: 'Pressed' },
      { name: 'variant', type: 'enum', enum: ['default', 'outline'], defaultValue: 'default', label: 'Variant' },
      { name: 'size', type: 'enum', enum: ['default', 'sm', 'lg'], defaultValue: 'default', label: 'Size' },
         { name: 'ariaLabel', type: 'string', label: 'Aria Label' }
    ],
    defaultProps: {
      label: 'Toggle',
      variant: 'default',
      size: 'default'
    }
  }
);

ComponentRegistry.register('toggle-group', 
  ({ schema, className, ...props }) => (
    <ToggleGroup 
      type={schema.groupType || 'single'} 
      variant={schema.variant} 
      size={schema.size} 
      className={className}
      {...props}
    >
      {schema.items?.map((item: any) => (
        <ToggleGroupItem key={item.value} value={item.value} aria-label={item.label}>
          {item.icon || item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),
  {
    label: 'Toggle Group',
    inputs: [
      { name: 'groupType', type: 'enum', enum: ['single', 'multiple'], defaultValue: 'single', label: 'Type' },
       { name: 'variant', type: 'enum', enum: ['default', 'outline'], defaultValue: 'default', label: 'Variant' },
      { name: 'size', type: 'enum', enum: ['default', 'sm', 'lg'], defaultValue: 'default', label: 'Size' },
       { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Array of {label, value, icon?} objects'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      groupType: 'single',
      variant: 'default',
      size: 'default',
      items: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' }
      ]
    }
  }
);
