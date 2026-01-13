import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@/ui';

ComponentRegistry.register('tabs', 
  ({ schema, className, ...props }) => (
    <Tabs defaultValue={schema.defaultValue} className={className} {...props}>
      <TabsList>
        {schema.items?.map((item: any) => (
          <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
        ))}
      </TabsList>
      {schema.items?.map((item: any) => (
        <TabsContent key={item.value} value={item.value}>
          {renderChildren(item.body)}
        </TabsContent>
      ))}
    </Tabs>
  ),
  {
    label: 'Tabs',
    inputs: [
      { name: 'defaultValue', type: 'string', label: 'Default Value', required: true },
      { name: 'className', type: 'string', label: 'CSS Class' },
      { 
        name: 'items', 
        type: 'array', 
        label: 'Items'
      }
    ],
    defaultProps: {
      defaultValue: 'tab1',
      items: [
        { label: 'Tab 1', value: 'tab1', body: [{ type: 'text', content: 'Content for Tab 1' }] },
        { label: 'Tab 2', value: 'tab2', body: [{ type: 'text', content: 'Content for Tab 2' }] },
        { label: 'Tab 3', value: 'tab3', body: [{ type: 'text', content: 'Content for Tab 3' }] }
      ],
      className: 'w-full'
    }
  }
);
