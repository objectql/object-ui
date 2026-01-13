import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import { cn } from '@/lib/utils';

ComponentRegistry.register('list', 
  ({ schema, className, ...props }) => {
    const ListTag = schema.ordered ? 'ol' : 'ul';
    
    return (
      <div className={schema.wrapperClass}>
        {schema.title && (
          <h3 className="text-lg font-semibold mb-2">{schema.title}</h3>
        )}
        <ListTag 
          className={cn(
            schema.ordered 
              ? 'list-decimal list-inside space-y-2' 
              : 'list-disc list-inside space-y-2',
            className
          )}
          {...props}
        >
          {schema.items?.map((item: any, index: number) => (
            <li key={index} className={item.className}>
              {typeof item === 'string' ? item : item.content || renderChildren(item.body)}
            </li>
          ))}
        </ListTag>
      </div>
    );
  },
  {
    label: 'List',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'ordered', type: 'boolean', label: 'Ordered List (numbered)', defaultValue: false },
      { 
        name: 'items', 
        type: 'array', 
        label: 'List Items',
        description: 'Array of strings or objects with content/body'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      ordered: false,
      items: [
        'First item',
        'Second item',
        'Third item'
      ],
      className: 'text-sm'
    }
  }
);
