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
      disabled={readonly}
    >
      <SelectTrigger className={props.className}>
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
