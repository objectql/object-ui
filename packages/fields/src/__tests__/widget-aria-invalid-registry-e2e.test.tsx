/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * GATE: every registered field widget must announce a validation failure to
 * assistive tech — `aria-invalid="true"` on some element inside its own form
 * row (objectui#3306, the paradigm of objectui#3291's leak sweep).
 *
 * ## Why a registry-wide sweep
 *
 * This failure class recurs per widget: objectui#3222 fixed seven widgets that
 * computed `aria-invalid` from a prop nobody produced; objectui#3290 fixed the
 * `aria-required` state channel; objectui#3306 fixed `select`, whose Radix
 * `Select.Root` — not being a DOM element — silently swallowed every `aria-*`
 * the form renderer delivered. Each was invisible until someone happened to
 * audit that one widget, because the per-widget tests only cover the widgets
 * someone already fixed. This sweep covers the REGISTRY, so the next widget
 * with a swallowed or missing `aria-invalid` fails here by name instead of
 * shipping.
 *
 * ## The ratchet
 *
 * Widgets listed in {@link NOT_YET_DELIVERED} are known not to deliver the
 * attribute today. They are asserted in the OPPOSITE direction — the sweep
 * proves they still do NOT deliver — so fixing one turns its entry red and
 * forces its removal from the ledger. The ledger can only shrink; a widget can
 * never silently regress INTO it, and a fix can never silently go unrecorded.
 * The remaining entries are tracked as follow-up work (see the ledger's doc
 * comment); this file is the source of truth for what is left.
 *
 * ## Discipline inherited from the #3291 sweep
 *
 * - **An error variant that produces no error tests nothing** — every case
 *   asserts the "is required" message rendered before it reads any aria. The
 *   `required` check is a PRESENCE check (`null` is missing, `false`/`0` are
 *   values — cloud#972), so `null` drives a real failure for every type.
 * - **Popovers are not opened** (happy-dom lacks the pointer-capture APIs
 *   Radix needs); the inline control every widget renders is the surface under
 *   test, which is exactly where `aria-invalid` must sit.
 * - Widgets are registered from STATIC imports wrapped in `withFieldCarrier`
 *   (the real registration seam, objectui#3233), never `registerAllFields()`,
 *   whose `React.lazy` loaders are this repo's known flake generator
 *   (AGENTS.md 测试纪律 / objectui#3010).
 */

import type { ComponentType } from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope: pulls in the form renderer's registration side effect.
import '@object-ui/components';

import { withFieldCarrier } from '../withFieldCarrier';
import { FORM_FIELD_TYPES } from '../index';

import { TextField } from '../widgets/TextField';
import { TextAreaField } from '../widgets/TextAreaField';
import { NumberField } from '../widgets/NumberField';
import { BooleanField } from '../widgets/BooleanField';
import { SelectField } from '../widgets/SelectField';
import { DateField } from '../widgets/DateField';
import { DateTimeField } from '../widgets/DateTimeField';
import { TimeField } from '../widgets/TimeField';
import { EmailField } from '../widgets/EmailField';
import { PhoneField } from '../widgets/PhoneField';
import { UrlField } from '../widgets/UrlField';
import { MultiSelectField } from '../widgets/MultiSelectField';
import { RadioField } from '../widgets/RadioField';
import { CheckboxesField } from '../widgets/CheckboxesField';
import { TagsField } from '../widgets/TagsField';
import { CurrencyField } from '../widgets/CurrencyField';
import { PercentField } from '../widgets/PercentField';
import { PasswordField } from '../widgets/PasswordField';
import { RichTextField } from '../widgets/RichTextField';
import { LookupField } from '../widgets/LookupField';
import { FileField } from '../widgets/FileField';
import { ImageField } from '../widgets/ImageField';
import { LocationField } from '../widgets/LocationField';
import { FormulaField } from '../widgets/FormulaField';
import { SummaryField } from '../widgets/SummaryField';
import { AutoNumberField } from '../widgets/AutoNumberField';
import { UserField } from '../widgets/UserField';
import { ObjectField } from '../widgets/ObjectField';
import { VectorField } from '../widgets/VectorField';
import { GridField } from '../widgets/GridField';
import { ColorField } from '../widgets/ColorField';
import { SliderField } from '../widgets/SliderField';
import { RatingField } from '../widgets/RatingField';
import { CodeField } from '../widgets/CodeField';
import { AvatarField } from '../widgets/AvatarField';
import { AddressField } from '../widgets/AddressField';
import { GeolocationField } from '../widgets/GeolocationField';
import { SignatureField } from '../widgets/SignatureField';
import { QRCodeField } from '../widgets/QRCodeField';
import { ObjectRefField } from '../widgets/ObjectRefField';
import { FilterConditionField } from '../widgets/FilterConditionField';
import { RecipientPickerField } from '../widgets/RecipientPickerField';

/** Same widget map as the #3291 sweep, so the parity check covers the registry. */
const WIDGETS: Record<string, ComponentType<any>> = {
  text: TextField,
  textarea: TextAreaField,
  number: NumberField,
  boolean: BooleanField,
  select: SelectField,
  date: DateField,
  datetime: DateTimeField,
  time: TimeField,
  email: EmailField,
  phone: PhoneField,
  url: UrlField,
  multiselect: MultiSelectField,
  radio: RadioField,
  checkboxes: CheckboxesField,
  tags: TagsField,
  currency: CurrencyField,
  percent: PercentField,
  password: PasswordField,
  markdown: RichTextField,
  html: RichTextField,
  richtext: RichTextField,
  lookup: LookupField,
  master_detail: LookupField,
  file: FileField,
  image: ImageField,
  location: LocationField,
  formula: FormulaField,
  summary: SummaryField,
  auto_number: AutoNumberField,
  user: UserField,
  // `owner: UserField` sat here until objectui#4814 retired the spelling. The
  // tombstone that replaced it is not a field widget and renders no control, so
  // it has no `aria-invalid` surface to scan.
  object: ObjectField,
  vector: VectorField,
  grid: GridField,
  color: ColorField,
  slider: SliderField,
  rating: RatingField,
  code: CodeField,
  avatar: AvatarField,
  address: AddressField,
  geolocation: GeolocationField,
  signature: SignatureField,
  qrcode: QRCodeField,
  'object-ref': ObjectRefField,
  'filter-condition': FilterConditionField,
  'recipient-picker': RecipientPickerField,
};

/**
 * THE RATCHET LEDGER — widget types MEASURED (by this very sweep, run with an
 * empty ledger) not to put `aria-invalid` on any element of their row after a
 * real validation failure. Every entry is a known accessibility gap tracked in
 * objectui#3318, not an accepted state: the field shows its red message while
 * assistive tech is told nothing.
 *
 * The objectui#3318 delivery batch cleared 20 of the original 29 entries with
 * the objectui#3222/#3306 pattern. What remains cannot take that pattern
 * as-is; each entry names why, so the follow-up starts from the blocker and
 * not from a re-audit:
 *
 * - `formula` / `summary` / `auto_number` / `vector` — read-only computed /
 *   display widgets: they render static text and NO focusable control, so
 *   there is no element assistive tech would read the state from (marking the
 *   text span would be exactly the non-focusable-wrapper move this ledger's
 *   rules forbid). A `required` failure on a non-editable field is a metadata
 *   authoring problem more than a widget one.
 * - `grid` — composite line-item editor with its own per-CELL `aria-invalid`
 *   for line validation; driving it from a FORM-level failure needs a design
 *   (which cell? the add-row button?) rather than a spread.
 * - `slider` — the focusable thumb (`role="slider"`, the ARIA-designated
 *   carrier) is rendered inside the synced shadcn `ui/slider.tsx` (a #7
 *   no-touch file), which forwards arbitrary props only to its non-focusable
 *   Root span; delivering needs a components-level change.
 * - `signature` — the drawing `<canvas>` is not focusable at all (no keyboard
 *   input path exists); the only focusable element is the auxiliary Clear
 *   button. Needs a real a11y design, not an attribute.
 * - `filter-condition` / `recipient-picker` — dependency-gated: with no
 *   sibling `object_name` / `recipient_type` chosen (the state a fresh form
 *   and THIS SWEEP render) they show a hint paragraph with no focusable
 *   control. Their editable states DO deliver `aria-invalid` since #3318's
 *   delivery batch.
 *
 * Do NOT add to this list to make a new widget pass; fix the widget (the
 * objectui#3222/#3306 pattern: spread `toDomProps(props)` onto the real
 * focusable control — never a non-DOM Radix Root — then `aria-invalid=
 * {!!error}` after the spread). An entry is removed by fixing the widget: the
 * sweep asserts each entry still fails to deliver, so a fixed widget turns
 * its own ledger row red until it is removed here. The ledger only shrinks.
 */
const NOT_YET_DELIVERED: ReadonlySet<string> = new Set([
  'formula',
  'summary',
  'auto_number',
  'vector',
  'grid',
  'slider',
  'signature',
  'filter-condition',
  'recipient-picker',
]);

/** Option widgets render an "unfillable" placeholder unless offered a list. */
const OPTION_TYPES = new Set(['select', 'multiselect', 'radio', 'checkboxes', 'tags']);
const OPTIONS = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Beta', value: 'beta' },
];

/** `null` is MISSING for the presence-check `required` (cloud#972). */
const MISSING_VALUE = null;

function fieldConfig(type: string) {
  return {
    name: 'f',
    label: 'F',
    type: `field:${type}`,
    required: true,
    ...(OPTION_TYPES.has(type) ? { options: OPTIONS } : {}),
  };
}

function renderForm(field: Record<string, unknown>) {
  const Form = ComponentRegistry.get('form')!;
  return render(
    <Form
      schema={{
        type: 'form',
        mode: 'create',
        showSubmit: true,
        showCancel: false,
        submitLabel: 'Create',
        defaultValues: { f: MISSING_VALUE },
        fields: [field],
        onSubmit: () => {},
      }}
    />,
  );
}

async function formRow(): Promise<Element> {
  return waitFor(() => {
    const row = document.querySelector('[data-field="f"]');
    if (!row) throw new Error('field row never rendered');
    return row;
  });
}

/**
 * Drive a REAL validation failure and prove it rendered before reading aria:
 * submit, then wait for the "is required" message inside the row.
 */
async function failValidation(): Promise<Element> {
  fireEvent.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => {
    expect(document.querySelector('[data-field="f"]')?.textContent ?? '').toContain(
      'is required',
    );
  });
  return formRow();
}

beforeAll(() => {
  for (const [type, Widget] of Object.entries(WIDGETS)) {
    ComponentRegistry.register(type, withFieldCarrier(Widget) as any, {
      namespace: 'field',
      skipFallback: true,
    });
  }
}, 60000);

beforeEach(() => {
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ALL_TYPES = Object.keys(WIDGETS);
const DELIVERING = ALL_TYPES.filter((type) => !NOT_YET_DELIVERED.has(type));
const LEDGERED = ALL_TYPES.filter((type) => NOT_YET_DELIVERED.has(type));

describe('every registered field widget announces a failed validation (objectui#3306)', () => {
  it('covers every field type the form can render', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual([...FORM_FIELD_TYPES].sort());
  });

  it('the ledger only names types that exist', () => {
    // A renamed/removed widget must not leave a stale ledger entry that would
    // silently assert against nothing.
    expect([...NOT_YET_DELIVERED].filter((type) => !(type in WIDGETS))).toEqual([]);
  });

  it.each(DELIVERING)(
    'field:%s — carries aria-invalid inside its row after a real failure',
    async (type) => {
      renderForm(fieldConfig(type));
      const row = await formRow();

      // No premature alarm: a widget must not claim invalid before validation
      // ran. (`aria-invalid="false"` is fine and expected — asserting on the
      // "true" value keeps this half meaningful for widgets that stay silent
      // until they fail.)
      expect(row.querySelector('[aria-invalid="true"]')).toBeNull();

      const after = await failValidation();
      expect(
        after.querySelector('[aria-invalid="true"]'),
        `field:${type} rendered its "is required" message but no element in its row carries aria-invalid="true" — assistive tech is never told the field failed`,
      ).not.toBeNull();
    },
  );

  it.each(LEDGERED)(
    'field:%s — KNOWN GAP: still does not deliver aria-invalid (fix it, then remove it from NOT_YET_DELIVERED)',
    async (type) => {
      renderForm(fieldConfig(type));
      await formRow();

      const after = await failValidation();
      // The ratchet: the day this widget starts delivering, this assertion
      // fails and the entry MUST be removed from the ledger above.
      expect(
        after.querySelector('[aria-invalid="true"]'),
        `field:${type} now delivers aria-invalid — remove it from NOT_YET_DELIVERED so the sweep guards it forward`,
      ).toBeNull();
    },
  );
});
