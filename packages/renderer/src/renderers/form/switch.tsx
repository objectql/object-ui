import { ComponentRegistry } from '../../registry';
import { Switch, Label } from '@object-ui/ui';

ComponentRegistry.register('switch', 
  ({ schema, className, ...props }) => (
    <div className={`flex items-center space-x-2 ${schema.wrapperClass || ''}`}>
      <Switch id={schema.id} className={className} {...props} />
      <Label htmlFor={schema.id}>{schema.label}</Label>
    </div>
  ),
  {
    label: 'Switch',
    inputs: [
      { name: 'label', type: 'string', label: 'Label', required: true },
      { name: 'id', type: 'string', label: 'ID', required: true },
      { name: 'checked', type: 'boolean', label: 'Checked' }
    ]
  }
);
