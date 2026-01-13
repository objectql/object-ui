import { ComponentRegistry } from '../../registry';
import { ScrollArea, ScrollBar } from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('scroll-area', 
  ({ schema, className, ...props }) => (
    <ScrollArea className={className} style={{ height: schema.height, width: schema.width }} {...props}>
      {renderChildren(schema.content || schema.children)}
      {schema.orientation === 'horizontal' && <ScrollBar orientation="horizontal" />}
    </ScrollArea>
  ),
  {
    label: 'Scroll Area',
    inputs: [
      { name: 'height', type: 'string', label: 'Height (e.g. 200px)' },
      { name: 'width', type: 'string', label: 'Width' },
      { name: 'orientation', type: 'enum', enum: ['vertical', 'horizontal', 'both'], defaultValue: 'vertical', label: 'Orientation' },
      { name: 'content', type: 'slot', label: 'Content' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
