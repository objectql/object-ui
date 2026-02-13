import React, { useId } from 'react';
import { Switch, Checkbox, Label } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * BooleanField - Toggle input supporting switch and checkbox variants
 * Renders as Switch or Checkbox based on field widget configuration
 */
export function BooleanField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<boolean>) {
  const config = (field || (props as any).schema) as any;
  // Use simple type assertion for arbitrary custom properties not in BaseFieldMetadata
  const widget = config?.widget;
  // Generate unique ID using React's useId hook - must be before early returns (rules of hooks)
  const generatedId = useId();
  const id = config?.name || generatedId;
  const label = config?.label || 'Checkbox';

  if (readonly) {
    return <span className="text-sm">{value ? 'Yes' : 'No'}</span>;
  }

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  if (widget === 'checkbox') {
     return (
        <div className="flex items-center space-x-2">
            <Checkbox 
                {...domProps}
                id={id}
                checked={!!value}
                onCheckedChange={(checked) => onChange(!!checked)}
                disabled={readonly || domProps.disabled}
            />
            <Label htmlFor={id}>{label}</Label>
        </div>
     )
  }

  return (
    <div className="flex items-center space-x-2">
        <Switch 
            {...domProps}
            id={id} 
            checked={!!value} 
            onCheckedChange={onChange}
            disabled={readonly || domProps.disabled}
        />
        <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
