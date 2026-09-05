/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Form Component Schemas
 * 
 * Type definitions for form input and interactive components.
 * 
 * @module form
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base.js';
import type { SelectOptionBase } from './select-option.js';

/**
 * Button component
 */
export interface ButtonSchema extends BaseSchema {
  type: 'button';
  /**
   * Button text label
   */
  label?: string;
  /**
   * Button variant/style
   * @default 'default'
   */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  /**
   * Button size
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /**
   * Whether button is in loading state
   */
  loading?: boolean;
  /**
   * Icon to display (lucide-react icon name)
   */
  icon?: string;
  /**
   * Icon position
   * @default 'left'
   */
  iconPosition?: 'left' | 'right';
  /**
   * Click handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded to the DOM `<button>` by `toFormControlDomProps` (`onClick` is on
   * `SDUI_DOM_PASS_THROUGH_KEYS`).
   */
  onClick?: () => void | Promise<void>;
  /**
   * Button type
   * @default 'button'
   */
  buttonType?: 'button' | 'submit' | 'reset';
  /**
   * Child components (for custom content)
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Text input component
 */
export interface InputSchema extends BaseSchema {
  type: 'input';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Input label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Input type
   * @default 'text'
   */
  inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local';
  /**
   * Default value
   */
  defaultValue?: string | number;
  /**
   * Controlled value
   */
  value?: string | number;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Whether field is readonly
   */
  readOnly?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `input` renderer as `props.onChange(e.target.value)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (value: string | number) => void;
  /**
   * Input wrapper CSS class
   */
  wrapperClass?: string;
  /**
   * Minimum value (for number type)
   */
  min?: number;
  /**
   * Maximum value (for number type)
   */
  max?: number;
  /**
   * Step value (for number type)
   */
  step?: number;
  /**
   * Maximum length
   */
  maxLength?: number;
  /**
   * Pattern for validation
   */
  pattern?: string;
}

/**
 * Textarea component
 */
export interface TextareaSchema extends BaseSchema {
  type: 'textarea';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Textarea label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Default value
   */
  defaultValue?: string;
  /**
   * Controlled value
   */
  value?: string;
  /**
   * Number of visible rows
   */
  rows?: number;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Whether field is readonly
   */
  readOnly?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `textarea` renderer as `props.onChange(e.target.value)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (value: string) => void;
  /**
   * Maximum length
   */
  maxLength?: number;
}

/**
 * Select dropdown component
 */
export interface SelectSchema extends BaseSchema {
  type: 'select';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Select label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Default selected value
   */
  defaultValue?: string | number | boolean;
  /**
   * Controlled value
   */
  value?: string | number | boolean;
  /**
   * Select options
   */
  options: SelectOption[];
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler. Receives the AUTHORED option value — a numeric/boolean
   * option arrives with its type intact (#3090), not stringified by the
   * underlying control.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `select` renderer as `props.onChange(matchOptionValue(…))`
   * after `SchemaRenderer` spreads it.
   */
  onChange?: (value: string | number | boolean) => void;
}

/**
 * Select option — the SDUI FORM face of the one select-option contract
 * (objectui#7014). It extends {@link SelectOptionBase}, which derives the spec
 * keys (`label`, `color`, `default`) from `@objectstack/spec/data` by reference
 * and carries objectui's `visibleWhen` wire shape plus the two objectui-only
 * keys `disabled` and `icon`. This face restates none of them; the one key it
 * changes is named in the `Omit` below, which is where a divergence has to be
 * written for it to stay visible.
 *
 * Its zod twin, `SelectOptionSchema` in `./zod/form.zod`, is the same
 * derivation on the runtime side and diverges on the same key.
 */
export interface SelectOption extends Omit<SelectOptionBase, 'value'> {
  /**
   * Option value (submitted in form).
   *
   * Widened beyond the spec's lowercase machine identifier (#3090): standalone
   * UI forms legitimately bind numeric/boolean values, and this package's zod
   * twin has always accepted them. The renderers stringify for the
   * string-speaking controls and map the selection back to the authored value
   * (`matchOptionValue`), so the authored type survives the round trip instead
   * of morphing to `"2"`.
   *
   * This is the ONE key on which the SDUI form face is wider than the
   * object-metadata face (`SelectOptionMetadata` in `./field-types`), which
   * keeps the spec's `string`. Authored OBJECT metadata is validated against
   * the spec, so a numeric option value belongs to standalone forms only.
   */
  value: string | number | boolean;
}

/**
 * Checkbox component
 */
export interface CheckboxSchema extends BaseSchema {
  type: 'checkbox';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Checkbox label
   */
  label?: string;
  /**
   * Default checked state
   */
  defaultChecked?: boolean;
  /**
   * Controlled checked state
   */
  checked?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Whether the box must be checked — drives a VISIBLE affordance, not just
   * form semantics.
   *
   * READ SITES: `packages/components/src/renderers/form/checkbox.tsx:45` —
   * `required={schema.required}` on the Radix `Checkbox` — and `:49`, where it
   * gates the label's required marker
   * (`schema.required && "text-destructive after:content-['*']"`).
   *
   * Declared by objectui#6150; one of the two behavioural keys in that census.
   */
  required?: boolean;
  /**
   * Classes on the wrapper `div` around the box and its label.
   *
   * READ SITE: `packages/components/src/renderers/form/checkbox.tsx:36` —
   * `cn("flex items-center space-x-2", schema.wrapperClass)`. Undeclared until
   * objectui#6938, surviving only on `BaseSchema`'s index signature: the same
   * key, on the same class of read, that `FileUploadSchema` and
   * `FilterBuilderSchema` declare (objectui#6150) — left out here only because
   * the checkbox doc page's schema block is a six-line summary.
   */
  wrapperClass?: string;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `checkbox` renderer as `props.onChange(checked)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (checked: boolean) => void;
}

/**
 * Radio group component
 */
export interface RadioGroupSchema extends BaseSchema {
  type: 'radio-group';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Radio group label
   */
  label?: string;
  /**
   * Default selected value
   */
  defaultValue?: string | number;
  /**
   * Controlled value
   */
  value?: string | number;
  /**
   * Radio options
   */
  options: RadioOption[];
  /**
   * Radio group orientation
   * @default 'vertical'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `radio-group` renderer forwards only `toFormControlDomProps`'s whitelist,
   * which drops it. The zod twin refuses it by name; author behaviour as a node
   * type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * Radio option
 */
export interface RadioOption {
  /**
   * Option label
   */
  label: string;
  /**
   * Option value. Widened beyond `string` (#3090) to match
   * `RadioOptionSchema`, which has always accepted numbers.
   */
  value: string | number;
  /**
   * Whether option is disabled
   */
  disabled?: boolean;
  /**
   * Option description
   */
  description?: string;
}

/**
 * Switch/Toggle component
 */
export interface SwitchSchema extends BaseSchema {
  type: 'switch';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Switch label
   */
  label?: string;
  /**
   * Default checked state
   */
  defaultChecked?: boolean;
  /**
   * Controlled checked state
   */
  checked?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `switch` renderer forwards only `toFormControlDomProps`'s whitelist, which
   * drops it. The zod twin refuses it by name; author behaviour as a node type
   * (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * Toggle button component
 */
export interface ToggleSchema extends BaseSchema {
  type: 'toggle';
  /**
   * Toggle label
   */
  label?: string;
  /**
   * Default pressed state
   */
  defaultPressed?: boolean;
  /**
   * Controlled pressed state
   */
  pressed?: boolean;
  /**
   * Toggle variant
   * @default 'default'
   */
  variant?: 'default' | 'outline';
  /**
   * Toggle size
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg';
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `toggle` renderer forwards only `toFormControlDomProps`'s whitelist, which
   * drops it. The zod twin refuses it by name; author behaviour as a node type
   * (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
  /**
   * Child content
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Slider component
 */
export interface SliderSchema extends BaseSchema {
  type: 'slider';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Slider label
   */
  label?: string;
  /**
   * Default value
   */
  defaultValue?: number[];
  /**
   * Controlled value
   */
  value?: number[];
  /**
   * Minimum value
   * @default 0
   */
  min?: number;
  /**
   * Maximum value
   * @default 100
   */
  max?: number;
  /**
   * Step increment
   * @default 1
   */
  step?: number;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `slider` renderer forwards only `toFormControlDomProps`'s whitelist, which
   * drops it. The zod twin refuses it by name; author behaviour as a node type
   * (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * File upload component
 */
export interface FileUploadSchema extends BaseSchema {
  type: 'file-upload';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Upload label
   */
  label?: string;
  /**
   * Accepted file types
   * @example 'image/*', '.pdf,.doc'
   */
  accept?: string;
  /**
   * Allow multiple files
   * @default false
   */
  multiple?: boolean;
  /**
   * Maximum file size in bytes
   */
  maxSize?: number;
  /**
   * Maximum number of files (for multiple)
   */
  maxFiles?: number;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Label on the drop zone / upload button.
   *
   * READ SITE: `packages/components/src/renderers/form/file-upload.tsx:123` —
   * `{isUploading ? "…" : (schema.buttonText || "DROP PAYLOAD OR CLICK TO UPLOAD")}`.
   */
  buttonText?: string;
  /**
   * Tailwind classes appended to the outer wrapper `div`.
   *
   * READ SITE: `renderers/form/file-upload.tsx:78` — appended to the
   * renderer's own grid classes as
   * `` `grid w-full … ${schema.wrapperClass || ''}` ``.
   */
  wrapperClass?: string;
  /**
   * Change handler (receives FileList or File[])
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `file-upload` renderer as `props.onChange(files)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (files: FileList | File[]) => void;
}

/**
 * Date picker component
 */
export interface DatePickerSchema extends BaseSchema {
  type: 'date-picker';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Date picker label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Default value (Date object or ISO string)
   */
  defaultValue?: Date | string;
  /**
   * Controlled value
   */
  value?: Date | string;
  /**
   * Minimum selectable date
   */
  minDate?: Date | string;
  /**
   * Maximum selectable date
   */
  maxDate?: Date | string;
  /**
   * Date format
   * @default 'PPP'
   */
  format?: string;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `date-picker` renderer as `props.onChange(date)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (date: Date | undefined) => void;
}

/**
 * Calendar component
 */
export interface CalendarSchema extends BaseSchema {
  type: 'calendar';
  /**
   * Default selected date(s)
   */
  defaultValue?: Date | Date[];
  /**
   * Controlled selected date(s)
   */
  value?: Date | Date[];
  /**
   * Selection mode
   * @default 'single'
   */
  mode?: 'single' | 'multiple' | 'range';
  /**
   * Minimum selectable date
   */
  minDate?: Date | string;
  /**
   * Maximum selectable date
   */
  maxDate?: Date | string;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `calendar` renderer spreads it onto `DayPicker`, whose selection callback
   * is `onSelect`; nothing calls it. The zod twin refuses it by name; author
   * behaviour as a node type (`{ "type": "toast" }`, an `action:button` node)
   * instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * Input OTP component
 */
export interface InputOTPSchema extends BaseSchema {
  type: 'input-otp';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * OTP input label
   */
  label?: string;
  /**
   * Number of OTP digits
   * @default 6
   */
  length?: number;
  /**
   * Default value
   */
  defaultValue?: string;
  /**
   * Controlled value
   */
  value?: string;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `input-otp` renderer as `props.onChange(val)` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (value: string) => void;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `input-otp` renderer forwards only `toFormControlDomProps`'s whitelist,
   * which drops it. The zod twin refuses it by name; author behaviour as a node
   * type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onComplete?: never;
}

/**
 * Form validation rule
 */
export interface FieldValidationRules {
  /**
   * Required field validation
   */
  required?: string | boolean;
  /**
   * Minimum length validation
   */
  minLength?: { value: number; message: string };
  /**
   * Maximum length validation
   */
  maxLength?: { value: number; message: string };
  /**
   * Minimum value validation (for numbers)
   */
  min?: { value: number; message: string };
  /**
   * Maximum value validation (for numbers)
   */
  max?: { value: number; message: string };
  /**
   * Pattern validation (regex)
   *
   * `value` must be a compiled `RegExp` on this hand-written surface — never a
   * string. react-hook-form's field validator applies `pattern` only when
   * `value instanceof RegExp` (verified against the installed 7.85.0 bundle),
   * so a string here type-checked and then validated NOTHING, silently: the
   * form looked validated while the rule never ran (objectui#5099, maintainer
   * ruling 2026-08-18). String patterns belong to the metadata route's field
   * declaration (`FieldSchema.pattern`), which `buildValidationRules` in
   * `@object-ui/fields` compiles via `new RegExp(...)` before it reaches this
   * shape. The renderer deliberately does NOT compile strings at its read
   * point — that consumer-side tolerance would harden the ambiguous
   * declaration into contract (AGENTS.md #0.1); the declaration is narrowed
   * at the producer instead.
   */
  pattern?: { value: RegExp; message: string };
  /**
   * Custom validation function
   * @param value - The field value to validate
   * @returns true if valid, false or error message if invalid
   */
  validate?: (value: string | number | boolean | null | undefined) => boolean | string | Promise<boolean | string>;
}

/**
 * Form field condition for conditional rendering
 */
export interface FieldCondition {
  /**
   * Field to watch
   */
  field: string;
  /**
   * Show when field equals this value
   */
  equals?: any;
  /**
   * Show when field does not equal this value
   */
  notEquals?: any;
  /**
   * Show when field value is in this array
   */
  in?: any[];
  /**
   * Custom condition function
   */
  custom?: (formData: any) => boolean;
}

/**
 * One tab of a tabbed field layout (see `FormSchema.fieldTabs`).
 *
 * A tab claims a SUBSET of the form's `fields` by name. The form renderer still
 * renders exactly ONE `<form>` element / react-hook-form instance and merely
 * distributes the fields across tab panels that ALL STAY MOUNTED, so switching
 * tabs can neither destroy the values nor skip the validation of the tabs the
 * user is not currently looking at (objectui#2959).
 */
export interface FormFieldTab {
  /**
   * Stable tab key — the Radix `Tabs` value, also used for the panel's
   * `data-testid` (`form-tab-panel:{key}`).
   */
  key: string;
  /**
   * Tab trigger text. Falls back to `key`.
   */
  label?: string;
  /**
   * Optional blurb rendered above the tab's fields.
   */
  description?: string;
  /**
   * Names of the fields (as declared in `FormSchema.fields`) that belong to
   * this tab, in render order. Unknown names are ignored; fields claimed by no
   * tab render in a leading block above the tab strip (never dropped).
   */
  fields: string[];
  /**
   * Override the tab panel's field-grid classes (same role as
   * `FormSchema.fieldContainerClass`, scoped to this tab).
   */
  containerClass?: string;
  /**
   * The tab's predicate slot (objectui#6237) — the tabbed arm of the grouping
   * contract objectui#6236 landed for `section-divider` rows, so a section
   * rendered as a tab can carry the same authored `FormSection.visibleWhen` a
   * stacked section can. Evaluated by the form renderer on the canonical
   * engine with the live record and the host predicate scope bound (#6010),
   * exactly like a field's own `visibleWhen`; a broken predicate fails OPEN
   * (the tab stays visible).
   *
   * When it resolves FALSE the renderer draws neither the tab's trigger nor
   * its panel. Ruled semantics (maintainer, 2026-08-27 — the same ruling for
   * tabs as for sections): visibility decides what is DRAWN and nothing else —
   * a hidden tab's values still submit — and a hidden tab's fields SKIP
   * client-side validation, so a user is never blocked by an error pointing at
   * a control they cannot see; the server-side contract remains the loud floor
   * for genuinely-required data. Both semantics ride the unmount mechanism a
   * field's own false predicate already uses.
   *
   * The layout decision stays structural: whether the tabbed arm engages at
   * all is judged on the DECLARED tabs, so a predicate hiding all but one tab
   * filters what is drawn without collapsing the strip mid-interaction. A tab
   * without this key keeps the pre-#6237 contract (always drawn).
   */
  visibleWhen?: string | { dialect?: string; source: string };
}

/**
 * One pane of a split field layout (see `FormSchema.fieldPanes`).
 *
 * Like {@link FormFieldTab}, a pane claims a SUBSET of the form's `fields` by
 * name, and the form renderer still renders exactly ONE `<form>` element /
 * react-hook-form instance — it merely places each pane's fields in its own
 * resizable panel. The `<form>` wraps the whole panel group, which is what lets
 * a submit from anywhere collect every pane's values and lets a condition in one
 * pane read a field in another (objectui#2153).
 */
export interface FormFieldPane {
  /**
   * Stable pane key — used for the panel's `data-testid`
   * (`form-pane:{key}`).
   */
  key: string;
  /**
   * Names of the fields (as declared in `FormSchema.fields`) that belong to
   * this pane, in render order. Unknown names are ignored; fields claimed by no
   * pane render in a leading block above the panel group (never dropped).
   */
  fields: string[];
  /**
   * Initial pane size, as a percentage of the group (1–99). Defaults to an even
   * split.
   */
  defaultSize?: number;
  /**
   * Minimum pane size, as a percentage of the group.
   * @default 20
   */
  minSize?: number;
  /**
   * Override the pane's field-grid classes (same role as
   * `FormSchema.fieldContainerClass`, scoped to this pane).
   */
  containerClass?: string;
}

/**
 * A field's `dependsOn` as authored: a bare parent-field name, or a list of
 * names / lookup-parameter entries `{ field, param }`.
 *
 * This is the single source of truth for the shape (framework#4074).
 * `@object-ui/core`'s `resolveDependsOnFields` / `resolveCascadingOptions` —
 * the runtime readers — type their parameter with this import and re-export it,
 * so the authoring surface and the reader can no longer disagree the way they
 * did (the reader accepted arrays for as long as it has existed, while
 * `FormField.dependsOn` said `string`).
 */
export type DependsOnInput =
  | string
  | Array<string | { field: string; param?: string }>
  | undefined
  | null;

/**
 * Form field configuration
 */
export interface FormField {
  /**
   * Unique field identifier
   */
  id?: string;
  /**
   * Field name for form submission
   */
  name: string;
  /**
   * Field label
   */
  label?: string;
  /**
   * Field description
   */
  description?: string;
  /**
   * Field type/component
   */
  type?: string;
  /**
   * Input type (for input fields)
   */
  inputType?: string;
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Whether field is disabled
   */
  disabled?: boolean;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Select options (for select/radio)
   */
  options?: SelectOption[] | RadioOption[];
  /**
   * Validation rules
   */
  validation?: FieldValidationRules;
  /**
   * Conditional rendering
   */
  condition?: FieldCondition;
  /**
   * Custom widget/component name override.
   * Aligns with @objectstack/spec FormField.widget.
   * When set, the form renderer uses this widget type instead of auto-detecting.
   * @example 'rich-text', 'code-editor', 'rating'
   */
  widget?: string;
  /**
   * Parent field(s) for cascading/dependent fields.
   * Aligns with @objectstack/spec FormField.dependsOn.
   * When a parent field value changes, this field is re-evaluated.
   *
   * The runtime reader (`resolveCascadingOptions` in `@object-ui/core`) has
   * always accepted a bare name, a list of names, or lookup-parameter entries
   * `{ field, param }` — its parameter type is exactly {@link DependsOnInput}.
   * This property used to say `string` only, so array-authored metadata
   * type-errored while working, and the form renderer read the key through
   * `(f as any).dependsOn` to get past its own type (framework#4074).
   * @example 'country' (field 'state' dependsOn 'country')
   * @example ['industry'] (multi-parent gating)
   */
  dependsOn?: DependsOnInput;
  /**
   * Visibility condition expression (view-level, from the form view's
   * FormField). Aligns with @objectstack/spec FormField.visibleOn — the wire
   * shape is either a bare CEL string or the spec Expression object
   * `{ dialect, source }`. Evaluated against the live record via the
   * canonical `@objectstack/formula` engine (same as `visibleWhen`); a broken
   * predicate fails open (field stays visible).
   * @example "record.priority == 'urgent'"
   */
  visibleOn?: string | { dialect?: string; source: string };
  /**
   * Whether the field is hidden.
   * Aligns with @objectstack/spec FormField.hidden.
   * @default false
   */
  hidden?: boolean;
  /**
   * Whether the field is read-only.
   * Aligns with @objectstack/spec FormField.readonly.
   * @default false
   */
  readonly?: boolean;
  /**
   * CEL predicate: when it evaluates TRUE for the live record the field is
   * shown, when FALSE it is hidden. Aligns with @objectstack/spec
   * Field.visibleWhen and is enforced client-side via the canonical
   * `@objectstack/formula` engine (same dialect the server uses). A broken
   * predicate fails open (field stays visible).
   * @example "record.status == 'sent'"
   */
  visibleWhen?: string | { dialect?: string; source: string };
  /**
   * CEL predicate: when TRUE the field becomes read-only (the server also
   * strips matching writes via `stripReadonlyWhenFields`). Aligns with
   * @objectstack/spec Field.readonlyWhen. Fails open (field stays editable).
   * @example "record.status == 'paid'"
   */
  readonlyWhen?: string | { dialect?: string; source: string };
  /**
   * CEL predicate: when TRUE the field is required (the server enforces the
   * same rule in its rule-validator). Aligns with @objectstack/spec
   * Field.requiredWhen. Fails open (field is not required).
   * @example "record.status == 'sent'"
   */
  requiredWhen?: string | { dialect?: string; source: string };
  /**
   * The resolved object-field metadata **object** (typically a
   * {@link FieldMetadata} / server-served field definition), stashed by the
   * object-bound form paths so widgets can read `precision`, `currency`,
   * `reference_to`, `depends_on`, … It feeds the field-widget `field` prop.
   *
   * ⚠️ Same key, different layer: in the SPEC form-view vocabulary `field` is
   * a **string** (the referenced object-field name). That authored shape ends
   * at the `normalizeSectionField` chokepoint in `@object-ui/plugin-form` —
   * on a runtime FormField this slot is never a string, and its tripwire test
   * pins that. Declared (rather than ridden through the index signature) so
   * assigning a string here is a compile error instead of a latent pun
   * (#3090). Typed loosely because the stash's source is the server-served
   * object schema, whose key set is wider than the designer-oriented
   * {@link FieldMetadata} union.
   */
  field?: Record<string, any>;
  /**
   * Additional field-specific props
   */
  [key: string]: any;
  /**
   * Column span for grid layouts (1-4). Legacy — prefer `span`.
   * Aligns with @objectstack/spec FormField.colSpan. The renderer clamps it to
   * the current (per-surface derived) column count so it can never overflow.
   * @default 1
   */
  colSpan?: number;
  /**
   * Relative field width, decoupled from the (auto-derived) column count so it
   * stays correct at 1/2/3/4 columns (#2578). `'auto'` (default): width from
   * the widget type × current columns (wide widgets take the whole row);
   * `'full'`: whole row at any column count. Aligns with
   * @objectstack/spec FormField.span. Prefer this over `colSpan`.
   */
  span?: 'auto' | 'full';
  /**
   * Section grouping claim (objectui#6236) — `type: 'section-divider'` rows
   * only. Names of the fields (as declared in `FormSchema.fields`) that belong
   * to the section this divider heads: the same membership-claim shape
   * {@link FormFieldTab.fields} and {@link FormFieldPane.fields} already model,
   * so tabs, panes and sections share ONE grouping contract (the tabbed arm's
   * predicate slot is objectui#6237).
   *
   * A divider that carries this claim gates its WHOLE group: when the
   * divider's own visibility verdict (`visibleWhen` / `visibleOn` / legacy
   * `condition`) resolves FALSE, the renderer draws neither the heading nor
   * the claimed fields. Ruled semantics (maintainer, 2026-08-27, following the
   * console precedent of 2026-08-22 after #5594): visibility decides what is
   * DRAWN and nothing else — a hidden section's values still submit — and a
   * hidden section's fields SKIP client-side validation, so a user is never
   * blocked by an error pointing at a control they cannot see (the
   * objectui#6110 defect shape); the server-side contract remains the loud
   * floor for genuinely-required data.
   *
   * Unknown names are ignored (FormFieldTab parity). A field should be claimed
   * by at most one divider; when several claim it, any hidden claimer hides
   * it. A divider WITHOUT this claim keeps the pre-#6236 contract — a
   * presentational row whose predicate gates only the heading. On a
   * non-divider row the key has no meaning and is ignored by the renderer.
   */
  fields?: string[];
}

/**
 * Complete form component
 */
export interface FormSchema extends BaseSchema {
  type: 'form';
  /**
   * Owning object name. When set, the renderer derives metadata-based field
   * locators `data-testid="field:{objectName}.{field}"` (ADR-0054 C4).
   */
  objectName?: string;
  /**
   * Form fields configuration
   */
  fields?: FormField[];
  /**
   * Default form values
   */
  defaultValues?: Record<string, any>;
  /**
   * The PERSISTED record this form is editing, as read before the user
   * touched it. Set by an edit-mode host only — its ABSENCE is what tells the
   * renderer "this is an insert" (objectui#3484).
   *
   * Two things depend on it, both to keep the client's verdict identical to
   * the server's (`@objectstack/objectql` `stripReadonlyWhenFields`):
   *
   *  1. It binds `previous` for field-rule CEL predicates, so a
   *     `readonlyWhen: previous.status != 'draft'` locks the field in the form
   *     instead of faulting on an unbound root and failing OPEN — which let a
   *     user edit a locked field and have the change silently dropped on save.
   *  2. It is overlaid UNDER the live form values to form the `record`
   *     binding, mirroring the server's `merged = { ...previous, ...data }`, so
   *     a predicate may reference a record field this form does not render.
   *
   * Never send it anywhere: it is evaluation context, not form state.
   */
  previousValues?: Record<string, any>;
  /**
   * Submit button label
   * @default 'Submit'
   */
  submitLabel?: string;
  /**
   * Cancel button label
   * @default 'Cancel'
   */
  cancelLabel?: string;
  /**
   * Show cancel button
   * @default false
   */
  showCancel?: boolean;
  /**
   * Form layout
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal';
  /**
   * Number of columns for multi-column layout
   * @default 1
   */
  columns?: number;
  /**
   * Validation mode
   * @default 'onSubmit'
   */
  validationMode?: 'onSubmit' | 'onBlur' | 'onChange' | 'onTouched' | 'all';
  /**
   * Reset form after successful submission
   * @default false
   */
  resetOnSubmit?: boolean;
  /**
   * Form mode
   * @default 'edit'
   */
  mode?: 'edit' | 'read' | 'disabled';
  /**
   * Custom action buttons (replaces default submit/cancel)
   */
  actions?: SchemaNode[];
  /**
   * Submit handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * destructured off `schema` by `renderers/form/form.tsx` and awaited from
   * `handleSubmit`.
   */
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  /**
   * Change handler (called on any field change)
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * destructured off `schema` by `renderers/form/form.tsx` and subscribed to
   * the form values (objectui#4259).
   */
  onChange?: (data: Record<string, any>) => void;
  /**
   * Dirty-state handler — fires whenever the form transitions between
   * pristine and edited (react-hook-form's `formState.isDirty`). Overlay
   * hosts (modal/drawer) use this to guard against accidentally discarding
   * unsaved input when the user clicks the backdrop, presses Escape, or hits
   * the close/cancel button.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Cancel handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * destructured off `schema` by `renderers/form/form.tsx` and called from the
   * cancel action.
   */
  onCancel?: () => void;
  /**
   * Show form action buttons
   * @default true
   */
  showActions?: boolean;
  /**
   * Mobile UX (round 3): when true, the form's Submit/Cancel action row
   * becomes `position: sticky; bottom: 0` on small viewports — keeping the
   * primary action reachable on long mobile forms without an extra scroll.
   *
   * No-op on desktop (≥ md). Pairs with `ObjectFormSchema.mobile.stickyActions`.
   */
  mobileStickyActions?: boolean;
  /**
   * Field container CSS class
   */
  fieldContainerClass?: string;
  /**
   * Tabbed field layout (objectui#2959): each entry claims a subset of `fields`
   * and renders it in its own tab panel — inside the SAME `<form>` /
   * react-hook-form instance as every other tab. Panels are force-mounted (only
   * CSS-hidden), so a tab the user has left keeps both its values and its
   * validation, and a failed submit activates the tab holding the first
   * offending field.
   *
   * Ignored when `children` is set or fewer than two tabs are given (the form
   * then renders as a plain field list).
   */
  fieldTabs?: FormFieldTab[];
  /**
   * Initially active `fieldTabs` key. Defaults to the first tab.
   */
  defaultFieldTab?: string;
  /**
   * Where the `fieldTabs` strip sits relative to the panels.
   * @default 'top'
   */
  fieldTabsPosition?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Split field layout (objectui#2153): each entry claims a subset of `fields`
   * and renders it in its own resizable panel — inside the SAME `<form>` /
   * react-hook-form instance as every other pane, because the `<form>` wraps the
   * whole panel group. That is what a form PER panel could not do: its submit
   * reached only its own panel's fields, and its conditions could not see the
   * fields on the other side of the divider.
   *
   * Ignored when `children` or `fieldTabs` is set, or when fewer than two panes
   * are given (the form then renders as a plain field list).
   */
  fieldPanes?: FormFieldPane[];
  /**
   * Direction the `fieldPanes` are laid out in: `horizontal` = side by side,
   * `vertical` = stacked.
   * @default 'horizontal'
   */
  fieldPanesOrientation?: 'horizontal' | 'vertical';
  /**
   * Whether the `fieldPanes` divider offers a drag handle.
   * @default true
   */
  fieldPanesResizable?: boolean;
  /**
   * Child components (alternative to fields array)
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Label component
 */
export interface LabelSchema extends BaseSchema {
  type: 'label';
  /**
   * Label text content
   */
  text?: string;
  /**
    * Legacy label property
    */
  label?: string;
  /**
   * Legacy content property
   */
  content?: string;
  /**
   * HTML for attribute
   */
  htmlFor?: string;
}

/**
 * Combobox option
 */
export interface ComboboxOption {
  /**
   * Option value
   */
  value: string;
  /**
   * Option label (displayed to user)
   */
  label: string;
  /**
   * Whether option is disabled
   */
  disabled?: boolean;
}

/**
 * Combobox component (searchable select)
 */
export interface ComboboxSchema extends BaseSchema {
  type: 'combobox';
  /**
   * Field name for form submission
   */
  name?: string;
  /**
   * Combobox label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Combobox options
   */
  options?: ComboboxOption[];
  /**
   * Default selected value
   */
  defaultValue?: string;
  /**
   * Controlled value
   */
  value?: string;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `combobox` renderer forwards only `toFormControlDomProps`'s whitelist,
   * which drops it. The zod twin refuses it by name; author behaviour as a node
   * type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * Command menu item
 */
export interface CommandItem {
  /**
   * Item value
   */
  value: string;
  /**
   * Item label (displayed to user)
   */
  label: string;
  /**
   * Item icon
   */
  icon?: string;
}

/**
 * Command menu group
 */
export interface CommandGroup {
  /**
   * Group heading
   */
  heading?: string;
  /**
   * Group items
   */
  items: CommandItem[];
}

/**
 * Command component (command palette)
 */
export interface CommandSchema extends BaseSchema {
  type: 'command';
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Empty state text
   */
  emptyText?: string;
  /**
   * Command groups
   */
  groups?: CommandGroup[];
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `command` renderer spreads it onto cmdk's root `<div>`, where React fires
   * it with a SyntheticEvent on keystrokes — a different contract from `(value:
   * string) => void`, not a consumer of it. The zod twin refuses it by name;
   * author behaviour as a node type (`{ "type": "toast" }`, an `action:button`
   * node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onChange?: never;
}

/**
 * Code editor component (`code-editor`), rendered by `@object-ui/plugin-editor`
 * over Monaco.
 *
 * Declared here — rather than only in the plugin — for the reason `markdown`
 * and `kanban` already are: `AnyComponentSchema` in `./zod/index.zod.ts` is the
 * validator `objectui validate` and `objectui check` read, and a registered
 * component type absent from it validates as nothing at all (objectui#6318).
 * `@object-ui/types` has zero dependencies, so it cannot import the plugin's
 * own `CodeEditorSchema`; this is the same twin-declaration shape `markdown`
 * carries, and the zod mirror below it is pinned to THIS declaration.
 *
 * ⚠️ Every key is taken from a READ SITE, not from a view of what a code editor
 * ought to accept — `packages/plugin-editor/src/index.tsx:43-49` forwards
 * exactly `value`, `language`, `theme`, `height`, `onChange`, `readOnly` and
 * `className` into the lazy Monaco implementation, and the registration's own
 * `inputs`/`defaultProps` (same file, 64-77) name the same set.
 */
export interface CodeEditorSchema extends BaseSchema {
  type: 'code-editor';
  /**
   * The code content shown in the editor.
   *
   * Read at `plugin-editor/src/index.tsx:43` as `value ?? schema.value` — the
   * host prop wins, so this is the authored default rather than a controlled
   * value.
   */
  value?: string;
  /**
   * Monaco language id for syntax highlighting.
   *
   * Deliberately a bare `string` and not an enum: the renderer forwards it
   * verbatim to Monaco, which resolves any registered language id, and the
   * plugin's own declaration already widens its six-name list with `| string`.
   * The registration's `inputs` offer `javascript`, `typescript`, `python`,
   * `json`, `html` and `css` as the authoring shortlist — that is a picker
   * hint, not the accepted set.
   *
   * @default 'javascript'
   */
  language?: string;
  /**
   * Editor colour theme. Closed, unlike `language`: these are the two spellings
   * the plugin's `CodeEditorSchema` declares and the registration offers.
   *
   * @default 'vs-dark'
   */
  theme?: 'vs-dark' | 'light';
  /**
   * Editor height, forwarded to Monaco as a CSS length.
   *
   * @default '400px'
   */
  height?: string;
  /**
   * Whether the editor refuses edits.
   *
   * @default false
   */
  readOnly?: boolean;
  /**
   * Change handler. A runtime slot, not an authorable key — no JSON document
   * can carry a function.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * read by `plugin-editor` (`onChange ?? schema.onChange`).
   */
  onChange?: (value: string | undefined) => void;
}

/**
 * Union type of all form schemas
 */
export type FormComponentSchema =
  | ButtonSchema
  | InputSchema
  | TextareaSchema
  | SelectSchema
  | CheckboxSchema
  | RadioGroupSchema
  | SwitchSchema
  | ToggleSchema
  | SliderSchema
  | FileUploadSchema
  | DatePickerSchema
  | CalendarSchema
  | InputOTPSchema
  | FormSchema
  | LabelSchema
  | ComboboxSchema
  | CommandSchema
  | CodeEditorSchema;

