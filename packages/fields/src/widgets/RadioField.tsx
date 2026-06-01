import React, { useId } from 'react';
import { RadioGroup, RadioGroupItem, Label, EmptyValue } from '@object-ui/components';
import { FieldWidgetProps } from './types';

interface Option { label: string; value: string }

/**
 * RadioField - choose exactly one value from a fixed option set, rendered as a
 * radio group. The stored value is the selected option value (string). Used for
 * the `radio` field type.
 */
export function RadioField({ value, onChange, field, readonly, className, ...props }: FieldWidgetProps<string>) {
  const config = (field || (props as any).schema) as any;
  const options: Option[] = config?.options || [];
  const groupId = useId();

  if (readonly) {
    if (value == null || value === '') return <EmptyValue />;
    const opt = options.find((o) => o.value === value);
    return <span className="text-sm">{opt?.label || String(value)}</span>;
  }

  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={onChange}
      disabled={(props as any).disabled}
      className={className}
    >
      {options.map((opt) => {
        const id = `${groupId}-${opt.value}`;
        return (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={id} />
            <Label htmlFor={id} className="font-normal">{opt.label}</Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
