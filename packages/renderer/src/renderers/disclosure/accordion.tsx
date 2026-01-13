import { ComponentRegistry } from '../../registry';
import { 
  Accordion, 
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent 
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

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
    ]
  }
);
