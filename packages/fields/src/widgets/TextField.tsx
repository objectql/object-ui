import React from 'react';
import { Input, Textarea } from '@object-ui/components';
import { TextareaFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

export function TextField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return <span className="text-sm">{value || '-'}</span>;
  }

  // Cast for rows property
  const rows = (field as unknown as TextareaFieldMetadata).rows;

  if (rows && rows > 1) {
    return (
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={readonly}
        className={props.className}
      />
    );
  }

  return (
    <Input
      type={field.type === 'password' ? 'password' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={readonly}
      className={props.className}
    />
  );
}
