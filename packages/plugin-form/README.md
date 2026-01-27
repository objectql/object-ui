# @object-ui/plugin-form

Form plugin for Object UI - Advanced form components with validation, multi-step forms, and field-level control.

## Features

- **Form Builder** - Create complex forms from schemas
- **Validation** - Built-in validation with error messages
- **Multi-Step Forms** - Wizard-style multi-step forms
- **Field Types** - Support for all standard field types
- **Form State** - Automatic form state management
- **Customizable** - Tailwind CSS styling support

## Installation

```bash
pnpm add @object-ui/plugin-form
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-form';

// Now you can use form types in your schemas
const schema = {
  type: 'form',
  fields: [
    { name: 'email', type: 'input', label: 'Email', required: true },
    { name: 'password', type: 'input', inputType: 'password', label: 'Password', required: true }
  ]
};
```

### Manual Registration

```typescript
import { formComponents } from '@object-ui/plugin-form';
import { ComponentRegistry } from '@object-ui/core';

// Register form components
Object.entries(formComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### Form

Complete form with fields and validation:

```typescript
{
  type: 'form',
  fields: FormField[],
  submitLabel?: string,
  cancelLabel?: string,
  onSubmit?: (data) => void,
  onCancel?: () => void,
  className?: string
}
```

### Form Field

Individual form field configuration:

```typescript
interface FormField {
  name: string;
  type: string;                   // 'input', 'select', 'checkbox', etc.
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: ValidationRule[];
  defaultValue?: any;
  disabled?: boolean;
  className?: string;
}
```

## Examples

### Basic Form

```typescript
const schema = {
  type: 'form',
  fields: [
    {
      name: 'name',
      type: 'input',
      label: 'Full Name',
      placeholder: 'Enter your name',
      required: true
    },
    {
      name: 'email',
      type: 'input',
      inputType: 'email',
      label: 'Email Address',
      required: true,
      validation: [
        { type: 'email', message: 'Invalid email format' }
      ]
    },
    {
      name: 'country',
      type: 'select',
      label: 'Country',
      options: [
        { label: 'United States', value: 'us' },
        { label: 'Canada', value: 'ca' },
        { label: 'United Kingdom', value: 'uk' }
      ]
    },
    {
      name: 'subscribe',
      type: 'checkbox',
      label: 'Subscribe to newsletter'
    }
  ],
  submitLabel: 'Register',
  onSubmit: (data) => {
    console.log('Form submitted:', data);
  }
};
```

### Multi-Step Form

```typescript
const schema = {
  type: 'multi-step-form',
  steps: [
    {
      title: 'Personal Info',
      fields: [
        { name: 'firstName', type: 'input', label: 'First Name', required: true },
        { name: 'lastName', type: 'input', label: 'Last Name', required: true }
      ]
    },
    {
      title: 'Contact Info',
      fields: [
        { name: 'email', type: 'input', inputType: 'email', label: 'Email', required: true },
        { name: 'phone', type: 'input', inputType: 'tel', label: 'Phone' }
      ]
    },
    {
      title: 'Review',
      fields: []
    }
  ],
  onSubmit: (data) => {
    console.log('Multi-step form completed:', data);
  }
};
```

### Form with Validation

```typescript
const schema = {
  type: 'form',
  fields: [
    {
      name: 'username',
      type: 'input',
      label: 'Username',
      required: true,
      validation: [
        { type: 'minLength', value: 3, message: 'Username must be at least 3 characters' },
        { type: 'maxLength', value: 20, message: 'Username must be less than 20 characters' },
        { type: 'pattern', value: '^[a-zA-Z0-9_]+$', message: 'Only letters, numbers, and underscores' }
      ]
    },
    {
      name: 'password',
      type: 'input',
      inputType: 'password',
      label: 'Password',
      required: true,
      validation: [
        { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' },
        { type: 'pattern', value: '(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])', message: 'Must contain uppercase, lowercase, and number' }
      ]
    }
  ]
};
```

## Integration with Data Sources

Connect forms to backend APIs:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'form',
  dataSource,
  resource: 'users',
  fields: [/* fields */],
  onSubmit: async (data) => {
    await dataSource.create('users', data);
  }
};
```

## TypeScript Support

```typescript
import type { FormSchema, FormField } from '@object-ui/plugin-form';

const emailField: FormField = {
  name: 'email',
  type: 'input',
  inputType: 'email',
  label: 'Email',
  required: true
};

const loginForm: FormSchema = {
  type: 'form',
  fields: [emailField],
  submitLabel: 'Sign In'
};
```

## Field Components

The plugin includes these field components:
- Text input
- Email input
- Password input
- Number input
- Textarea
- Select dropdown
- Checkbox
- Radio group
- Date picker
- File upload

## License

MIT
