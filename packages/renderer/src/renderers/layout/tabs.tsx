import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@object-ui/ui';

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
    ]
  }
);
