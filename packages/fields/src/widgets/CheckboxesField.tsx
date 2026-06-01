import React, { useId } from 'react';
import { Checkbox, Label, EmptyValue, Badge } from '@object-ui/components';
import { FieldWidgetProps } from './types';

interface Option { label: string; value: string }

/**
 * CheckboxesField - select zero or more values from a fixed option set, rendered
 * as a list of checkboxes. The stored value is a string[]. Used for the
 * `checkboxes` field type.
 */
export function CheckboxesField({ value, onChange, field, readonly, className, ...props }: FieldWidgetProps<string[]>) {
  const config = (field || (props as any).schema) as any;
  const options: Option[] = config?.options || [];
  const selected: string[] = Array.isArray(value) ? value : value == null ? [] : [value as unknown as string];
  const groupId = useId();

  if (readonly) {
    if (selected.length === 0) return <EmptyValue />;
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map((v) => {
          const opt = options.find((o) => o.value === v);
          return <Badge key={v} variant="outline">{opt?.label || v}</Badge>;
        })}
      </div>
    );
  }

  const toggle = (v: string, checked: boolean) => {
    const next = checked ? [...selected.filter((x) => x !== v), v] : selected.filter((x) => x !== v);
    onChange(next);
  };

  return (
    <div className={className}>
      {options.map((opt) => {
        const id = `${groupId}-${opt.value}`;
        return (
          <div key={opt.value} className="flex items-center space-x-2 py-0.5">
            <Checkbox
              id={id}
              checked={selected.includes(opt.value)}
              onCheckedChange={(checked) => toggle(opt.value, !!checked)}
              disabled={(props as any).disabled}
            />
            <Label htmlFor={id} className="font-normal">{opt.label}</Label>
          </div>
        );
      })}
    </div>
  );
}
