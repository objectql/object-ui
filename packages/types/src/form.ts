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

import type { BaseSchema, SchemaNode } from './base';

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
   * Whether button is disabled
   */
  disabled?: boolean;
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
  defaultValue?: string;
  /**
   * Controlled value
   */
  value?: string;
  /**
   * Select options
   */
  options: SelectOption[];
  /**
   * Whether field is required
   */
  required?: boolean;
  /**
   * Whether field is disabled
   */
  disabled?: boolean;
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
   */
  onChange?: (value: string) => void;
}

/**
 * Select option
 */
export interface SelectOption {
  /**
   * Option label (displayed to user)
   */
  label: string;
  /**
   * Option value (submitted in form)
   */
  value: string;
  /**
   * Whether option is disabled
   */
  disabled?: boolean;
  /**
   * Option icon
   */
  icon?: string;
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
   * Whether checkbox is disabled
   */
  disabled?: boolean;
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
  defaultValue?: string;
  /**
   * Controlled value
   */
  value?: string;
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
   */
  onChange?: (value: string) => void;
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
   * Option value
   */
  value: string;
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
   * Whether switch is disabled
   */
  disabled?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Change handler
   */
  onChange?: (checked: boolean) => void;
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
   * Whether toggle is disabled
   */
  disabled?: boolean;
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
   * Change handler
   */
  onChange?: (pressed: boolean) => void;
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
   * Whether slider is disabled
   */
  disabled?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Change handler
   */
  onChange?: (value: number[]) => void;
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
   * Whether field is disabled
   */
  disabled?: boolean;
  /**
   * Help text or description
   */
  description?: string;
  /**
   * Error message
   */
  error?: string;
  /**
   * Change handler (receives FileList or File[])
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
   * Whether calendar is disabled
   */
  disabled?: boolean;
  /**
   * Change handler
   */
  onChange?: (date: Date | Date[] | undefined) => void;
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
   */
  onChange?: (value: string) => void;
  /**
   * Complete handler (called when all digits filled)
   */
  onComplete?: (value: string) => void;
}

/**
 * Form validation rule
 */
export interface ValidationRule {
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
   */
  pattern?: { value: string | RegExp; message: string };
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
  validation?: ValidationRule;
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
   * Parent field name for cascading/dependent fields.
   * Aligns with @objectstack/spec FormField.dependsOn.
   * When the parent field value changes, this field is re-evaluated.
   * @example 'country' (field 'state' dependsOn 'country')
   */
  dependsOn?: string;
  /**
   * Visibility condition expression.
   * Aligns with @objectstack/spec FormField.visibleOn.
   * When evaluated to false, the field is hidden.
   * @example "${data.role === 'admin'}"
   */
  visibleOn?: string;
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
   * @deprecated Back-compat alias of {@link requiredWhen}. Aligns with
   * @objectstack/spec Field.conditionalRequired.
   */
  conditionalRequired?: string | { dialect?: string; source: string };
  /**
   * Additional field-specific props
   */
  [key: string]: any;
  /**
   * Column span for grid layouts (1-4).
   * Aligns with @objectstack/spec FormField.colSpan.
   * @default 1
   */
  colSpan?: number;
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
   * Whether form is disabled
   */
  disabled?: boolean;
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
   */
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  /**
   * Change handler (called on any field change)
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
   * Whether field is disabled
   */
  disabled?: boolean;
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
   */
  onChange?: (value: string) => void;
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
   * Change handler
   */
  onChange?: (value: string) => void;
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
  | CommandSchema;

