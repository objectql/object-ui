# FormRenderer Component

The `FormRenderer` component is a React component that renders forms based on the `FormView` schema from `@objectstack/spec`. It provides a flexible and powerful way to create forms with minimal code.

## Features

- ✅ **Schema-driven**: Define forms using JSON schema from `@objectstack/spec`
- ✅ **Multi-column layouts**: Support for 1-4 column grid layouts
- ✅ **Collapsible sections**: Organize forms with collapsible sections
- ✅ **Form state management**: Built-in state management using `react-hook-form`
- ✅ **Multiple field types**: Text, Number, Checkbox, Textarea, Select, Date, DateTime, Time
- ⏳ **Conditional fields**: Show/hide fields based on conditions (planned)
- ⏳ **Schema validation**: Zod validation support (planned)
- ✅ **Column spanning**: Fields can span multiple columns
- ✅ **Help text**: Display helpful descriptions for fields
- ✅ **Required fields**: Mark fields as required with validation

## Installation

The FormRenderer component is part of the `@object-ui/react` package:

```bash
npm install @object-ui/react @objectstack/spec react-hook-form
```

Or with pnpm:

```bash
pnpm add @object-ui/react @objectstack/spec react-hook-form
```

## Basic Usage

```tsx
import { FormRenderer } from '@object-ui/react';
import type { FormView } from '@objectstack/spec/ui';

const schema: FormView = {
  type: 'simple',
  sections: [
    {
      label: 'Contact Information',
      collapsible: false,
      collapsed: false,
      columns: 2,
      fields: [
        {
          field: 'firstName',
          label: 'First Name',
          required: true,
          widget: 'text',
        },
        {
          field: 'lastName',
          label: 'Last Name',
          required: true,
          widget: 'text',
        },
        {
          field: 'email',
          label: 'Email',
          required: true,
          widget: 'email',
          helpText: 'We will never share your email',
        },
      ],
    },
  ],
};

function MyForm() {
  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
  };

  return (
    <FormRenderer
      schema={schema}
      onSubmit={handleSubmit}
    />
  );
}
```

## Props

### FormRendererProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `FormView` | Yes | The FormView schema from @objectstack/spec |
| `data` | `Record<string, any>` | No | Initial form data |
| `onSubmit` | `(data: Record<string, any>) => void \| Promise<void>` | No | Form submission handler |
| `onChange` | `(data: Record<string, any>) => void` | No | Form change handler |
| `className` | `string` | No | Custom CSS class for the form |
| `disabled` | `boolean` | No | Whether the form is disabled |

## Schema Structure

### FormView

The main schema that defines the entire form.

```typescript
interface FormView {
  type: 'simple' | 'tabbed' | 'wizard';
  sections?: FormSection[];
  data?: DataSource; // Optional data source configuration
}
```

### FormSection

Defines a section of the form with its own layout.

```typescript
interface FormSection {
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns: 1 | 2 | 3 | 4;
  fields: (string | FormField)[];
}
```

### FormField

Defines individual form fields.

```typescript
interface FormField {
  field: string; // Field name
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: number; // Number of columns to span (1-4)
  widget?: string; // Widget type (text, number, checkbox, etc.)
  dependsOn?: string; // Field dependency
  visibleOn?: string; // Visibility condition
}
```

## Supported Widget Types

The `FieldFactory` component supports the following widget types:

### Text Input Types
- `text`, `string` - Basic text input
- `email` - Email input with validation
- `password` - Password input (masked)
- `url` - URL input
- `tel`, `phone` - Telephone/phone number input
- `textarea` - Multi-line text input
- `markdown` - Markdown text editor (textarea with monospace font)
- `html` - HTML/Rich text editor (textarea with monospace font)

### Numeric Input Types
- `number`, `integer`, `float` - Number input
- `currency` - Currency input with $ prefix
- `percent` - Percentage input with % suffix

### Boolean & Selection Types
- `checkbox`, `boolean` - Checkbox input
- `select`, `dropdown` - Select dropdown

### Date & Time Types
- `date` - Date picker
- `datetime`, `datetime-local` - DateTime picker
- `time` - Time picker

### File Upload Types
- `file` - File upload input
- `image` - Image upload input (defaults to image/* mime types)

### Relationship Types
- `lookup` - Lookup/reference field (select with options)
- `master_detail` - Master-detail relationship (select with options)
- `user`, `owner` - User selection field (select with options)

### Complex & Special Types
- `location` - Geographic location (latitude/longitude inputs)
- `object` - JSON object editor (textarea with JSON validation)
- `formula` - Read-only computed field
- `summary` - Read-only aggregation/rollup field
- `auto_number` - Read-only auto-generated number
- `vector` - Vector/embedding display (read-only)
- `grid` - Sub-table/grid editor (placeholder)

## Extended Field Properties

Some field types support additional properties beyond the base FormField schema:

```typescript
interface ExtendedFormField extends FormField {
  // For file/image uploads
  multiple?: boolean;
  accept?: string[];
  
  // For select/lookup/user fields
  options?: Array<{
    label: string;
    value: string;
    disabled?: boolean;
  }>;
}
```

Example usage with extended properties:

```tsx
{
  field: 'avatar',
  label: 'Profile Picture',
  widget: 'image',
  accept: ['image/png', 'image/jpeg'],
  multiple: false
}

{
  field: 'account',
  label: 'Account',
  widget: 'lookup',
  options: [
    { label: 'Account 1', value: '1' },
    { label: 'Account 2', value: '2' }
  ]
}
```

## Known Limitations

### Version 0.3.0

- **Conditional Visibility**: The `visibleOn` and `dependsOn` properties are not yet implemented. Fields are visible by default unless explicitly marked as `hidden`.
- **Advanced Select Options**: While select/lookup/user fields support options via the `ExtendedFormField` interface, they don't yet support advanced features like search, async loading, or custom rendering.
- **Rich Text Editors**: The `markdown` and `html` widgets currently use plain textareas with monospace fonts. Full WYSIWYG editors are planned for future releases.
- **File Upload Preview**: File and image widgets support uploads but don't yet show previews or provide upload progress indicators.
- **Location Maps**: The location widget provides lat/lng inputs but doesn't include map visualization or geocoding.
- **Grid Editor**: The grid widget is a placeholder and doesn't yet provide spreadsheet-like editing capabilities.
- **Validation**: Currently only basic required field validation is supported via react-hook-form. Advanced Zod schema validation is planned for future releases.

These features are planned for future releases.

## Examples

### Multi-Section Form

```tsx
const schema: FormView = {
  type: 'simple',
  sections: [
    {
      label: 'Personal Information',
      collapsible: true,
      collapsed: false,
      columns: 2,
      fields: [
        { field: 'firstName', label: 'First Name', required: true, widget: 'text' },
        { field: 'lastName', label: 'Last Name', required: true, widget: 'text' },
        { field: 'email', label: 'Email', required: true, widget: 'email' },
        { field: 'phone', label: 'Phone', widget: 'tel' },
      ],
    },
    {
      label: 'Preferences',
      collapsible: true,
      collapsed: true,
      columns: 1,
      fields: [
        {
          field: 'newsletter',
          label: 'Subscribe to newsletter',
          widget: 'checkbox',
          helpText: 'Receive updates about our products',
        },
      ],
    },
  ],
};
```

### Form with Initial Data

```tsx
const initialData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  newsletter: true,
};

<FormRenderer
  schema={schema}
  data={initialData}
  onSubmit={handleSubmit}
/>
```

### Form with Column Spanning

```tsx
const schema: FormView = {
  type: 'simple',
  sections: [
    {
      label: 'Contact',
      columns: 2,
      fields: [
        { field: 'name', label: 'Name', widget: 'text' },
        { field: 'email', label: 'Email', widget: 'email' },
        {
          field: 'message',
          label: 'Message',
          widget: 'textarea',
          colSpan: 2, // Spans both columns
        },
      ],
    },
  ],
};
```

## Architecture

The FormRenderer is built on top of:

- **react-hook-form**: For form state management and validation
- **@objectstack/spec**: For schema definitions

## Customization

You can customize the appearance of the form by:

1. Using the `className` prop on the FormRenderer
2. Using Tailwind CSS classes in your application
3. Extending the FieldFactory component for custom widgets

## Related Components

- `FieldFactory`: Renders individual form fields based on widget type
- `SchemaRenderer`: General-purpose schema renderer for ObjectUI

## License

MIT

## Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
