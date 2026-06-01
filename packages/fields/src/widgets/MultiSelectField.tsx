import React from 'react';
import { Badge, EmptyValue, cn } from '@object-ui/components';
import { FieldWidgetProps } from './types';

interface Option { label: string; value: string; color?: string }

/**
 * MultiSelectField - select zero or more values from a fixed option set.
 *
 * Renders the configured options as toggleable chips. The stored value is a
 * string[] (the selected option values). Used for the `multiselect` field type.
 */
export function MultiSelectField({ value, onChange, field, readonly, className, ...props }: FieldWidgetProps<string[]>) {
  const config = (field || (props as any).schema) as any;
  const options: Option[] = config?.options || [];
  const selected: string[] = Array.isArray(value) ? value : value == null ? [] : [value as unknown as string];

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

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next);
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            disabled={(props as any).disabled}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
