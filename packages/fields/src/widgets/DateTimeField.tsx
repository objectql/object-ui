import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { openNativePicker } from './openNativePicker';
import { toDateTimeInputValue, fromDateTimeInputValue } from './nativeDateValue';

/**
 * DateTimeField - Combined date and time picker widget
 * Displays both date and time in locale format when readonly
 */
export function DateTimeField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<string>) {
  // Before the readonly early return — the hook count must not depend on a
  // prop. See DateField for why the bare `toLocale*` calls were wrong
  // (objectui#4468).
  const locale = useDisplayLocale();
  if (readonly) {
    if (!value) return <EmptyValue />;
    const date = new Date(value);
    return (
      <span className="text-sm">
        {date.toLocaleDateString(locale)} {date.toLocaleTimeString(locale)}
      </span>
    );
  }

  const domProps = toDomProps(props);

  return (
    <Input
      {...domProps}
      type="datetime-local"
      // The record's value is ISO-8601 (`…T14:30:00.000Z`), which this control
      // rejects outright — it renders empty and the user reads that as a lost
      // value (objectui#3127). Convert in, and back out on the same basis.
      value={toDateTimeInputValue(value)}
      onChange={(e) => onChange(fromDateTimeInputValue(e.target.value))}
      onClick={(e) => {
        openNativePicker(e.currentTarget);
        domProps.onClick?.(e);
      }}
      disabled={readonly || domProps.disabled}
    />
  );
}
