import { ComponentRegistry } from '@object-ui/core';
import { 
  Sheet, 
  SheetTrigger, 
  SheetContent, 
  SheetHeader, 
  SheetFooter, 
  SheetTitle, 
  SheetDescription
} from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('sheet', 
  ({ schema, className, ...props }) => (
    <Sheet modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
      <SheetTrigger asChild>
        {renderChildren(schema.trigger)}
      </SheetTrigger>
      <SheetContent side={schema.side || 'right'} className={className}>
        <SheetHeader>
          {schema.title && <SheetTitle>{schema.title}</SheetTitle>}
          {schema.description && <SheetDescription>{schema.description}</SheetDescription>}
        </SheetHeader>
        {renderChildren(schema.content)}
        {schema.footer && (
          <SheetFooter>
            {renderChildren(schema.footer)}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  ),
  {
    label: 'Sheet',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'], defaultValue: 'right', label: 'Side' },
      { name: 'modal', type: 'boolean', label: 'Modal', defaultValue: true },
       { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger',
      },
      { 
        name: 'content', 
        type: 'slot', 
        label: 'Content', 
      },
       { 
        name: 'footer', 
        type: 'slot', 
        label: 'Footer' 
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      title: 'Sheet Title',
      description: 'Sheet description',
      side: 'right',
      modal: true,
      trigger: [{ type: 'button', label: 'Open Sheet' }],
      content: [{ type: 'text', content: 'Sheet content goes here' }]
    }
  }
);
