import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';

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
    ],
    defaultProps: {
      className: 'px-2 py-1'
    },
    defaultChildren: [
      { type: 'text', content: 'Inline text' }
    ]
  }
);
