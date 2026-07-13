/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldWidgetProps } from './widgets/types';

// The SAME dedicated widgets the form renders — reused for in-place editing
// (e.g. the data grid's inline cell editor) so a select edits as a dropdown, a
// boolean as a checkbox, a date as a date picker, etc. — never a bare text box.
import { TextField } from './widgets/TextField';
import { TextAreaField } from './widgets/TextAreaField';
import { NumberField } from './widgets/NumberField';
import { CurrencyField } from './widgets/CurrencyField';
import { PercentField } from './widgets/PercentField';
import { SliderField } from './widgets/SliderField';
import { RatingField } from './widgets/RatingField';
import { BooleanField } from './widgets/BooleanField';
import { SelectField } from './widgets/SelectField';
import { MultiSelectField } from './widgets/MultiSelectField';
import { RadioField } from './widgets/RadioField';
import { CheckboxesField } from './widgets/CheckboxesField';
import { TagsField } from './widgets/TagsField';
import { DateField } from './widgets/DateField';
import { DateTimeField } from './widgets/DateTimeField';
import { TimeField } from './widgets/TimeField';
import { EmailField } from './widgets/EmailField';
import { PhoneField } from './widgets/PhoneField';
import { UrlField } from './widgets/UrlField';
// Relational pickers — the SAME standard widgets the form uses. They read the
// related-object dataSource from SchemaRendererContext (which the grid already
// provides), so they drop straight into an inline cell.
import { LookupField } from './widgets/LookupField';
import { UserField } from './widgets/UserField';
// Structured-value editors — lightweight (no map/code-editor deps), same
// widgets the form uses. Drop into a cell like the rest.
import { ColorField } from './widgets/ColorField';
import { AddressField } from './widgets/AddressField';
import { LocationField } from './widgets/LocationField';
import { GeolocationField } from './widgets/GeolocationField';
import { CodeField } from './widgets/CodeField';
import { QRCodeField } from './widgets/QRCodeField';

/**
 * Field types that edit in place with a dedicated widget. Keyed by the raw
 * field `type` (the widget map mirrors the form's `mapFieldTypeToFormType`).
 * Rich/heavy types (file, image, lookup, richtext, …) are intentionally absent
 * so callers fall back to their own simpler editor.
 */
const EDIT_WIDGETS: Record<string, React.ComponentType<FieldWidgetProps<any>>> = {
  text: TextField,
  textarea: TextAreaField,
  number: NumberField,
  currency: CurrencyField,
  percent: PercentField,
  slider: SliderField,
  progress: SliderField,
  rating: RatingField,
  boolean: BooleanField,
  toggle: BooleanField,
  select: SelectField,
  status: SelectField,
  multiselect: MultiSelectField,
  radio: RadioField,
  checkboxes: CheckboxesField,
  tags: TagsField,
  date: DateField,
  datetime: DateTimeField,
  time: TimeField,
  email: EmailField,
  phone: PhoneField,
  url: UrlField,
  // Relational — the record/user pickers, same as the form (the form maps
  // master_detail to the single-value LookupField too, see fieldWidgetMap).
  lookup: LookupField,
  master_detail: LookupField,
  user: UserField,
  owner: UserField,
  // Structured-value editors — same widgets the form uses.
  color: ColorField,
  address: AddressField,
  location: LocationField,
  geolocation: GeolocationField,
  code: CodeField,
  qrcode: QRCodeField,
};

/**
 * Form field types that are deliberately NOT given an inline editor — every
 * other form widget type must be in {@link EDIT_WIDGETS}. This pairing is
 * enforced by a test against the form's widget map (`FORM_FIELD_TYPES`) so the
 * two can't silently drift again (which is how `lookup` was missed). To add a
 * type to inline editing, move it from here into EDIT_WIDGETS.
 */
export const INLINE_EXCLUDED_FIELD_TYPES = new Set<string>([
  // Computed / read-only — the grid keeps these non-editable (no value to author).
  'formula', 'summary', 'auto_number',
  // Binary / attachment — edited from the record form, shown read-only in the grid.
  'file', 'image', 'avatar', 'signature',
  // Heavy / full editors — better in the record form than a cell.
  'markdown', 'html', 'richtext', 'password',
  // Containers / non-authorable — a sub-form / sub-grid / embedding vector
  // doesn't belong in a single cell.
  'object', 'grid', 'vector',
  // Widget-hint-only pickers — authored in the record form (they depend on
  // sibling fields / a loaded object catalog), not inline in a grid cell.
  'object-ref', 'filter-condition', 'recipient-picker',
]);

/** Field types whose value is chosen in one discrete gesture (no free typing). */
export const DISCRETE_EDIT_TYPES = new Set<string>([
  'boolean', 'toggle', 'select', 'status', 'radio', 'rating',
]);

/** True when a field type has a dedicated in-place edit widget. */
export function hasFieldEditWidget(type: string | undefined): boolean {
  return !!type && type in EDIT_WIDGETS;
}

/**
 * Relational picker widgets (lookup / master_detail / user / owner) render best
 * in a grid cell as a single-line, borderless trigger — so the selected
 * record's NAME shows inside the trigger instead of a chip stacked above a
 * separate "Select…" button (which double-stacks and wastes the row height).
 * This mirrors how the line-item grid (`GridField`) renders its lookup cells.
 */
const COMPACT_EDIT_TYPES = new Set<string>(['lookup', 'master_detail', 'user', 'owner']);

/**
 * Render the dedicated edit widget for a field's type — the SAME control the
 * form uses — as a controlled `{ value, onChange, field }` input. Returns
 * `null` for types without a registered widget so the caller can fall back to
 * a plain editor.
 */
export function FieldEditWidget({
  field,
  value,
  onChange,
  readonly,
}: FieldWidgetProps<any>): React.ReactElement | null {
  const Widget = field?.type ? EDIT_WIDGETS[field.type] : undefined;
  if (!Widget) return null;
  const compactProps = field?.type && COMPACT_EDIT_TYPES.has(field.type) ? { compact: true } : {};
  return <Widget field={field} value={value} onChange={onChange} readonly={readonly} {...(compactProps as any)} />;
}
