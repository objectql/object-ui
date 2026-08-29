import React from 'react';
import { Input, EmptyValue, cn } from '@object-ui/components';
import { NumberFieldMetadata } from '@object-ui/types';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useBadInputRefusal, BadInputMessage, BAD_INPUT_BORDER } from './numberBadInput.js';

/**
 * NumberField - Numeric input with optional decimal precision
 * Supports min/max/step constraints and configurable decimal precision
 */
export function NumberField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<number>) {
  // Before the readonly return: hooks are unconditional (objectui#6780).
  const { refusal, readBadInput } = useBadInputRefusal('1234');

  if (readonly) {
    return value == null ? <EmptyValue /> : <span className="text-sm">{value}</span>;
  }

  const numberField = field as NumberFieldMetadata;
  // Step follows `scale` (decimal places), not `precision` (total digit count):
  // a decimal(10, 0) column has 0 decimal places, so the input should step by 1
  // (`scale: 0` is a valid declaration — hence the typeof check, not truthiness).
  // An explicit `step` in the metadata wins over the derived one.
  const scale = numberField?.scale;
  const step =
    typeof numberField?.step === 'number'
      ? numberField.step
      : typeof scale === 'number'
        ? Math.pow(10, -scale)
        : 'any';

  const domProps = toDomProps(props);

  /**
   * The blur arm objectui#6780 adds — this widget had no `onBlur` at all.
   *
   * React delivers no `onChange` when `.value` never leaves `''`, which is the
   * measured shape of PASTING `1e` into an empty box; `badInput` is still true
   * at blur time, so this is the only arm that sees that route.
   *
   * ⚠️ COMPOSES the host's `onBlur` rather than replacing it: `onBlur` is a
   * declared DOM pass-through key that `toDomProps` already delivers here, and
   * a bare handler written after the spread would silently drop it.
   */
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    readBadInput(e.target);
    domProps.onBlur?.(e);
  };

  return (
    <div className="space-y-1">
      <Input
        {...domProps}
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          // objectui#6780: ask the browser whether it can READ the box before
          // trusting `.value`. The emission below is deliberately unchanged —
          // see `numberBadInput.tsx` for why refusing would wipe the very text
          // the diagnostic points at.
          readBadInput(e.target);
          const val = e.target.value;
          onChange(val === '' ? (null as any) : Number(val));
        }}
        onBlur={handleBlur}
        placeholder={numberField?.placeholder}
        disabled={readonly || domProps.disabled}
        className={cn(refusal ? BAD_INPUT_BORDER : '', domProps.className)}
        // Surface the field's declared range so the browser's spinner/keyboard
        // affordances respect it (server-side validation still owns enforcement).
        min={typeof numberField?.min === 'number' ? numberField.min : undefined}
        max={typeof numberField?.max === 'number' ? numberField.max : undefined}
        step={step}
        // ⚠️ Written ONLY when refused. This widget does not read the published
        // `error` slot (objectui#3222 never gave it one), so an unconditional
        // `aria-invalid={!!refusal}` would stamp `"false"` over the correct
        // value `<FormControl>`'s Radix Slot hands down — the exact overwrite
        // objectui#3222's e2e pins call out.
        {...(refusal ? { 'aria-invalid': true } : {})}
      />
      <BadInputMessage refusal={refusal} />
    </div>
  );
}
