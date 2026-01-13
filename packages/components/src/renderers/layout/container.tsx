import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import { cn } from '@/lib/utils';

ComponentRegistry.register('container', 
  ({ schema, className, ...props }) => {
    const maxWidth = schema.maxWidth || 'xl';
    const padding = schema.padding || 4;
    const centered = schema.centered !== false; // Default to true
    
    const containerClass = cn(
      // Base container
      'w-full',
      // Max width
      maxWidth === 'sm' && 'max-w-sm',
      maxWidth === 'md' && 'max-w-md',
      maxWidth === 'lg' && 'max-w-lg',
      maxWidth === 'xl' && 'max-w-xl',
      maxWidth === '2xl' && 'max-w-2xl',
      maxWidth === '3xl' && 'max-w-3xl',
      maxWidth === '4xl' && 'max-w-4xl',
      maxWidth === '5xl' && 'max-w-5xl',
      maxWidth === '6xl' && 'max-w-6xl',
      maxWidth === '7xl' && 'max-w-7xl',
      maxWidth === 'full' && 'max-w-full',
      maxWidth === 'screen' && 'max-w-screen-2xl',
      // Centering
      centered && 'mx-auto',
      // Padding
      padding === 0 && 'p-0',
      padding === 1 && 'p-1',
      padding === 2 && 'p-2',
      padding === 3 && 'p-3',
      padding === 4 && 'p-4',
      padding === 5 && 'p-5',
      padding === 6 && 'p-6',
      padding === 7 && 'p-7',
      padding === 8 && 'p-8',
      padding === 10 && 'p-10',
      padding === 12 && 'p-12',
      padding === 16 && 'p-16',
      className
    );

    return (
      <div className={containerClass} {...props}>
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    label: 'Container',
    inputs: [
      { 
        name: 'maxWidth', 
        type: 'enum', 
        enum: ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen'],
        label: 'Max Width',
        defaultValue: 'xl'
      },
      { 
        name: 'padding', 
        type: 'number', 
        label: 'Padding', 
        defaultValue: 4,
        description: 'Padding value (0, 1-8, 10, 12, 16)'
      },
      { 
        name: 'centered', 
        type: 'boolean', 
        label: 'Center Horizontally', 
        defaultValue: true
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      maxWidth: 'xl',
      padding: 4,
      centered: true,
      children: [
        { type: 'text', content: 'Container content goes here' }
      ]
    }
  }
);
