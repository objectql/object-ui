import { ComponentRegistry } from '@object-ui/core';
import type { GridSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { cn } from '@/lib/utils';

ComponentRegistry.register('grid', 
  ({ schema, className, ...props }: { schema: GridSchema; className?: string; [key: string]: any }) => {
    const gridCols = schema.columns || 2;
    const gap = schema.gap || 4;
    
    // Generate Tailwind grid classes
    const gridClass = cn(
      'grid',
      // Grid columns classes
      gridCols === 1 && 'grid-cols-1',
      gridCols === 2 && 'grid-cols-2',
      gridCols === 3 && 'grid-cols-3',
      gridCols === 4 && 'grid-cols-4',
      gridCols === 5 && 'grid-cols-5',
      gridCols === 6 && 'grid-cols-6',
      gridCols === 7 && 'grid-cols-7',
      gridCols === 8 && 'grid-cols-8',
      gridCols === 9 && 'grid-cols-9',
      gridCols === 10 && 'grid-cols-10',
      gridCols === 11 && 'grid-cols-11',
      gridCols === 12 && 'grid-cols-12',
      // Gap classes
      gap === 0 && 'gap-0',
      gap === 1 && 'gap-1',
      gap === 2 && 'gap-2',
      gap === 3 && 'gap-3',
      gap === 4 && 'gap-4',
      gap === 5 && 'gap-5',
      gap === 6 && 'gap-6',
      gap === 7 && 'gap-7',
      gap === 8 && 'gap-8',
      // Responsive columns
      schema.mdColumns && `md:grid-cols-${schema.mdColumns}`,
      schema.lgColumns && `lg:grid-cols-${schema.lgColumns}`,
      className
    );

    return (
      <div className={gridClass} {...props}>
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    label: 'Grid Layout',
    inputs: [
      { 
        name: 'columns', 
        type: 'number', 
        label: 'Columns', 
        defaultValue: 2,
        description: 'Number of columns (1-12)'
      },
      { 
        name: 'mdColumns', 
        type: 'number', 
        label: 'MD Breakpoint Columns',
        description: 'Columns at md breakpoint (optional)'
      },
      { 
        name: 'lgColumns', 
        type: 'number', 
        label: 'LG Breakpoint Columns',
        description: 'Columns at lg breakpoint (optional)'
      },
      { 
        name: 'gap', 
        type: 'number', 
        label: 'Gap', 
        defaultValue: 4,
        description: 'Gap between items (0-8)'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      columns: 2,
      gap: 4,
      children: [
        { type: 'card', title: 'Card 1', description: 'First card' },
        { type: 'card', title: 'Card 2', description: 'Second card' },
        { type: 'card', title: 'Card 3', description: 'Third card' },
        { type: 'card', title: 'Card 4', description: 'Fourth card' }
      ]
    }
  }
);
