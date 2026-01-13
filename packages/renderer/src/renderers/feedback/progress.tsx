import { ComponentRegistry } from '../../registry';
import { Progress } from '@object-ui/ui';

ComponentRegistry.register('progress', 
  ({ schema, className, ...props }) => (
    <Progress value={schema.value} className={className} {...props} />
  ),
  {
    label: 'Progress',
    inputs: [
      { name: 'value', type: 'number', label: 'Value', defaultValue: 0 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
