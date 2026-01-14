import { ComponentRegistry } from '@object-ui/core';
import { FilterBuilder, type FilterGroup } from '@/ui/filter-builder';

ComponentRegistry.register('filter-builder', 
  ({ schema, className, onChange, ...props }) => {
    const handleChange = (value: FilterGroup) => {
      if (onChange) {
        onChange({
          target: {
            name: schema.name,
            value: value,
          },
        });
      }
    };

    return (
      <div className={schema.wrapperClass || ''}>
        {schema.label && (
          <label className="text-sm font-medium mb-2 block">{schema.label}</label>
        )}
        <FilterBuilder
          fields={schema.fields || []}
          value={schema.value || props.value}
          onChange={handleChange}
          className={className}
          {...props}
        />
      </div>
    );
  },
  {
    label: 'Filter Builder',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'name', type: 'string', label: 'Name', required: true },
      { 
        name: 'fields', 
        type: 'array', 
        label: 'Fields',
        description: 'Array of { value: string, label: string, type?: string } objects',
        required: true
      },
      { 
        name: 'value', 
        type: 'object', 
        label: 'Initial Value',
        description: 'FilterGroup object with conditions'
      }
    ],
    defaultProps: {
      label: 'Filters',
      name: 'filters',
      fields: [
        { value: 'name', label: 'Name', type: 'text' },
        { value: 'email', label: 'Email', type: 'text' },
        { value: 'age', label: 'Age', type: 'number' },
        { value: 'status', label: 'Status', type: 'text' }
      ],
      value: {
        id: 'root',
        logic: 'and',
        conditions: []
      }
    }
  }
);
