/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldWidgetComponentProps } from './widgets/types';

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
// The FORM's spec-alias table (`json` → `field:code`, `tree` → `field:lookup`,
// …) — inline resolution reuses it so spec spellings get the form's decision.
// `RETIRED_FIELD_TYPES` / `reportRetiredFieldType` come from the same module on
// purpose: it is the live retirement table (objectui#4814), and importing it
// from here — rather than from the `./index` barrel, which re-exports this
// file — keeps the module graph acyclic, exactly as the alias import already
// does (see the note at index.tsx's `mapFieldTypeToFormType` re-export).
import {
  mapFieldTypeToFormType,
  RETIRED_FIELD_TYPES,
  reportRetiredFieldType,
} from './field-type-alias';

/**
 * True when a spelling has been RETIRED by this renderer (objectui#4814's
 * tombstone table, read live — never copied).
 *
 * Quantified over the whole table rather than written per spelling, which is
 * the point: the next retirement closes every seam in this file the day it
 * lands in `RETIRED_FIELD_TYPES`, instead of leaving a delegation road open
 * until someone notices it (objectui#4931 — which is how `owner` survived
 * #4814 here).
 */
function isRetiredFieldType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(RETIRED_FIELD_TYPES, type);
}

/**
 * Field types that edit in place with a dedicated widget. Keyed by the raw
 * field `type` (the widget map mirrors the form's `mapFieldTypeToFormType`).
 * Rich/heavy types (file, image, lookup, richtext, …) are intentionally absent
 * so callers fall back to their own simpler editor.
 */
const EDIT_WIDGETS: Record<string, React.ComponentType<FieldWidgetComponentProps<any>>> = {
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
  // `owner: UserField` sat here — pointing at the very same widget `user`
  // resolves to — until objectui#4931 removed it, closing the last road by
  // which objectui#4814's retirement could be bypassed. Membership in THIS
  // table is what made `resolveInlineEditType` return the spelling unchanged
  // (it short-circuits on `type in EDIT_WIDGETS`), so the alias table was never
  // consulted and the retirement never applied: `hasFieldEditWidget('owner')`
  // answered `true` and every host built on this seam still offered a working
  // person picker while the record form answered the same field with a
  // tombstone refusal. Do not re-add it — and note that re-adding it alone
  // would no longer resurrect the picker, because the retirement gate below
  // is keyed on the retirement table, not on this map's keys.
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
  'markdown', 'html', 'richtext',
  // Credentials — never inline-editable. Both are masked on read, so the cell has
  // no real value to seed an editor with, and the grid's fallback is a PLAIN TEXT
  // input: it would render the mask as if it were the value and write it straight
  // back. `secret` additionally round-trips through an encrypted store (ADR-0100,
  // data/field.zod.ts) — the cell holds an opaque ref, not the secret.
  'password', 'secret',
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

/**
 * Resolve a field type to its inline-editing key: the raw type when the
 * widget/exclusion tables name it directly, otherwise its form-alias target
 * (`mapFieldTypeToFormType`, `field:` prefix stripped).
 *
 * The tables are keyed by the FORM's spellings, but spec field types reach
 * this layer in the SPEC's spellings — `json`, `tree`, `composite`, `record`,
 * `repeater`, `video`, `audio`, `autonumber` are aliases in the form map and
 * were keys in NEITHER table here, so the grid silently fell back to a plain
 * text input for all of them: typing over structured JSON or a hierarchy ref
 * is a value-corruption path (#2942). Resolving through the same alias table
 * the form uses gives each spec type the form's own decision: `json` → the
 * code editor, `tree` → the lookup picker, and the container/computed/binary
 * families → their documented exclusions.
 */
function resolveInlineEditType(type: string): string {
  if (type in EDIT_WIDGETS || INLINE_EXCLUDED_FIELD_TYPES.has(type)) return type;
  return mapFieldTypeToFormType(type).replace(/^field:/, '');
}

/**
 * True when a field type has a dedicated in-place edit widget.
 *
 * A RETIRED spelling answers `false` unconditionally, ahead of every table
 * lookup (objectui#4931). This is the gate the retirement was missing: hosts
 * ask this question to decide whether to hand a cell to {@link FieldEditWidget},
 * and while it answered `true` for a retired spelling the whole tombstone was
 * bypassable by delegation — the grid's inline cell editor rendered a working
 * person picker for a field the record form refuses.
 *
 * Keyed on the retirement TABLE rather than on the raw `type`, and checked
 * BEFORE `resolveInlineEditType`, so it holds even if a future retired spelling
 * is still (or again) a key of {@link EDIT_WIDGETS} — closing the class, not
 * one spelling.
 */
export function hasFieldEditWidget(type: string | undefined): boolean {
  if (!type) return false;
  if (isRetiredFieldType(type)) return false;
  return resolveInlineEditType(type) in EDIT_WIDGETS;
}

/**
 * True when a field type is deliberately NOT inline-editable (alias-aware:
 * `composite` resolves to the excluded `object`, `video` to `file`, …).
 * Grid hosts must treat these as read-only cells — falling back to a plain
 * text editor is exactly the corruption path the exclusion exists to close.
 */
export function isInlineExcludedFieldType(type: string | undefined): boolean {
  if (!type) return false;
  // A RETIRED spelling is excluded from inline editing (objectui#4931).
  //
  // This is the half that decides what the grid actually DOES once
  // `hasFieldEditWidget` starts answering `false`, and without it the fix would
  // trade one silent failure for another. `ObjectGrid` marks a column
  // `editable: false` exactly when `isFieldInlineEditable` is false (which
  // consults this predicate) — otherwise the column stays editable, the cell
  // editor asks `hasFieldEditWidget`, gets `false`, returns `null`, and
  // DataTable falls back to its built-in PLAIN TEXT input. For a stored
  // person-reference that input displays the coerced value and writes a bare
  // string straight back over it. So the retirement routes the cell to the
  // grid's normal read-only path — the same disposition `password`, `formula`
  // and `composite` get, and for the same reason: a text box here is a
  // value-corruption path, not a graceful degradation.
  //
  // Deliberately a predicate-level answer and NOT a membership in
  // `INLINE_EXCLUDED_FIELD_TYPES`: that set is documented as the types this
  // renderer *chose* not to edit in place and is asserted to contain only
  // renderable form types, which a retired spelling is precisely not. The
  // predicate already diverges from raw set membership for the alias-resolved
  // spellings (`composite` → `object`, `video` → `file`), so answering on
  // behalf of the retirement table is the established shape here.
  if (isRetiredFieldType(type)) return true;
  return INLINE_EXCLUDED_FIELD_TYPES.has(resolveInlineEditType(type));
}

/**
 * Relational picker widgets (lookup / master_detail / user) render best in a
 * grid cell as a single-line, borderless trigger — so the selected record's
 * NAME shows inside the trigger instead of a chip stacked above a separate
 * "Select…" button (which double-stacks and wastes the row height). This
 * mirrors how the line-item grid (`GridField`) renders its lookup cells.
 *
 * `owner` was listed here (objectui#4914 item 11) until objectui#4931 dropped
 * it in the same stroke as the routing-table key above. Purely cosmetic on its
 * own — it only ever added `compact` to a widget that is no longer reached —
 * but it is removed rather than left to rot, because a retired spelling
 * lingering in a sizing set is how the next reader concludes the type is still
 * live here.
 */
const COMPACT_EDIT_TYPES = new Set<string>(['lookup', 'master_detail', 'user']);

/**
 * Render the dedicated edit widget for a field's type — the SAME control the
 * form uses — as a controlled `{ value, onChange, field }` input. Returns
 * `null` for types without a registered widget so the caller can fall back to
 * a plain editor.
 *
 * `autoFocus` is forwarded because an inline-edit host enters edit mode ON a
 * field and expects the caret to land there (objectui#4220 — the detail page's
 * delegation): each widget's own `toDomProps` whitelist already carries it onto
 * the real focusable control, so nothing here needs to know which element that
 * is. A host that passes nothing is unaffected.
 */
export function FieldEditWidget({
  field,
  value,
  onChange,
  readonly,
  autoFocus,
}: FieldWidgetComponentProps<any>): React.ReactElement | null {
  // A RETIRED spelling never reaches a widget here, whatever the tables say,
  // and it says so out loud (objectui#4931). This branch is for the caller that
  // ignores `hasFieldEditWidget` and calls this component directly: without it
  // such a host would still be handed the person picker for a field the record
  // form refuses, which is the exact contradiction #4814's tombstone exists to
  // end.
  //
  // The loud half is the once-per-spelling console prescription, not a rendered
  // alert, and that is deliberate: this component's hosts are CELL-sized (the
  // grid's inline editor, the kanban required-fields dialog), and #4814 settled
  // the same question the same way for the read path — "there is no visible
  // alert a table CELL can carry without wrecking the row". The visible refusal
  // is the record form's job, and `RetiredFieldTombstone` is what it renders.
  //
  // Returning `null` is this function's documented contract for "no dedicated
  // widget", not a new fallback invented here — and every in-repo host is
  // already routed away from that path by the two predicates above
  // (`hasFieldEditWidget` → false, `isInlineExcludedFieldType` → true), so the
  // grid marks the column read-only instead of opening a plain text box.
  if (field?.type && isRetiredFieldType(field.type)) {
    reportRetiredFieldType(field.type);
    return null;
  }
  const resolved = field?.type ? resolveInlineEditType(field.type) : undefined;
  const Widget = resolved ? EDIT_WIDGETS[resolved] : undefined;
  if (!Widget) return null;
  // `compact` is a declared widget prop (objectui#3221 closed this type), so
  // the spread no longer needs an `any` escape hatch to get past it.
  const compactProps = resolved && COMPACT_EDIT_TYPES.has(resolved) ? { compact: true } : {};
  return (
    <Widget
      field={field}
      value={value}
      onChange={onChange}
      readonly={readonly}
      autoFocus={autoFocus}
      {...compactProps}
    />
  );
}
