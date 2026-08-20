import React from 'react';
import { Input, Textarea, EmptyValue } from '@object-ui/components';
import { TextareaFieldMetadata } from '@object-ui/types';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';

/**
 * TextField - Standard single-line or multi-line text input
 * Automatically renders as a textarea when rows are configured in field metadata
 */
export function TextField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<string>) {
  const fieldData = field;

  if (readonly) {
    return <span className="text-sm">{value || <EmptyValue />}</span>;
  }

  // Cast for rows property
  const rows = (fieldData as unknown as TextareaFieldMetadata)?.rows;

  const domProps = toDomProps(props);

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
