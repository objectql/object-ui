---
title: "Form Components"
---

Components for user input and data collection.

## Form `form`

A wrapper that manages data state and validation for input fields.

```typescript
interface FormSchema {
  type: 'form';
  fields: FormFieldSchema[]; // Simplified definition where fields are defined inline
  // OR
  body: Schema[]; // Free-form children, usually containing inputs bound by name
  
  defaultValues?: Record<string, any>;
  onSubmit?: string | ActionConfig; // Action triggered on valid submit
  
  layout?: 'vertical' | 'horizontal' | 'inline';
  size?: 'sm' | 'default' | 'lg';
  
  // Quick Actions (if not using custom body)
  submitLabel?: string;
  resetLabel?: string;
}
```

## Input `input`

Basic text input field.

```typescript
interface InputSchema {
  type: 'input';
  name: string; // Field name for form binding
  label?: string;
  inputType?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local';
  placeholder?: string;
  defaultValue?: string | number;
  
  // Validation
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex
  
  // Appearance
  prefix?: string | Schema; // Icon or text
  suffix?: string | Schema;
  readonly?: boolean;
  disabled?: boolean;
  
  description?: string; // Helper text
}
```

## Textarea `textarea`

Multi-line text input.

```typescript
interface TextareaSchema {
  type: 'textarea';
  name: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  description?: string;
}
```

## Select `select`

Dropdown selection from a list of options.

```typescript
interface SelectSchema {
  type: 'select';
  name: string;
  label?: string;
  options: { label: string; value: string | number }[]; // Static options
  // OR
  dataSource?: string; // Dynamic options from datasource
  
  mode?: 'single' | 'multiple';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
}
```

## Checkbox `checkbox`

Boolean toggle or multiple selection.

```typescript
interface CheckboxSchema {
  type: 'checkbox';
  name: string;
  label: string; // Text next to checkbox
  checked?: boolean; // Default state
  disabled?: boolean;
}

interface CheckboxGroupSchema {
  type: 'checkbox-group';
  name: string;
  label?: string;
  options: { label: string; value: string | number }[];
  direction?: 'vertical' | 'horizontal';
}
```

## Radio `radio`

Single selection from a group.

```typescript
interface RadioGroupSchema {
  type: 'radio-group';
  name: string;
  label: string; // Group label
  options: { label: string; value: string | number }[];
  direction?: 'vertical' | 'horizontal';
  disabled?: boolean;
}
```

## Switch `switch`

Toggle switch for boolean values.

```typescript
interface SwitchSchema {
  type: 'switch';
  name: string;
  label?: string; 
  checkedLabel?: string; // Text when on
  uncheckedLabel?: string; // Text when off
  disabled?: boolean;
}
```

## Slider `slider`

Range selection.

```typescript
interface SliderSchema {
  type: 'slider';
  name: string;
  min: number;
  max: number;
  step?: number;
  range?: boolean; // Two handles
  vertical?: boolean;
  disabled?: boolean;
}
```

## Upload `upload`

File upload component.

```typescript
interface UploadSchema {
  type: 'upload';
  name: string;
  action: string; // Upload URL with automatic datasource handling if omitted
  multiple?: boolean;
  accept?: string; // File types
  maxSize?: number; // Bytes
  listType?: 'text' | 'picture' | 'picture-card';
}
```

## Date Picker `date-picker`

Calendar-based date selection.

```typescript
interface DatePickerSchema {
  type: 'date-picker';
  name: string;
  label?: string;
  mode?: 'date' | 'range' | 'datetime';
  format?: string; // Display format e.g. "YYYY-MM-DD"
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}
```
