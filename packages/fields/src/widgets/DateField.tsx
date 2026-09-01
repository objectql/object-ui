import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { openNativePicker } from './openNativePicker.js';
import { toDateInputValue } from './nativeDateValue.js';

/**
 * DateField - Date picker input widget
 * Uses native date input and displays locale-formatted date in readonly mode
 */
export function DateField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<string>) {
  // Before the readonly early return: the hook count must not depend on a prop
  // (objectui#4468). A bare `toLocaleDateString()` reads the MACHINE's locale,
  // which is how a Chinese form ended up with an `8/11/2026` value in it.
  const locale = useDisplayLocale();
  if (readonly) {
    return value ? <span className="text-sm">{new Date(value).toLocaleDateString(locale)}</span> : <EmptyValue />;
  }

  const domProps = toDomProps(props);

  /**
   * `aria-invalid` after the DOM spread below, the objectui#3222 idiom shared
   * with the other readers (`SelectField`, `EmailField`, `NumberField`):
   * `error` is the published validation slot
   * (`@objectstack/spec/ui`'s `FieldWidgetPropsSchema`) and `!!undefined`
   * yields an explicit `"false"`, so a valid field SAYS it is valid rather
   * than staying mute.
   *
   * There is no composite-target question here despite the name "picker": the
   * widget renders ONE `<input type="date">`, and the browser's date
   * picker is that same element's own UI, not a second element. So the
   * focusable control a keyboard user lands on IS the carrier -- no wrapper is
   * marked (the objectui#5223 line).
   *
   * Reading it here is what makes the delivery non-inert for `date`
   * (objectui#7126). The FORM path already announced correctly, because
   * `<FormControl>`'s Radix `Slot` value reached the input through the spread
   * untouched; every host WITHOUT that Slot -- `FieldEditWidget`, i.e. the
   * kanban required-fields dialog and the grid / detail inline editors --
   * hands the state over as the declared `error` prop (delivered since
   * objectui#7008) and nothing read it. MARKING only: the message TEXT stays
   * with the host.
   */
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
      aria-invalid={!!error}
    />
  );
}
