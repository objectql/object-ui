import { ComponentRegistry } from '@object-ui/core';
import { Badge } from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('badge', 
  ({ schema, ...props }) => (
    <Badge variant={schema.variant} className={schema.className} {...props}>
      {schema.label || renderChildren(schema.body)}
    </Badge>
  ),
  {
    label: 'Badge',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { 
        name: 'variant', 
        type: 'enum', 
        enum: ['default', 'secondary', 'destructive', 'outline'], 
        defaultValue: 'default',
        label: 'Variant'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      label: 'Badge',
      variant: 'default'
    }
  }
);
