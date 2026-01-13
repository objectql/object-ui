import { ComponentRegistry } from '../../registry';
import { Separator } from '@object-ui/ui';

ComponentRegistry.register('separator', 
  ({ className, ...props }) => (
    <Separator className={className} {...props} />
  ),
  {
    label: 'Separator',
    inputs: [
      { 
        name: 'orientation', 
        type: 'enum', 
        enum: ['horizontal', 'vertical'], 
        defaultValue: 'horizontal',
        label: 'Orientation'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      orientation: 'horizontal',
      className: 'my-4'
    }
  }
);
