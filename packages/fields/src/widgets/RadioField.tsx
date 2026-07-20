import React, { useId, useEffect } from 'react';
import { RadioGroup, RadioGroupItem, Label, EmptyValue } from '@object-ui/components';
import { isValueStillOffered, type OptionLike } from '@object-ui/core';
import { FieldWidgetProps } from './types';
import { useCascadingOptions } from './useCascadingOptions';

type Option = OptionLike;

/**
 * RadioField - choose exactly one value from a fixed option set, rendered as a
 * radio group. The stored value is the selected option value (string). Used for
 * the `radio` field type.
 *
 * Like the single `SelectField`, options support per-option `visibleWhen`
 * cascading + `dependsOn` gating (ADR-0058 / #2715), resolved through the shared
 * {@link useCascadingOptions} hook: the offered radios narrow against the live
 * form record + `current_user`, the control is gated behind a "select the parent
 * first" hint while a dependency is empty, and a value no longer offered (parent
 * changed / predicate flipped) is cleared.
 */
export function RadioField({
  value,
  onChange,
  field,
  readonly,
  className,
  schema,
  dependentValues,
  dependsOn: dependsOnProp,
  emptyHint: _emptyHint,
  dataSource: _dataSource,
  ...props
}: FieldWidgetProps<string>) {
  const config = (field || schema) as any;
  const rawOptions: Option[] = config?.options || [];
  const groupId = useId();
  const fieldName = (props as any).name || config?.name || (props as any).id || '';

  const dependsOn = config?.dependsOn ?? dependsOnProp;
  const { options, gated, dependsOnFields } = useCascadingOptions<Option>(
    rawOptions,
    dependsOn,
    dependentValues,
  );

  // Cascade clear: once the offered set no longer includes the current value
  // (parent changed / predicate flipped), drop it so no stale pair persists.
  useEffect(() => {
    if (readonly) return;
    if (value === undefined || value === null || (value as unknown) === '') return;
    if (!isValueStillOffered(value, options)) onChange?.(undefined as unknown as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, gated]);

  if (readonly) {
    if (value == null || value === '') return <EmptyValue />;
    // Label from the raw set so a stored value hidden by `visibleWhen` still
    // renders its label rather than a bare id.
    const opt = rawOptions.find((o) => o.value === value);
    return <span className="text-sm">{opt?.label || String(value)}</span>;
  }

  // No offered options is unfillable — surface a legible state instead of an
  // empty radio group: a dependency-gated list prompts for its controlling
  // field; an unconfigured / fully-filtered list says so. Mirrors the select.
  if (options.length === 0) {
    const hint = gated
      ? `Select ${dependsOnFields.join(' / ')} first`
      : 'No options available';
    return (
      <div
        data-testid={fieldName ? `radio-empty-${fieldName}` : undefined}
        className="flex min-h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        {hint}
      </div>
    );
  }

  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={onChange}
      disabled={(props as any).disabled}
      className={className}
    >
      {options.map((opt) => {
        const id = `${groupId}-${opt.value}`;
        return (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={id} data-testid={`radio-option-${opt.value}`} />
            <Label htmlFor={id} className="font-normal">{opt.label}</Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
