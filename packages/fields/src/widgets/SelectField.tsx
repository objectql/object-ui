import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@object-ui/components';
import { SelectFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

/**
 * SelectField - Dropdown selection widget with configurable options
 * Renders options from field metadata with support for placeholder and readonly display
 */
export function SelectField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const config = (field || (props as any).schema) as SelectFieldMetadata;
  const options = config?.options || [];

  if (readonly) {
    const option = options.find((o) => o.value === value);
    return <span className="text-sm">{option?.label || value || '-'}</span>;
  }

  return (
    <Select 
      {...props}
      value={value} 
      onValueChange={onChange}
      disabled={readonly || props.disabled}
    >
      <SelectTrigger className={props.className} id={props.id}>
        <SelectValue placeholder={config?.placeholder || "Select an option"} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
