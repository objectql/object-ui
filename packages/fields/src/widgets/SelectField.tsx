import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyValue,
} from '@object-ui/components';
import { SelectFieldMetadata } from '@object-ui/types';
import { useFieldTranslation } from './useFieldTranslation';
import { FieldWidgetProps } from './types';

/**
 * SelectField - Dropdown selection widget with configurable options
 * Renders options from field metadata with support for placeholder and readonly display
 */
export function SelectField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const config = (field || (props as any).schema) as SelectFieldMetadata;
  const options = config?.options || [];
  const { t } = useFieldTranslation();
  // Stable hook for automation/e2e — react-hook-form + Radix Select cannot be
  // driven by synthetic DOM events, so e2e must target the trigger/options by a
  // deterministic testid keyed on the field name. `props.name` is the
  // react-hook-form field name spread in by the form renderer (FormField).
  const fieldName = (props as any).name || (config as any)?.name || props.id || '';

  if (readonly) {
    const option = options.find((o) => o.value === value);
    const display = option?.label || value;
    return display ? <span className="text-sm">{display}</span> : <EmptyValue />;
  }

  return (
    <Select 
      {...props}
      value={value} 
      onValueChange={onChange}
      disabled={readonly || props.disabled}
    >
      <SelectTrigger className={props.className} id={props.id} data-testid={fieldName ? `select-trigger-${fieldName}` : undefined}>
        <SelectValue placeholder={config?.placeholder || t('common.selectOption')} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} data-testid={`select-option-${option.value}`}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
