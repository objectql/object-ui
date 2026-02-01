import React from 'react';
import { FieldWidgetProps } from './types';

/**
 * SummaryField - Read-only aggregation field
 * Values are aggregated from related records and cannot be edited
 */
export function SummaryField({ value, field, ...props }: FieldWidgetProps<any>) {
  const summaryField = (field || (props as any).schema) as any;
  const summaryType = summaryField?.summary_type || 'count';

  // Format based on aggregation type
  let displayValue = '-';
  if (value != null) {
    if (summaryType === 'count') {
      displayValue = String(value);
    } else if (['sum', 'avg', 'min', 'max'].includes(summaryType)) {
      displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
    } else {
      displayValue = String(value);
    }
  }

  return (
    <span className={`text-sm font-medium tabular-nums text-gray-700 ${props.className || ''}`}>
      {displayValue}
    </span>
  );
}
