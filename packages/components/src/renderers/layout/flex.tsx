import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import { cn } from '@/lib/utils';

ComponentRegistry.register('flex', 
  ({ schema, className, ...props }) => {
    const direction = schema.direction || 'row';
    const justify = schema.justify || 'start';
    const align = schema.align || 'start';
    const gap = schema.gap || 2;
    const wrap = schema.wrap || false;
    
    const flexClass = cn(
      'flex',
      // Direction
      direction === 'row' && 'flex-row',
      direction === 'col' && 'flex-col',
      direction === 'row-reverse' && 'flex-row-reverse',
      direction === 'col-reverse' && 'flex-col-reverse',
      // Justify content
      justify === 'start' && 'justify-start',
      justify === 'end' && 'justify-end',
      justify === 'center' && 'justify-center',
      justify === 'between' && 'justify-between',
      justify === 'around' && 'justify-around',
      justify === 'evenly' && 'justify-evenly',
      // Align items
      align === 'start' && 'items-start',
      align === 'end' && 'items-end',
      align === 'center' && 'items-center',
      align === 'baseline' && 'items-baseline',
      align === 'stretch' && 'items-stretch',
      // Gap
      gap === 0 && 'gap-0',
      gap === 1 && 'gap-1',
      gap === 2 && 'gap-2',
      gap === 3 && 'gap-3',
      gap === 4 && 'gap-4',
      gap === 5 && 'gap-5',
      gap === 6 && 'gap-6',
      gap === 7 && 'gap-7',
      gap === 8 && 'gap-8',
      // Wrap
      wrap && 'flex-wrap',
      className
    );

    return (
      <div className={flexClass} {...props}>
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    label: 'Flex Layout',
    inputs: [
      { 
        name: 'direction', 
        type: 'enum', 
        enum: ['row', 'col', 'row-reverse', 'col-reverse'],
        label: 'Direction',
        defaultValue: 'row'
      },
      { 
        name: 'justify', 
        type: 'enum', 
        enum: ['start', 'end', 'center', 'between', 'around', 'evenly'],
        label: 'Justify Content',
        defaultValue: 'start'
      },
      { 
        name: 'align', 
        type: 'enum', 
        enum: ['start', 'end', 'center', 'baseline', 'stretch'],
        label: 'Align Items',
        defaultValue: 'start'
      },
      { 
        name: 'gap', 
        type: 'number', 
        label: 'Gap', 
        defaultValue: 2,
        description: 'Gap between items (0-8)'
      },
      { 
        name: 'wrap', 
        type: 'boolean', 
        label: 'Wrap', 
        defaultValue: false,
        description: 'Allow flex items to wrap'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      direction: 'row',
      justify: 'start',
      align: 'center',
      gap: 2,
      wrap: false,
      children: [
        { type: 'button', label: 'Button 1' },
        { type: 'button', label: 'Button 2' },
        { type: 'button', label: 'Button 3' }
      ]
    }
  }
);
