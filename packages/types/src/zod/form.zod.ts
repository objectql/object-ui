/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Form Component Zod Validators
 * 
 * Zod validation schemas for form input and interactive components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/form
 * @packageDocumentation
 */

import { z } from 'zod';
import { SelectOptionSchema as SpecSelectOptionSchema } from '@objectstack/spec/data';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * The wire shape of a CEL predicate (#2212): a bare string or the spec
 * Expression object `{ dialect?, source }`. Deliberately NOT the spec's
 * ExpressionInput pipe, which canonicalizes strings into an envelope at parse
 * time and would change this module's output shape.
 */
const ExpressionWireSchema = z.union([
  z.string(),
  z.object({ dialect: z.string().optional(), source: z.string() }),
]);

/**
 * Select Option Schema — derived from `@objectstack/spec/data`
 * `SelectOptionSchema` (objectstack#4115), with two pinned divergences and two
 * UI-only extensions. Drift guard: `__tests__/select-option-spec-parity.test.ts`.
 *
 * Spec keys flow in **by reference** via the spread: before this derivation the
 * schema silently stripped `color` (which `@object-ui/fields` renders as
 * badge/dot colors), `default`, and `visibleWhen` (which the select widgets
 * evaluate for per-option gating) — a strip-mode schema fails silently, which
 * is why the gap survived.
 */
export const SelectOptionSchema = z.object({
  ...SpecSelectOptionSchema.shape,
  // Deliberate divergence: the spec requires a lowercase machine identifier;
  // standalone UI forms legitimately bind numeric/boolean values. The parity
  // test pins both directions so a future spec widening gets noticed.
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Option value'),
  // Deliberate divergence: keep objectui's wire contract (#2212) instead of
  // the spec's envelope-canonicalizing ExpressionInput pipe.
  visibleWhen: ExpressionWireSchema.optional()
    .describe('Per-option visibility predicate (CEL) — option offered only when TRUE'),
  // objectui-only UI extensions (not in the spec; the parity test asserts the
  // spec has not claimed these names).
  disabled: z.boolean().optional().describe('Whether option is disabled'),
  icon: z.string().optional().describe('Option icon'),
});

/**
 * Radio Option Schema
 */
export const RadioOptionSchema = z.object({
  label: z.string().describe('Option label'),
  value: z.union([z.string(), z.number()]).describe('Option value'),
  disabled: z.boolean().optional().describe('Whether option is disabled'),
  description: z.string().optional().describe('Option description'),
});

/**
 * Combobox Option Schema
 */
export const ComboboxOptionSchema = z.object({
  value: z.string().describe('Option value'),
  label: z.string().describe('Option label'),
  disabled: z.boolean().optional().describe('Whether option is disabled'),
});

/**
 * Command Item Schema
 */
export const CommandItemSchema = z.object({
  value: z.string().describe('Item value'),
  label: z.string().describe('Item label'),
  icon: z.string().optional().describe('Item icon'),
});

/**
 * Command Group Schema
 */
export const CommandGroupSchema = z.object({
  heading: z.string().optional().describe('Group heading'),
  items: z.array(CommandItemSchema).describe('Group items'),
});

/**
 * Bounded numeric rule — the `{ value, message }` object react-hook-form
 * consumes for `minLength` / `maxLength` / `min` / `max`.
 */
const BoundedRuleSchema = (valueDescription: string) =>
  z.object({
    value: z.number().describe(valueDescription),
    message: z.string().describe('Error message shown when the rule fails'),
  });

/**
 * Validation Rule Schema — the zod mirror of `FieldValidationRules`
 * (`../form.ts`), which is the shape `form.tsx`'s read point spreads into
 * react-hook-form. Every rule except `required` is a `{ value, message }`
 * object; `required` is `string | boolean` (a string IS the message —
 * react-hook-form semantics).
 *
 * Until objectui#5186 this schema declared a flat scalar dialect
 * (`minLength: z.number()`, `pattern: z.string()`) that NO read point
 * consumed: `objectui validate` rejected metadata written to the public TS
 * contract and passed a dialect react-hook-form silently drops — #5099's
 * "looks validated, executes nothing", hidden on the zod face. The inner
 * shape is pinned by `__tests__/form-field-zod-coverage.test.ts`.
 *
 * `pattern.value` must be a compiled `RegExp` (#5099 ruling): react-hook-form
 * applies `pattern` only when `value instanceof RegExp`, and JSON/YAML cannot
 * express one — so on the JSON face a hand-written `pattern` is rejected BY
 * NAME with guidance toward the metadata route (`FieldSchema.pattern`, a
 * string the field pipeline compiles via `new RegExp(...)` in
 * `buildValidationRules`, `@object-ui/fields`, before it reaches this shape).
 * Deliberately NOT a string→RegExp coercion here — consumer-side tolerance
 * would re-open exactly what #5099 closed (AGENTS.md #0.1).
 */
export const FieldConstraintsSchema = z.object({
  required: z.union([z.boolean(), z.string()]).optional()
    .describe('Required rule — boolean flag, or the error message itself (string implies required)'),
  minLength: BoundedRuleSchema('Minimum length').optional().describe('Minimum length rule'),
  maxLength: BoundedRuleSchema('Maximum length').optional().describe('Maximum length rule'),
  min: BoundedRuleSchema('Minimum value').optional().describe('Minimum value rule (numbers)'),
  max: BoundedRuleSchema('Maximum value').optional().describe('Maximum value rule (numbers)'),
  pattern: z.object({
    value: z.custom<RegExp>((v) => v instanceof RegExp, {
      message:
        'pattern.value must be a compiled RegExp — react-hook-form runs `pattern` only when ' +
        'value instanceof RegExp, and JSON/YAML metadata cannot express one (objectui#5099). ' +
        'Declare the pattern on the field metadata route instead: `FieldSchema.pattern` (a ' +
        'string), which is compiled before it reaches this shape.',
    }).describe('Compiled RegExp — never a string; JSON authors use FieldSchema.pattern'),
    message: z.string().describe('Error message shown when the pattern fails'),
  }).optional().describe('Pattern rule (RegExp value + message)'),
  validate: z.function().optional().describe('Custom validation function'),
});

/**
 * Field Condition Schema
 */
export const FieldConditionSchema = z.object({
  field: z.string().describe('Field name to check'),
  equals: z.any().optional().describe('Value must equal'),
  notEquals: z.any().optional().describe('Value must not equal'),
  in: z.array(z.any()).optional().describe('Value must be in array'),
  custom: z.function().optional().describe('Custom condition function'),
});

/**
 * Button Schema - Button component
 */
export const ButtonSchema = BaseSchema.extend({
  type: z.literal('button'),
  label: z.string().optional().describe('Button text label'),
  variant: z.enum(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'])
    .optional()
    .default('default')
    .describe('Button variant/style'),
  size: z.enum(['default', 'sm', 'lg', 'icon'])
    .optional()
    .default('default')
    .describe('Button size'),
  disabled: z.boolean().optional().describe('Whether button is disabled'),
  loading: z.boolean().optional().describe('Whether button is in loading state'),
  icon: z.string().optional().describe('Icon to display (lucide-react icon name)'),
  iconPosition: z.enum(['left', 'right']).optional().default('left').describe('Icon position'),
  onClick: z.function()
    .optional()
    .describe('Click handler'),
  buttonType: z.enum(['button', 'submit', 'reset'])
    .optional()
    .default('button')
    .describe('Button type'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Input Schema - Text input component
 */
export const InputSchema = BaseSchema.extend({
  type: z.literal('input'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Input label'),
  placeholder: z.string().optional().describe('Placeholder text'),
  inputType: z.enum([
    'text', 'email', 'password', 'number', 'tel', 'url', 'search',
    'date', 'time', 'datetime-local',
  ])
    .optional()
    .default('text')
    .describe('Input type'),
  defaultValue: z.union([z.string(), z.number()]).optional().describe('Default value'),
  value: z.union([z.string(), z.number()]).optional().describe('Controlled value'),
  required: z.boolean().optional().describe('Whether field is required'),
  disabled: z.boolean().optional().describe('Whether field is disabled'),
  readOnly: z.boolean().optional().describe('Whether field is read-only'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
  min: z.number().optional().describe('Minimum value (for number type)'),
  max: z.number().optional().describe('Maximum value (for number type)'),
  step: z.number().optional().describe('Step value (for number type)'),
  maxLength: z.number().optional().describe('Maximum length'),
  pattern: z.string().optional().describe('Validation pattern'),
});

/**
 * Textarea Schema - Multi-line text input
 */
export const TextareaSchema = BaseSchema.extend({
  type: z.literal('textarea'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Textarea label'),
  placeholder: z.string().optional().describe('Placeholder text'),
  defaultValue: z.string().optional().describe('Default value'),
  value: z.string().optional().describe('Controlled value'),
  rows: z.number().optional().describe('Number of visible rows'),
  required: z.boolean().optional().describe('Whether field is required'),
  disabled: z.boolean().optional().describe('Whether field is disabled'),
  readOnly: z.boolean().optional().describe('Whether field is read-only'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
  maxLength: z.number().optional().describe('Maximum length'),
});

/**
 * Select Schema - Select/dropdown component
 */
export const SelectSchema = BaseSchema.extend({
  type: z.literal('select'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Select label'),
  placeholder: z.string().optional().describe('Placeholder text'),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Default value'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Controlled value'),
  options: z.array(SelectOptionSchema).describe('Select options'),
  required: z.boolean().optional().describe('Whether field is required'),
  disabled: z.boolean().optional().describe('Whether field is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Checkbox Schema - Checkbox component
 */
export const CheckboxSchema = BaseSchema.extend({
  type: z.literal('checkbox'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Checkbox label'),
  defaultChecked: z.boolean().optional().describe('Default checked state'),
  checked: z.boolean().optional().describe('Controlled checked state'),
  disabled: z.boolean().optional().describe('Whether checkbox is disabled'),
  required: z.boolean().optional()
    .describe("Required affordance, read at renderers/form/checkbox.tsx:45 (`required=` on the Radix Checkbox) and :49 (gates the label's `*` marker) (objectui#6150)"),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Radio Group Schema - Radio button group
 */
export const RadioGroupSchema = BaseSchema.extend({
  type: z.literal('radio-group'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Radio group label'),
  defaultValue: z.union([z.string(), z.number()]).optional().describe('Default value'),
  value: z.union([z.string(), z.number()]).optional().describe('Controlled value'),
  options: z.array(RadioOptionSchema).describe('Radio options'),
  orientation: z.enum(['horizontal', 'vertical']).optional().describe('Layout orientation'),
  disabled: z.boolean().optional().describe('Whether radio group is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Switch Schema - Toggle switch component
 */
export const SwitchSchema = BaseSchema.extend({
  type: z.literal('switch'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Switch label'),
  defaultChecked: z.boolean().optional().describe('Default checked state'),
  checked: z.boolean().optional().describe('Controlled checked state'),
  disabled: z.boolean().optional().describe('Whether switch is disabled'),
  description: z.string().optional().describe('Help text'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Toggle Schema - Toggle button component
 */
export const ToggleSchema = BaseSchema.extend({
  type: z.literal('toggle'),
  label: z.string().optional().describe('Toggle label'),
  defaultPressed: z.boolean().optional().describe('Default pressed state'),
  pressed: z.boolean().optional().describe('Controlled pressed state'),
  disabled: z.boolean().optional().describe('Whether toggle is disabled'),
  variant: z.enum(['default', 'outline']).optional().describe('Toggle variant'),
  size: z.enum(['default', 'sm', 'lg']).optional().describe('Toggle size'),
  onChange: z.function().optional().describe('Change handler'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Slider Schema - Range slider component
 */
export const SliderSchema = BaseSchema.extend({
  type: z.literal('slider'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Slider label'),
  defaultValue: z.union([z.number(), z.array(z.number())]).optional().describe('Default value(s)'),
  value: z.union([z.number(), z.array(z.number())]).optional().describe('Controlled value(s)'),
  min: z.number().optional().describe('Minimum value'),
  max: z.number().optional().describe('Maximum value'),
  step: z.number().optional().describe('Step value'),
  disabled: z.boolean().optional().describe('Whether slider is disabled'),
  description: z.string().optional().describe('Help text'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * File Upload Schema - File upload component
 */
export const FileUploadSchema = BaseSchema.extend({
  type: z.literal('file-upload'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Upload label'),
  buttonText: z.string().optional()
    .describe('Drop-zone label, read at renderers/form/file-upload.tsx:123 — `schema.buttonText || "DROP PAYLOAD OR CLICK TO UPLOAD"` (objectui#6150)'),
  wrapperClass: z.string().optional()
    .describe('Outer wrapper classes, appended to the renderer\'s own grid classes at renderers/form/file-upload.tsx:78 (objectui#6150)'),
  accept: z.string().optional().describe('Accepted file types'),
  multiple: z.boolean().optional().describe('Allow multiple files'),
  maxSize: z.number().optional().describe('Maximum file size (bytes)'),
  maxFiles: z.number().optional().describe('Maximum number of files'),
  disabled: z.boolean().optional().describe('Whether upload is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Date Picker Schema - Date picker component
 */
export const DatePickerSchema = BaseSchema.extend({
  type: z.literal('date-picker'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Date picker label'),
  placeholder: z.string().optional().describe('Placeholder text'),
  defaultValue: z.union([z.string(), z.date()]).optional().describe('Default value'),
  value: z.union([z.string(), z.date()]).optional().describe('Controlled value'),
  minDate: z.union([z.string(), z.date()]).optional().describe('Minimum date'),
  maxDate: z.union([z.string(), z.date()]).optional().describe('Maximum date'),
  format: z.string().optional().describe('Date format string'),
  disabled: z.boolean().optional().describe('Whether date picker is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Calendar Schema - Calendar component
 */
export const CalendarSchema = BaseSchema.extend({
  type: z.literal('calendar'),
  defaultValue: z.union([z.string(), z.date()]).optional().describe('Default value'),
  value: z.union([z.string(), z.date()]).optional().describe('Controlled value'),
  mode: z.enum(['single', 'multiple', 'range']).optional().describe('Selection mode'),
  minDate: z.union([z.string(), z.date()]).optional().describe('Minimum date'),
  maxDate: z.union([z.string(), z.date()]).optional().describe('Maximum date'),
  disabled: z.boolean().optional().describe('Whether calendar is disabled'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Input OTP Schema - One-time password input
 */
export const InputOTPSchema = BaseSchema.extend({
  type: z.literal('input-otp'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('OTP input label'),
  length: z.number().optional().describe('Number of OTP digits'),
  defaultValue: z.string().optional().describe('Default value'),
  value: z.string().optional().describe('Controlled value'),
  disabled: z.boolean().optional().describe('Whether OTP input is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
  onComplete: z.function().optional().describe('Complete handler'),
});

/**
 * Combobox Schema - Searchable select component
 */
export const ComboboxSchema = BaseSchema.extend({
  type: z.literal('combobox'),
  name: z.string().optional().describe('Field name for form submission'),
  label: z.string().optional().describe('Combobox label'),
  placeholder: z.string().optional().describe('Placeholder text'),
  options: z.array(ComboboxOptionSchema).describe('Combobox options'),
  defaultValue: z.string().optional().describe('Default value'),
  value: z.string().optional().describe('Controlled value'),
  disabled: z.boolean().optional().describe('Whether combobox is disabled'),
  description: z.string().optional().describe('Help text'),
  error: z.string().optional().describe('Error message'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Label Schema - Form label component
 */
export const LabelSchema = BaseSchema.extend({
  type: z.literal('label'),
  text: z.string().optional().describe('Label text'),
  label: z.string().optional().describe('Label text (alternative)'),
  htmlFor: z.string().optional().describe('Associated input ID'),
});

/**
 * Command Schema - Command palette component
 */
export const CommandSchema = BaseSchema.extend({
  type: z.literal('command'),
  placeholder: z.string().optional().describe('Search placeholder'),
  emptyText: z.string().optional().describe('Empty state text'),
  groups: z.array(CommandGroupSchema).describe('Command groups'),
  onChange: z.function().optional().describe('Change handler'),
});

/**
 * Form Field Schema — the RUNTIME form-field vocabulary (`name` = data path,
 * `type` = widget). This is deliberately NOT the spec's `FormFieldSchema`
 * (`field` = object-field reference, presentation deltas only): the two are
 * different layers, and `normalizeSectionField` in `@object-ui/plugin-form` is
 * the translation chokepoint between them (#3090).
 *
 * Keys mirror the AUTHORABLE surface of the `FormField` interface in
 * `../form.ts` — not every key that interface declares. `FormField.field` (the
 * resolved object-field metadata stash) is runtime-only and stays OUT of this
 * schema on purpose: in the authored vocabulary that same key name carries a
 * different meaning — a string naming the referenced object field — so
 * validating it here would re-open the pun #3090 closed (objectui#6609).
 *
 * Until #3090 this schema validated only 13 of the interface's declared keys
 * and *required* `type` (the interface says optional) — so `objectui validate`
 * silently ignored typos in `visibleWhen`/`widget`/`dependsOn`/… (strip mode)
 * and rejected metadata the renderer accepts. The pinned key list lives in
 * `__tests__/form-field-zod-coverage.test.ts`.
 */
/**
 * The ONE namespace a form field's widget id may name — objectui#5254,
 * maintainer ruling of 2026-08-19, made an authoring-time ERROR by
 * objectui#5375.
 *
 * ## What this refuses, and why it is an error rather than a warning
 *
 * A colon-qualified form-field widget id that does not name `field:`. Measured
 * on the real `form` renderer on the built-in path (no `registerAllFields()`):
 *
 *   type            registry hit   rendered type
 *   ui:password     TRUE           text
 *   secret          false          text
 *   field:secret    false          text
 *
 * `ui:password` **is** registered — as an SDUI node renderer for a top-level
 * `{ type: 'email' }`-style node — so an author who checks whether it resolves
 * gets a YES, and still gets a clear-text box on the field path. Refusing the
 * NAMESPACE closes that class instead of today's spellings, and it is an error
 * rather than a warning because a warning IS the silent degrade the rule
 * exists to kill, in a new spelling.
 *
 * `field:` passes whether or not the widget is registered: registration is a
 * RUNTIME fact (`registerAllFields()`, a lazily loaded plugin) that no
 * authoring-time validator can see, and the renderer already answers an
 * unregistered `field:` id with a visible refusal (objectui#5322). A BARE name
 * passes too — it is an open set, every registered `field:<name>` widget being
 * reachable by its short name. What is decidable statically is the namespace,
 * and it is a CLOSED set of one.
 *
 * ## Why the rule is stated twice, and what pins the copies together
 *
 * `validateFieldWidgetNamespace` in `@object-ui/core`
 * (`packages/core/src/validation/schema-validator.ts`) enforces the same rule
 * for `validateSchema`/`assertValidSchema`. This module cannot delegate to it:
 * `@object-ui/core` depends on `@object-ui/types`, so importing back would be
 * a cycle, and this package is declared "Zero deps. No React." The rule is
 * pure string logic, so the second statement costs nothing but drift — and
 * `__tests__/form-field-widget-namespace.test.ts` pins it case-for-case
 * against the table above, in the same rows core's own test uses.
 *
 * Until objectui#5449 only core enforced it, so `objectui validate` — the
 * surface an author actually runs before shipping, reaching this schema
 * through `safeValidateSchema` — returned a green tick on a document the
 * runtime rejects. Having done exactly the diligence objectui#5375 asks for,
 * the author shipped the bad metadata anyway.
 *
 * This is deliberately NOT an answer to "which validator is canonical"
 * (objectui#5449, objectui#4631): a third hand-rolled implementation lives in
 * `packages/vscode-extension/src/providers/SchemaValidator.ts`, and whether
 * the end state is one canonical validator or a contract the others defer to
 * is a maintainer architecture call. Closing the authoring-time gap is not,
 * and is all that happens here.
 */
const FIELD_WIDGET_NAMESPACE = 'field:';

/**
 * The two keys of an AUTHORED form field that can carry a widget id.
 *
 * Both are `unknown` rather than `string` because this narrowing has to be
 * done by the check itself: the refinement below also runs against values that
 * only reached it because the surrounding parse has not failed yet.
 */
interface AuthoredFieldWidgetKeys {
  type?: unknown;
  widget?: unknown;
}

/**
 * The widget id a form field will actually be RENDERED as.
 *
 * Mirrors the renderer's own precedence (`resolvedType` in
 * `packages/components/src/renderers/form/form.tsx`: explicit form-config
 * `widget`, then the resolved field metadata's widget hint, then the bare
 * `type`) and core's `resolveAuthoredFieldWidgetId`. Only the two keys an
 * AUTHORED schema carries are read here — the metadata widget hint is a
 * RESOLVED object that a hand-authored standalone form does not have.
 *
 * The mirroring is the point, not a convenience: a validator that disagrees
 * with the renderer about which component will actually render is how the
 * clear-text box got shipped in the first place.
 */
function resolveAuthoredFieldWidgetId(
  field: AuthoredFieldWidgetKeys,
): string | undefined {
  const id = field.widget ?? field.type;
  return typeof id === 'string' ? id : undefined;
}

/**
 * The refusal message for an unresolvable namespaced field widget id.
 *
 * Held identical to `@object-ui/core`'s wording on purpose: the two entry
 * points must not be able to describe the same defect differently, or an
 * author who saw one and then the other has to work out whether they are the
 * same finding.
 */
function unresolvableFieldWidgetNamespaceMessage(id: string): string {
  return (
    `'${id}' is not a form field widget: a namespaced field widget id must name the ` +
    `\`field:\` namespace (objectui#5254), so this id resolves NOTHING on the field path ` +
    `and the renderer would fall through to a plain text box — putting a secret on screen ` +
    `in clear text when the field holds one (objectui#5375). Write the built-in spelling ` +
    `(e.g. \`password\`), or the field widget id \`field:${id.slice(id.indexOf(':') + 1)}\`. ` +
    `Resolving in the registry is not proof it resolves HERE — \`ui:password\` is a ` +
    `registered SDUI node renderer and still renders clear text as a field.`
  );
}

export const FormFieldSchema = z.object({
  id: z.string().optional().describe('Field ID'),
  name: z.string().describe('Field name (form data path)'),
  label: z.string().optional().describe('Field label'),
  description: z.string().optional().describe('Field description'),
  type: z.string().optional().describe('Widget type (defaults per renderer when omitted)'),
  inputType: z.string().optional().describe('Input type'),
  required: z.boolean().optional().describe('Required flag'),
  disabled: z.boolean().optional().describe('Disabled flag'),
  placeholder: z.string().optional().describe('Placeholder text'),
  options: z.array(SelectOptionSchema).optional().describe('Options for select/radio'),
  validation: FieldConstraintsSchema.optional().describe('Validation rules'),
  condition: FieldConditionSchema.optional().describe('Conditional display (legacy)'),
  widget: z.string().optional().describe('Custom widget/component name override'),
  dependsOn: z.union([
    z.string(),
    z.array(z.union([
      z.string(),
      z.object({ field: z.string(), param: z.string().optional() }),
    ])),
  ]).nullish().describe('Parent field(s) for cascading/dependent fields'),
  hidden: z.boolean().optional().describe('Whether the field is hidden'),
  readonly: z.boolean().optional().describe('Whether the field is read-only'),
  visibleOn: ExpressionWireSchema.optional()
    .describe('View-level visibility predicate (CEL) — ANDed with visibleWhen'),
  visibleWhen: ExpressionWireSchema.optional()
    .describe('Field-level visibility rule (CEL) — field shown only when TRUE'),
  readonlyWhen: ExpressionWireSchema.optional()
    .describe('Field-level read-only rule (CEL)'),
  requiredWhen: ExpressionWireSchema.optional()
    .describe('Field-level required rule (CEL)'),
  colSpan: z.number().optional().describe('Column span in grid layout (legacy — prefer span)'),
  span: z.enum(['auto', 'full']).optional().describe('Relative field width'),
  fields: z.array(z.string()).optional()
    .describe('Section grouping claim (objectui#6236) — section-divider rows only: names of the fields the section claims (the FormFieldTab.fields membership shape); the divider predicate then gates the whole group'),
}).superRefine((field, ctx) => {
  // objectui#5449 — the namespace rule `@object-ui/core` has enforced since
  // objectui#5375, stated here so `objectui validate` (which reaches this
  // schema via `safeValidateSchema`) stops green-lighting a document the
  // runtime rejects. Rule, census and the drift pin: FIELD_WIDGET_NAMESPACE.
  const id = resolveAuthoredFieldWidgetId(field);
  if (!id || !id.includes(':') || id.startsWith(FIELD_WIDGET_NAMESPACE)) return;
  ctx.addIssue({
    code: 'custom',
    // Same key core blames, chosen the same way: `widget` wins the precedence
    // above, so it is the key to fix when it is the one carrying the id.
    path: [typeof field.widget === 'string' ? 'widget' : 'type'],
    // Carries core's error code so a consumer can key off the finding rather
    // than string-matching the message. Zod's own `code` is `custom` for every
    // refinement, which cannot tell two of them apart.
    params: { code: 'UNRESOLVABLE_FIELD_WIDGET_NAMESPACE' },
    message: unresolvableFieldWidgetNamespaceMessage(id),
  });
});

/**
 * Form Schema - Complete form component
 */
export const FormSchema = BaseSchema.extend({
  type: z.literal('form'),
  objectName: z.string().optional().describe('Owning object name (drives field locators)'),
  fields: z.array(FormFieldSchema).describe('Form fields'),
  defaultValues: z.record(z.string(), z.any()).optional().describe('Default form values'),
  previousValues: z
    .record(z.string(), z.any())
    .optional()
    .describe('Persisted record being edited — binds `previous` for field-rule CEL predicates'),
  submitLabel: z.string().optional().describe('Submit button label'),
  cancelLabel: z.string().optional().describe('Cancel button label'),
  showCancel: z.boolean().optional().describe('Show cancel button'),
  layout: z.enum(['vertical', 'horizontal', 'grid']).optional().describe('Form layout'),
  columns: z.number().optional().describe('Number of columns (for grid layout)'),
  validationMode: z.enum(['onSubmit', 'onChange', 'onBlur', 'onTouched', 'all']).optional().describe('Validation mode'),
  resetOnSubmit: z.boolean().optional().describe('Reset form on successful submit'),
  disabled: z.boolean().optional().describe('Disable entire form'),
  mode: z.enum(['create', 'edit', 'view']).optional().describe('Form mode'),
  actions: z.array(z.any()).optional().describe('Custom actions'),
  onSubmit: z.function().optional().describe('Submit handler'),
  onChange: z.function().optional().describe('Change handler'),
  onCancel: z.function().optional().describe('Cancel handler'),
  showActions: z.boolean().optional().describe('Show action buttons'),
});

/**
 * Form Component Schema Union - All form component schemas
 */
/**
 * Code Editor Schema — mirrors `CodeEditorSchema` in `../form.ts`.
 *
 * Closes the other half of objectui#6318's bucket B: `code-editor` is a
 * REGISTERED component (`@object-ui/plugin-editor`) that no union member
 * modelled, so every document naming it failed `safeValidateSchema` and three
 * schema-catalog entries were reported as unrecognised content.
 *
 * Derived from the renderer's forwards
 * (`plugin-editor/src/index.tsx:43-49`), not from a view of what a code editor
 * ought to accept. `language` stays `z.string()` rather than the registration's
 * six-name picker list, because the renderer hands the value straight to Monaco
 * and the plugin's own declaration already widens that list with `| string`;
 * `theme` stays closed because both declarations agree it is two spellings.
 */
export const CodeEditorSchema = BaseSchema.extend({
  type: z.literal('code-editor'),
  value: z.string().optional().describe('Code content'),
  language: z.string().optional().describe('Monaco language id for syntax highlighting'),
  theme: z.enum(['vs-dark', 'light']).optional().describe('Editor colour theme'),
  height: z.string().optional().describe('Editor height as a CSS length'),
  readOnly: z.boolean().optional().describe('Whether the editor refuses edits'),
  onChange: z.function().optional().describe('Change handler'),
});

export const FormComponentSchema = z.discriminatedUnion('type', [
  ButtonSchema,
  InputSchema,
  TextareaSchema,
  SelectSchema,
  CheckboxSchema,
  RadioGroupSchema,
  SwitchSchema,
  ToggleSchema,
  SliderSchema,
  FileUploadSchema,
  DatePickerSchema,
  CalendarSchema,
  InputOTPSchema,
  ComboboxSchema,
  LabelSchema,
  CommandSchema,
  FormSchema,
  CodeEditorSchema,
]);
