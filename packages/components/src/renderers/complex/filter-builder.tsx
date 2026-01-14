import { ComponentRegistry } from '@object-ui/core';
import type { FilterBuilderSchema, FilterGroup } from '@object-ui/types';
import { FilterBuilder } from '@/ui/filter-builder';

ComponentRegistry.register('filter-builder', 
  ({ schema, className, onChange, ...props }: { schema: FilterBuilderSchema; className?: string; onChange?: (event: any) => void; [key: string]: any }) => {
    const handleChange = (value: any) => {
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
          fields={(schema.fields || []) as any}
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
