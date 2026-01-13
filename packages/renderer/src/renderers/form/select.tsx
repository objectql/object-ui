import { ComponentRegistry } from '../../registry';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label
} from '@object-ui/ui';

ComponentRegistry.register('select', 
  ({ schema, className, ...props }) => (
    <div className={`grid w-full max-w-sm items-center gap-1.5 ${schema.wrapperClass || ''}`}>
      {schema.label && <Label>{schema.label}</Label>}
      <Select defaultValue={schema.defaultValue} {...props}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={schema.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {schema.options?.map((opt: any) => (
             <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
  {
    label: 'Select',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'defaultValue', type: 'string', label: 'Default Value' },
      { 
        name: 'options', 
        type: 'array', 
        label: 'Options',
        description: 'Array of {label, value} objects'
      }
    ]
  }
);
