import { ComponentRegistry } from '../../registry';
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogFooter, 
  DialogTitle, 
  DialogDescription
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('dialog', 
  ({ schema, className, ...props }) => (
    <Dialog modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
      <DialogTrigger asChild>
        {renderChildren(schema.trigger)}
      </DialogTrigger>
      <DialogContent className={className}>
        <DialogHeader>
          {schema.title && <DialogTitle>{schema.title}</DialogTitle>}
          {schema.description && <DialogDescription>{schema.description}</DialogDescription>}
        </DialogHeader>
        {renderChildren(schema.content)}
        {schema.footer && (
          <DialogFooter>
            {renderChildren(schema.footer)}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  ),
  {
    label: 'Dialog',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'modal', type: 'boolean', label: 'Modal', defaultValue: true },
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger',
        description: 'Element that opens the dialog' 
      },
      { 
        name: 'content', 
        type: 'slot', 
        label: 'Content', 
        description: 'Main content of the dialog' 
      },
      { 
        name: 'footer', 
        type: 'slot', 
        label: 'Footer' 
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      title: 'Dialog Title',
      description: 'Dialog description goes here',
      modal: true,
      trigger: [{ type: 'button', label: 'Open Dialog' }],
      content: [{ type: 'text', content: 'Dialog content goes here' }]
    }
  }
);
