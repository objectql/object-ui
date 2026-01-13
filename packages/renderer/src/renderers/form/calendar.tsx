import { ComponentRegistry } from '../../registry';
import { Calendar } from '@object-ui/ui';

ComponentRegistry.register('calendar', 
  ({ schema, className, ...props }) => (
    <Calendar
      mode={schema.mode || "single"}
      selected={schema.selected} // This would need state management in a real app
      className={className}
      {...props}
    />
  ),
  {
    label: 'Calendar',
    inputs: [
      { name: 'mode', type: 'enum', enum: ['default', 'single', 'multiple', 'range'], defaultValue: 'single', label: 'Mode' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      mode: 'single',
      className: 'rounded-md border'
    }
  }
);
