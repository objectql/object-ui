import { ComponentRegistry } from '../../registry';
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('popover', 
  ({ schema, className, ...props }) => (
    <Popover modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
      <PopoverTrigger asChild>
        {renderChildren(schema.trigger)}
      </PopoverTrigger>
      <PopoverContent align={schema.align} side={schema.side} className={className}>
        {renderChildren(schema.content)}
      </PopoverContent>
    </Popover>
  ),
  {
    label: 'Popover',
    inputs: [
      { name: 'modal', type: 'boolean', label: 'Modal' },
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { name: 'align', type: 'enum', enum: ['start', 'center', 'end'], label: 'Align' },
      { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'], label: 'Side' },
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
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ]
  }
);
