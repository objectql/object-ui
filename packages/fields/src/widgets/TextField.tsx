import React from 'react';
import { Input, Textarea } from '@object-ui/components';
import { TextareaFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

export function TextField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const fieldData = field || (props as any).schema;

  if (readonly) {
    return <span className="text-sm">{value || '-'}</span>;
  }

  // Cast for rows property
  const rows = (fieldData as unknown as TextareaFieldMetadata)?.rows;

  if (rows && rows > 1) {
    return (
      <Textarea
        {...props}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fieldData?.placeholder}
        disabled={readonly}
      />
    );
  }

  return (
    <Input
      {...props}
      type={fieldData?.type === 'password' ? 'password' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={fieldData?.placeholder}
      disabled={readonly || props.disabled}
    />
  );
}
