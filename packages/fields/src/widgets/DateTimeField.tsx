import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { openNativePicker } from './openNativePicker.js';
import { toDateTimeInputValue, fromDateTimeInputValue } from './nativeDateValue.js';

/**
 * DateTimeField - Combined date and time picker widget
 * Displays both date and time in locale format when readonly
 */
export function DateTimeField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<string>) {
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

  /**
   * `aria-invalid` after the DOM spread below, the objectui#3222 idiom shared
   * with the other readers (`SelectField`, `EmailField`, `NumberField`):
   * `error` is the published validation slot
   * (`@objectstack/spec/ui`'s `FieldWidgetPropsSchema`) and `!!undefined`
   * yields an explicit `"false"`, so a valid field SAYS it is valid rather
   * than staying mute.
   *
   * There is no composite-target question here despite the name "picker": the
   * widget renders ONE `<input type="datetime-local">`, and the browser's date-and-time
   * picker is that same element's own UI, not a second element. So the
   * focusable control a keyboard user lands on IS the carrier -- no wrapper is
   * marked (the objectui#5223 line).
   *
   * Reading it here is what makes the delivery non-inert for `datetime-local`
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
      aria-invalid={!!error}
    />
  );
}
