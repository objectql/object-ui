import { ComponentRegistry } from '../../registry';
import { Checkbox, Label } from '@object-ui/ui';

ComponentRegistry.register('checkbox', 
  ({ schema, className, ...props }) => (
    <div className={`flex items-center space-x-2 ${schema.wrapperClass || ''}`}>
      <Checkbox id={schema.id} className={className} {...props} />
      <Label htmlFor={schema.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {schema.label}
      </Label>
    </div>
  ),
  {
    label: 'Checkbox',
    inputs: [
      { name: 'label', type: 'string', label: 'Label', required: true },
      { name: 'id', type: 'string', label: 'ID', required: true },
      { name: 'checked', type: 'boolean', label: 'Checked' }
    ],
    defaultProps: {
      label: 'Checkbox label',
      id: 'checkbox-' + Math.random().toString(36).substr(2, 9)
    }
  }
);
