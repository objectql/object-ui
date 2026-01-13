import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';

ComponentRegistry.register('span', 
  ({ schema, className, ...props }) => (
    <span className={className} {...props}>
      {renderChildren(schema.body)}
    </span>
  ),
  {
    label: 'Inline Container',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
