import React from 'react';
import { FieldWidgetProps } from './types';

/**
 * FormulaField - Read-only computed field
 * Values are computed on the backend and cannot be edited
 */
export function FormulaField({ value, field, ...props }: FieldWidgetProps<any>) {
  const formulaField = (field || (props as any).schema) as any;
  const returnType = formulaField?.return_type || 'text';

  // Format based on return type
  let displayValue = '-';
  if (value != null) {
    if (returnType === 'number' || returnType === 'currency') {
      displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
    } else if (returnType === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (returnType === 'date') {
      displayValue = new Date(value).toLocaleDateString();
    } else {
      displayValue = String(value);
    }
  }

  return (
    <span className={`text-sm font-mono text-gray-700 ${props.className || ''}`}>
      {displayValue}
    </span>
  );
}
