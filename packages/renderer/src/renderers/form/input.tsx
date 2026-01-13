import { ComponentRegistry } from '../../registry';
import { Input, Label } from '@object-ui/ui';

ComponentRegistry.register('input', 
  ({ schema, className, ...props }) => (
    <div className={`grid w-full max-w-sm items-center gap-1.5 ${schema.wrapperClass || ''}`}>
      {schema.label && <Label htmlFor={schema.id}>{schema.label}</Label>}
      <Input 
        type={schema.inputType || 'text'} 
        id={schema.id} 
        placeholder={schema.placeholder} 
        className={className} 
        {...props} 
      />
    </div>
  ),
  {
    label: 'Input Field',
    inputs: [
      { name: 'label', type: 'string', label: 'Label', required: true },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { 
        name: 'inputType', 
        type: 'enum', 
        label: 'Type',
        enum: ['text', 'email', 'password', 'number', 'tel', 'url'],
        defaultValue: 'text'
      },
      { name: 'id', type: 'string', label: 'ID', required: true }
    ],
    defaultProps: {
      label: 'Label',
      placeholder: 'Enter text...',
      inputType: 'text',
      id: 'input-' + Math.random().toString(36).substr(2, 9)
    }
  }
);
