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

ComponentRegistry.register('text_input', ElementTextInputRenderer, {
  namespace: 'element',
  skipFallback: true,
  label: 'Text Input',
  category: 'input',
  // `defaultValue` is DECLARED, not merely honoured (objectui#3808). The
  // renderer has read it since the seeding effect landed, and the spec declares
  // it (`ElementTextInputProps.defaultValue`, `string | number`) — but while it
  // was missing from this list an author could not discover it, and every layer
  // that reads a manifest said the opposite: `page.tsx`'s JSX-page compiler
  // builds its prop whitelist from `getKnownTypes()` + these `inputs`, so
  // `<element-text-input defaultValue="acme">` came back as an `unknown-prop`
  // warning on a key the renderer then went on to honour. That is objectui#3407
  // in the same shape as `readonly` — enforced, undiscoverable — and the
  // reverse half of the parity gate in
  // `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`.
  inputs: [
    // ── The `I18nLabel` trio — `label`, `placeholder` and `description` ──────
    //
    // TWO arms each, declared in the change that makes the gate agree with the
    // contract (objectui#5717). The ORDER these were earned in is the inverse
    // of the rest of the family, and that is the whole point of this block.
    //
    // `element:record_picker.emptyText` (objectui#5590) and that block's
    // `label` / `placeholder` (objectui#5637) each held a single `'string'` arm
    // while their render site passed the value straight into a text node, and
    // gained the object arm in the very change that taught the render site to
    // resolve it — the order `ComponentInput.type` prescribes: never declare an
    // arm the renderer drops.
    //
    // Here the render site was NEVER behind. `pickLocalized(props.label,
    // language)` and its two siblings above have resolved the inline locale map
    // since this renderer was written, so the map has always reached the screen
    // correctly in the viewer's language. Only the declaration stayed at one
    // arm — which is the SAME rule's other half, and `ComponentInput.type`
    // states it in those words: withholding an arm the renderer resolves makes
    // the manifest gate report `type-mismatch` on a legal write, "one platform
    // authority contradicting itself on the write it just recommended".
    // Measured before this change, through the same `manifestFromConfigs` +
    // `validateTree` pair the JSX-page compiler (`renderers/layout/page.tsx`)
    // and the save gate use:
    //
    //     <element:text_input> prop "label" expected a string
    //     <element:text_input> prop "placeholder" expected a string
    //     <element:text_input> prop "description" expected a string
    //
    // …on `{ en: 'Owner', 'zh-CN': '负责人' }`, a value the contract accepts on
    // all three keys.
    //
    // The arms are MEASURED, never copied from the card: the spec's own
    // verdicts are what
    // `packages/components/src/__tests__/text-input-inputs-spec-parity.test.ts`
    // compares this declaration against, per key, so a spec release that drops
    // an arm and a declaration that grows one the spec rejects are both red.
    // `defaultValue` below deliberately does NOT join this trio — its contract
    // is `string | number` with no object arm, and the console specimen file
    // keeps that separation as the control that makes this widening per-key
    // rather than blanket.
    {
      name: 'label',
      type: ['string', 'object'],
      label: 'Label',
      description:
        'Caption rendered ABOVE the input, in a `<label>` element — tied to the field by `htmlFor` when the node carries an `id`, so clicking it focuses the input. Display-only, and OMITTED entirely when the key is absent or resolves to an empty string; because the `required` asterisk is drawn on this element, a required input with no label shows no asterisk at all. Accepts either a plain string or an inline per-locale map (`{ en: "Owner", "zh-CN": "负责人" }`) — the `I18nLabel` union the contract admits on this key — and the renderer resolves the map against the active language at the read site, falling back through base language, a region-qualified sibling, `default`, then `en`, and finally to any remaining entry.',
    },
    {
      name: 'placeholder',
      type: ['string', 'object'],
      label: 'Placeholder',
      description:
        'Prompt shown INSIDE the field while it is empty, as the native input\'s `placeholder` attribute — it disappears as the user types and never becomes the input\'s value, so it is never what a bound page variable receives. Display-only, with no renderer default: an absent key means no placeholder, and an authored empty string (or a map no locale limb resolves) drops the attribute altogether rather than setting an empty one. Accepts either a plain string or an inline per-locale map (`{ en: "Owner", "zh-CN": "负责人" }`), resolved against the active language with the same fallback chain as `label`.',
    },
    {
      name: 'inputType',
      type: 'enum',
      label: 'Type',
      enum: ['text', 'email', 'number', 'tel', 'url', 'password'],
      defaultValue: 'text',
    },
    {
      name: 'defaultValue',
      // BOTH arms of the spec's union, declared (objectui#3832).
      // `ElementTextInputPropsSchema.defaultValue` accepts `string | number` —
      // measured in this block's spec-parity test — and until `ComponentInput`
      // learned to carry more than one coarse kind, this entry had to pick one.
      // It picked `'string'` and named the number arm in the description, which
      // left the manifest gate warning `type-mismatch` on `defaultValue={42}`:
      // a value the spec accepts, the renderer honours (the DOM value is
      // `String(...)`-coerced anyway) and an author writing a numeric field
      // reaches for first. Both arms are now declared, so the gate agrees with
      // the contract. No `'object'` arm here — unlike its inline-translation
      // neighbours the spec REJECTS a map on this key (measured), and the
      // arms exist to match the contract, not to relax the gate.
      type: ['string', 'number'],
      label: 'Default Value',
      // Description taken from what the renderer DOES with the key (the seeding
      // effect above, and the native `defaultValue` pass-through at the
      // `<Input>`), not from restating the spec's one-liner — the two
      // behaviours differ depending on whether a page variable targets this
      // input, and an author who only knew "initial value" would not know which
      // one they get. No `defaultValue` on this entry: the value IS the default,
      // so a default-for-the-default would be meaningless.
      description:
        'Initial value (string or number). With a page variable bound to this input — a variable whose `source` is this component id — it is pushed into that variable ONCE on mount, and only while the variable is still empty, so `page.<var>` and the submit body carry it before the user types; a variable that declares its own defaultValue wins. With no bound variable it becomes the native input\'s uncontrolled initial value and nothing else reads it.',
    },
    { name: 'required', type: 'boolean', label: 'Required' },
    { name: 'disabled', type: 'boolean', label: 'Disabled' },
    {
      name: 'description',
      // The third arm-widening of the trio commented above `label`, and the one
      // worth saying explicitly travels WITH the other two: its destination in
      // the rendered output differs (a `<p>` below the field, not the `<label>`
      // above it or the native attribute inside it), but destination is not
      // what decides an arm. The two conditions `ComponentInput.type` names are
      // "the contract accepts it" and "the renderer resolves it", and this key
      // satisfies both identically to `label` — same `pickLocalized` call, same
      // `string | Record<string, string>` contract, measured per key. A
      // destination-based split would have declared an arm on one key and
      // withheld it on another for a difference neither the gate nor the
      // contract can see.
      type: ['string', 'object'],
      label: 'Description',
      description:
        'Helper text rendered BELOW the input, in its own `<p>` — a different destination from `label` (above, in a `<label>`) and `placeholder` (inside the field), reached by the same read path. Display-only, and OMITTED entirely when the key is absent or resolves to an empty string. Accepts either a plain string or an inline per-locale map (`{ en: "Owner", "zh-CN": "负责人" }`), resolved against the active language with the same fallback chain as `label`. Presentational only: the renderer renders it as a sibling paragraph and does not tie it to the field with `aria-describedby`, so a screen reader does not announce it together with the input — instructions a user must not miss belong in `label`.',
    },
  ],
});

export { ElementTextInputRenderer };
