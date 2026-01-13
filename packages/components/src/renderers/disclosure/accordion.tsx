import { ComponentRegistry } from '@object-ui/core';
import { 
  Accordion, 
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent 
} from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('accordion', 
  ({ schema, className, ...props }) => (
    <Accordion type={schema.accordionType || 'single'} collapsible={schema.collapsible} className={className} {...props}>
      {schema.items?.map((item: any, index: number) => (
        <AccordionItem key={item.value || index} value={item.value || `item-${index}`}>
          <AccordionTrigger>{item.trigger || item.label}</AccordionTrigger>
          <AccordionContent>
            {renderChildren(item.content)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
  {
    label: 'Accordion',
    inputs: [
      { name: 'accordionType', type: 'enum', enum: ['single', 'multiple'], defaultValue: 'single', label: 'Type' },
      { name: 'collapsible', type: 'boolean', label: 'Collapsible (for single type)' },
       { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Array of { trigger, content, value }'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      accordionType: 'single',
      collapsible: true,
      items: [
        { 
          label: 'Item 1', 
          value: 'item-1', 
          content: [{ type: 'text', content: 'Content for item 1' }] 
        },
        { 
          label: 'Item 2', 
          value: 'item-2', 
          content: [{ type: 'text', content: 'Content for item 2' }] 
        },
        { 
          label: 'Item 3', 
          value: 'item-3', 
          content: [{ type: 'text', content: 'Content for item 3' }] 
        }
      ],
      className: 'w-full'
    }
  }
);
