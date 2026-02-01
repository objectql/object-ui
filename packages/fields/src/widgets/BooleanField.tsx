import React from 'react';
import { Switch, Checkbox, Label } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function BooleanField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<boolean>) {
  if (readonly) {
    return <span className="text-sm">{value ? 'Yes' : 'No'}</span>;
  }

  const config = (field || (props as any).schema) as any;
  // Use simple type assertion for arbitrary custom properties not in BaseFieldMetadata
  const widget = config?.widget;
  const id = config?.name || `boolean-field-${Math.random().toString(36).substr(2, 9)}`;
  const label = config?.label || 'Checkbox';

  if (widget === 'checkbox') {
     return (
        <div className="flex items-center space-x-2">
            <Checkbox 
                id={id}
                checked={!!value}
                onCheckedChange={(checked) => onChange(!!checked)}
                disabled={readonly}
                className={props.className}
            />
            <Label htmlFor={id}>{label}</Label>
        </div>
     )
  }

  return (
    <div className="flex items-center space-x-2">
        <Switch 
            id={id} 
            checked={!!value} 
            onCheckedChange={onChange}
            disabled={readonly}
            className={props.className}
        />
        <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
