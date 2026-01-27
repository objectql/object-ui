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
import { BaseSchema, SchemaNodeSchema } from './base.zod';

/**
 * Select Option Schema
 */
export const SelectOptionSchema = z.object({
  label: z.string().describe('Option label'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Option value'),
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
 * Validation Rule Schema
 */
export const ValidationRuleSchema = z.object({
  required: z.boolean().optional().describe('Whether field is required'),
  minLength: z.number().optional().describe('Minimum length'),
  maxLength: z.number().optional().describe('Maximum length'),
  min: z.number().optional().describe('Minimum value'),
  max: z.number().optional().describe('Maximum value'),
  pattern: z.string().optional().describe('Validation pattern (regex)'),
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
  defaultValue: z.union([z.string(), z.number()]).optional().describe('Default value'),
  value: z.union([z.string(), z.number()]).optional().describe('Controlled value'),
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
 * Form Field Schema
 */
export const FormFieldSchema = z.object({
  id: z.string().optional().describe('Field ID'),
  name: z.string().describe('Field name'),
  label: z.string().optional().describe('Field label'),
  description: z.string().optional().describe('Field description'),
  type: z.string().describe('Field type'),
  inputType: z.string().optional().describe('Input type'),
  required: z.boolean().optional().describe('Required flag'),
  disabled: z.boolean().optional().describe('Disabled flag'),
  placeholder: z.string().optional().describe('Placeholder text'),
  options: z.array(SelectOptionSchema).optional().describe('Options for select/radio'),
  validation: ValidationRuleSchema.optional().describe('Validation rules'),
  condition: FieldConditionSchema.optional().describe('Conditional display'),
  colSpan: z.number().optional().describe('Column span in grid layout'),
});

/**
 * Form Schema - Complete form component
 */
export const FormSchema = BaseSchema.extend({
  type: z.literal('form'),
  fields: z.array(FormFieldSchema).describe('Form fields'),
  defaultValues: z.record(z.string(), z.any()).optional().describe('Default form values'),
  submitLabel: z.string().optional().describe('Submit button label'),
  cancelLabel: z.string().optional().describe('Cancel button label'),
  showCancel: z.boolean().optional().describe('Show cancel button'),
  layout: z.enum(['vertical', 'horizontal', 'grid']).optional().describe('Form layout'),
  columns: z.number().optional().describe('Number of columns (for grid layout)'),
  validationMode: z.enum(['onSubmit', 'onChange', 'onBlur']).optional().describe('Validation mode'),
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
export const FormComponentSchema = z.union([
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
]);
