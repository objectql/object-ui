import { ComponentRegistry } from '@object-ui/core';
import type { DivSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('div', 
  ({ schema, className, ...props }: { schema: DivSchema; className?: string; [key: string]: any }) => (
    <div className={className} {...props}>
      {renderChildren(schema.children || schema.body)}
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
