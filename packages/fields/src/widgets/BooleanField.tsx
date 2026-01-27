import React from 'react';
import { Switch, Checkbox, Label } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function BooleanField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<boolean>) {
  if (readonly) {
    return <span className="text-sm">{value ? 'Yes' : 'No'}</span>;
  }

  // Use simple type assertion for arbitrary custom properties not in BaseFieldMetadata
  const widget = (field as any).widget;

  if (widget === 'checkbox') {
     return (
        <div className="flex items-center space-x-2">
            <Checkbox 
                id={field.name}
                checked={!!value}
                onCheckedChange={(checked) => onChange(!!checked)}
                disabled={readonly}
                className={props.className}
            />
            <Label htmlFor={field.name}>{field.label}</Label>
        </div>
     )
  }

  return (
    <div className="flex items-center space-x-2">
        <Switch 
            id={field.name} 
            checked={!!value} 
            onCheckedChange={onChange}
            disabled={readonly}
            className={props.className}
        />
        <Label htmlFor={field.name}>{field.label}</Label>
    </div>
  );
}
