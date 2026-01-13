import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';
import {
  Alert,
  AlertTitle,
  AlertDescription
} from '@object-ui/ui';

ComponentRegistry.register('alert', 
  ({ schema, className, ...props }) => (
    <Alert variant={schema.variant} className={className} {...props}>
      <AlertTitle>{schema.title}</AlertTitle>
      <AlertDescription>{schema.description || renderChildren(schema.body)}</AlertDescription>
    </Alert>
  ),
  {
    label: 'Alert',
    inputs: [
      { name: 'title', type: 'string', label: 'Title', required: true },
      { name: 'description', type: 'string', label: 'Description' },
      { 
        name: 'variant', 
        type: 'enum', 
        enum: ['default', 'destructive'], 
        defaultValue: 'default',
        label: 'Variant'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'Alert Title',
      description: 'This is an alert message.',
      variant: 'default'
    }
  }
);
