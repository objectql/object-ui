import React from 'react';
import { ComponentRegistry } from '../../registry';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('resizable', 
  ({ schema, className, ...props }) => (
    <ResizablePanelGroup 
        direction={schema.direction || 'horizontal'} 
        className={className} 
        {...props}
        style={{ minHeight: schema.minHeight || '200px' }}
    >
      {schema.panels?.map((panel: any, index: number) => (
        <React.Fragment key={index}>
             <ResizablePanel defaultSize={panel.defaultSize} minSize={panel.minSize} maxSize={panel.maxSize}>
                {renderChildren(panel.content)}
             </ResizablePanel>
             {index < schema.panels.length - 1 && <ResizableHandle withHandle={schema.withHandle} />}
        </React.Fragment>
      ))}
    </ResizablePanelGroup>
  ),
  {
    label: 'Resizable Panel Group',
    inputs: [
      { name: 'direction', type: 'enum', enum: ['horizontal', 'vertical'], defaultValue: 'horizontal', label: 'Direction' },
      { name: 'minHeight', type: 'string', label: 'Min Height' },
      { name: 'withHandle', type: 'boolean', label: 'Show Handle Icon', defaultValue: true },
      { 
        name: 'panels', 
        type: 'array', 
        label: 'Panels',
        description: 'Array of { defaultSize, minSize, maxSize, content }'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      direction: 'horizontal',
      minHeight: '200px',
      withHandle: true,
      panels: [
        { defaultSize: 50, content: [{ type: 'div', className: 'p-4', body: [{ type: 'text', content: 'Panel 1' }] }] },
        { defaultSize: 50, content: [{ type: 'div', className: 'p-4', body: [{ type: 'text', content: 'Panel 2' }] }] }
      ],
      className: 'rounded-lg border'
    }
  }
);
