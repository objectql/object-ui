import { ComponentRegistry } from '@object-ui/core';
import { 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent 
} from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('collapsible', 
  ({ schema, className, ...props }) => (
    <Collapsible defaultOpen={schema.defaultOpen} disabled={schema.disabled} className={className} {...props}>
       <CollapsibleTrigger asChild>
         {renderChildren(schema.trigger)}
       </CollapsibleTrigger>
       <CollapsibleContent>
         {renderChildren(schema.content)}
       </CollapsibleContent>
    </Collapsible>
  ),
  {
    label: 'Collapsible',
    inputs: [
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
       { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger' 
      },
      { 
        name: 'content', 
        type: 'slot', 
        label: 'Content' 
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Toggle', variant: 'outline' }],
      content: [{ type: 'text', content: 'Collapsible content goes here' }],
      className: 'w-full'
    }
  }
);
