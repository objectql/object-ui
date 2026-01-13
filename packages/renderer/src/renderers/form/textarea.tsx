import { ComponentRegistry } from '../../registry';
import { Textarea, Label } from '@object-ui/ui';

ComponentRegistry.register('textarea', 
  ({ schema, className, ...props }) => (
    <div className={`grid w-full gap-1.5 ${schema.wrapperClass || ''}`}>
      {schema.label && <Label htmlFor={schema.id}>{schema.label}</Label>}
      <Textarea 
        id={schema.id} 
        placeholder={schema.placeholder} 
        className={className} 
        {...props} 
      />
    </div>
  ),
  {
    label: 'Textarea',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'id', type: 'string', label: 'ID', required: true }
    ],
    defaultProps: {
      label: 'Textarea label',
      placeholder: 'Enter text here...',
      id: 'textarea-field' // Will be made unique by designer's ensureNodeIds
    }
  }
);
