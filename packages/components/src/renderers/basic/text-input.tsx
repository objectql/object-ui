/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * element:text_input — a single-line free-text input that writes the typed
 * value into a page variable. The data-entry complement to
 * element:record_picker (which picks an existing record): together they let a
 * pure-SDUI page COLLECT input, which a submit button then posts via the action
 * runtime's `{{page.<var>}}` bridge (useConsoleActionRuntime).
 *
 * Config is read off `schema.properties` (`schema.props` tolerated as a legacy
 * alias):
 *   { inputType='text', label?, placeholder?, defaultValue?, required?,
 *     disabled?, description? }
 *
 * The value is written through `usePageVariableBinding(schema.id)`: the page
 * variable whose `source` equals this input's id receives every keystroke. With
 * no bound variable the input is uncontrolled (still usable, just not wired) so
 * it never throws outside a Page — mirroring element:record_picker. An
 * `inputType='number'` coerces the written value to a Number (empty → '') so
 * `page.<var>` and any numeric submit param stay typed.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { usePageVariableBinding } from '@object-ui/react';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import { Input, Label } from '../../ui';
import { cn } from '../../lib/utils';

function readProps<T extends Record<string, any>>(schema: any): T {
  // Per spec, element components carry their config in `schema.properties`.
  // Tolerate `schema.props` (legacy alias) so JSON written either way works.
  const fromProperties = (schema?.properties ?? {}) as T;
  const fromProps = (schema?.props ?? {}) as T;
  return { ...fromProps, ...fromProperties };
}

type TextInputType = 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
const INPUT_TYPES: TextInputType[] = ['text', 'email', 'number', 'tel', 'url', 'password'];

function ElementTextInputRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    inputType?: TextInputType;
    label?: unknown;
    placeholder?: unknown;
    defaultValue?: string | number;
    required?: boolean;
    disabled?: boolean;
    description?: unknown;
  }>(schema);

  const inputType: TextInputType = INPUT_TYPES.includes(props.inputType as TextInputType)
    ? (props.inputType as TextInputType)
    : 'text';
  const { language } = useObjectTranslation();
  const binding = usePageVariableBinding(schema?.id);

  // Convenience seeding: when a `defaultValue` is authored on the input and the
  // bound variable is still at its empty default, push it once on mount so
  // `page.<var>` (and the submit body) reflect the initial value even before
  // the user types. A variable that declares its OWN defaultValue wins — we
  // only seed when the variable is still empty.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (
      binding &&
      props.defaultValue !== undefined &&
      (binding.value == null || binding.value === '')
    ) {
      binding.setValue(props.defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled when a variable targets this input (empty string = no value),
  // uncontrolled otherwise (native input manages its own state). Coerce to a
  // string for the DOM element's `value`.
  const current = binding?.value;
  const value = binding ? (current == null ? '' : String(current)) : undefined;

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!binding) return;
      const raw = e.target.value;
      binding.setValue(inputType === 'number' ? (raw === '' ? '' : Number(raw)) : raw);
    },
    [binding, inputType],
  );

  const label = pickLocalized(props.label, language);
  const placeholder = pickLocalized(props.placeholder, language);
  const description = pickLocalized(props.description, language);

  return (
    <div
      className={cn('grid w-full max-w-sm items-center gap-1.5', schema?.className)}
      data-testid="text-input"
      data-input-id={schema?.id}
    >
      {label && (
        <Label
          htmlFor={schema?.id}
          className={cn(props.required && "after:ml-0.5 after:text-destructive after:content-['*']")}
        >
          {label}
        </Label>
      )}
      <Input
        id={schema?.id}
        type={inputType}
        placeholder={placeholder || undefined}
        value={value}
        defaultValue={value === undefined ? (props.defaultValue as any) : undefined}
        required={props.required}
        disabled={props.disabled}
        onChange={handleChange}
      />
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

ComponentRegistry.register('element:text_input', ElementTextInputRenderer, {
  namespace: 'element',
  label: 'Text Input',
  category: 'input',
  inputs: [
    { name: 'label', type: 'string', label: 'Label' },
    { name: 'placeholder', type: 'string', label: 'Placeholder' },
    {
      name: 'inputType',
      type: 'enum',
      label: 'Type',
      enum: ['text', 'email', 'number', 'tel', 'url', 'password'],
      defaultValue: 'text',
    },
    { name: 'required', type: 'boolean', label: 'Required' },
    { name: 'disabled', type: 'boolean', label: 'Disabled' },
    { name: 'description', type: 'string', label: 'Description' },
  ],
});

export { ElementTextInputRenderer };
