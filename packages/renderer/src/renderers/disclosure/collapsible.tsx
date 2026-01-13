import { ComponentRegistry } from '../../registry';
import { 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent 
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

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
    ]
  }
);
