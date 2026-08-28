import React from 'react';
import { EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { FieldWidgetComponentProps } from './types.js';

/**
 * FormulaField - Read-only computed field
 * Values are computed on the backend and cannot be edited
 */
export function FormulaField({ value, field, ...props }: FieldWidgetComponentProps<any>) {
  // Before the empty-value early return — the hook count must not change when
  // a value flips between null and set. A `date` return type used to format
  // through the MACHINE's locale (objectui#4468).
  const locale = useDisplayLocale();
  const formulaField = field as any;
  const returnType = formulaField?.return_type || 'text';

  if (value == null) {
    return <EmptyValue className={props.className} />;
  }

  let displayValue: string;
  if (returnType === 'number' || returnType === 'currency') {
    displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
  } else if (returnType === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (returnType === 'date') {
    displayValue = new Date(value).toLocaleDateString(locale);
  } else {
    displayValue = String(value);
  }

  return (
    <span className={`text-sm font-mono text-gray-700 ${props.className || ''}`}>
      {displayValue}
    </span>
  );
}
