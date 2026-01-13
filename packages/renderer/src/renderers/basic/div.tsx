import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';

ComponentRegistry.register('div', 
  ({ schema, className, ...props }) => (
    <div className={className} {...props}>
      {renderChildren(schema.body)}
    </div>
  ),
  {
    label: 'Container',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      className: 'p-4 border border-dashed border-gray-300 rounded min-h-[100px]'
    }
  }
);
