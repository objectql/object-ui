import React from 'react';
import { EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types.js';

/**
 * SummaryField - Read-only aggregation field
 * Values are aggregated from related records and cannot be edited
 */
export function SummaryField({ value, field, ...props }: FieldWidgetComponentProps<any>) {
  const summaryField = field as any;
  const summaryType = summaryField?.summary_type || 'count';

  if (value == null) {
    return <EmptyValue className={props.className} />;
  }

  let displayValue: string;
  if (summaryType === 'count') {
    displayValue = String(value);
  } else if (['sum', 'avg', 'min', 'max'].includes(summaryType)) {
    displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
  } else {
    displayValue = String(value);
  }

  return (
    <span className={`text-sm font-medium tabular-nums text-gray-700 ${props.className || ''}`}>
      {displayValue}
    </span>
  );
}
