import { ComponentRegistry } from '../../registry';
import { Button } from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('button', 
  ({ schema, ...props }) => (
    <Button variant={schema.variant} size={schema.size} className={schema.className} {...props}>
      {schema.label || renderChildren(schema.body)}
    </Button>
  ),
  {
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
    ]
  }
);
