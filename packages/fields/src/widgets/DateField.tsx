import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { openNativePicker } from './openNativePicker';
import { toDateInputValue } from './nativeDateValue';

/**
 * DateField - Date picker input widget
 * Uses native date input and displays locale-formatted date in readonly mode
 */
export function DateField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<string>) {
  // Before the readonly early return: the hook count must not depend on a prop
  // (objectui#4468). A bare `toLocaleDateString()` reads the MACHINE's locale,
  // which is how a Chinese form ended up with an `8/11/2026` value in it.
  const locale = useDisplayLocale();
  if (readonly) {
    return value ? <span className="text-sm">{new Date(value).toLocaleDateString(locale)}</span> : <EmptyValue />;
  }

  const domProps = toDomProps(props);

  return (
    <Input
      {...domProps}
      type="date"
      // An API that hands back `2026-06-17T00:00:00.000Z` for a `date` field
      // would leave this control empty too (objectui#3127). The written-back
      // shape is unchanged: the control's own plain `YYYY-MM-DD`.
      value={toDateInputValue(value)}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        openNativePicker(e.currentTarget);
        domProps.onClick?.(e);
      }}
      disabled={readonly || domProps.disabled}
    />
  );
}
