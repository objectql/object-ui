import React from 'react';
import { Input, Textarea } from '@object-ui/components';
import { TextareaFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

/**
 * TextField - Standard single-line or multi-line text input
 * Automatically renders as a textarea when rows are configured in field metadata
 */
export function TextField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const fieldData = field || (props as any).schema;

  if (readonly) {
    return <span className="text-sm">{value || '-'}</span>;
  }

  // Cast for rows property
  const rows = (fieldData as unknown as TextareaFieldMetadata)?.rows;

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  if (rows && rows > 1) {
    return (
      <Textarea
        {...domProps}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fieldData?.placeholder}
        disabled={readonly || domProps.disabled}
      />
    );
  }

  return (
    <Input
      {...domProps}
      type={fieldData?.type === 'password' ? 'password' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={fieldData?.placeholder}
      disabled={readonly || domProps.disabled}
    />
  );
}
