import { ComponentRegistry } from '../../registry';
import { RadioGroup, RadioGroupItem, Label } from '@object-ui/ui';

ComponentRegistry.register('radio-group', 
  ({ schema, className, ...props }) => (
    <RadioGroup defaultValue={schema.defaultValue} className={className} {...props}>
      {schema.items?.map((item: any) => (
        <div key={item.value} className="flex items-center space-x-2">
          <RadioGroupItem value={item.value} id={`${schema.id}-${item.value}`} />
          <Label htmlFor={`${schema.id}-${item.value}`}>{item.label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
  {
    label: 'Radio Group',
    inputs: [
      { name: 'defaultValue', type: 'string', label: 'Default Value' },
      { name: 'id', type: 'string', label: 'Group ID', required: true },
      { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Array of {label, value} objects'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      id: 'radio-group', // Will be made unique by designer's ensureNodeIds
      items: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' }
      ]
    }
  }
);
