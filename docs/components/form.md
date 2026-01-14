# Form Component

The `form` component is an Airtable-style feature-complete form with validation, multi-column layout, and conditional fields. It integrates with `react-hook-form` for powerful form state management and validation.

## Features

- **Field Validation**: Built-in validation with custom error messages
- **Conditional Fields**: Show/hide fields based on other field values
- **Multi-Column Layout**: Responsive grid layout (1-4 columns)
- **Multiple Field Types**: Input, textarea, select, checkbox, and more
- **Form State Management**: Powered by react-hook-form
- **Loading States**: Built-in loading indicators during submission
- **Error Handling**: Display validation errors and submission errors
- **Default Values**: Pre-populate form fields
- **Reset Functionality**: Reset form to initial state or defaults

## Basic Usage

```json
{
  "type": "form",
  "submitLabel": "Submit",
  "fields": [
    {
      "name": "username",
      "label": "Username",
      "type": "input",
      "required": true,
      "placeholder": "Enter your username"
    },
    {
      "name": "email",
      "label": "Email",
      "type": "input",
      "inputType": "email",
      "required": true,
      "placeholder": "your.email@example.com"
    }
  ]
}
```

## Properties

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| `fields` | `array` | `[]` | Array of field configurations |
| `defaultValues` | `object` | `{}` | Default values for form fields |
| `submitLabel` | `string` | `'Submit'` | Submit button label |
| `cancelLabel` | `string` | `'Cancel'` | Cancel/Reset button label |
| `showCancel` | `boolean` | `false` | Show cancel/reset button |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | Form layout direction |
| `columns` | `number` | `1` | Number of columns for field layout (1-4) |
| `validationMode` | `string` | `'onSubmit'` | When to validate: `onSubmit`, `onBlur`, `onChange`, `onTouched`, `all` |
| `resetOnSubmit` | `boolean` | `false` | Reset form after successful submission |
| `disabled` | `boolean` | `false` | Disable entire form |
| `showActions` | `boolean` | `true` | Show submit/cancel buttons |
| `className` | `string` | - | Additional CSS classes for form |
| `fieldContainerClass` | `string` | - | CSS classes for field container |

## Field Configuration

Each field in the `fields` array can have the following properties:

| Property | Type | Description |
|:---|:---|:---|
| `name` | `string` | **Required**. Field identifier (used for form data) |
| `label` | `string` | Field label displayed above the input |
| `type` | `string` | Field type: `input`, `textarea`, `select`, `checkbox` |
| `inputType` | `string` | HTML input type for `input` fields: `text`, `email`, `password`, `number`, `date`, etc. |
| `required` | `boolean` | Whether the field is required |
| `disabled` | `boolean` | Disable this specific field |
| `placeholder` | `string` | Placeholder text |
| `description` | `string` | Help text displayed below the field |
| `options` | `array` | Options for `select` fields: `[{label, value}]` |
| `validation` | `object` | Validation rules (see Validation section) |
| `condition` | `object` | Conditional rendering rules (see Conditional Fields section) |

## Validation

The `validation` object supports various rules:

```json
{
  "name": "projectName",
  "label": "Project Name",
  "type": "input",
  "required": true,
  "validation": {
    "minLength": {
      "value": 3,
      "message": "Project name must be at least 3 characters"
    },
    "maxLength": {
      "value": 50,
      "message": "Project name must not exceed 50 characters"
    },
    "pattern": {
      "value": "/^[a-zA-Z0-9\\s]+$/",
      "message": "Only letters, numbers, and spaces allowed"
    }
  }
}
```

### Available Validation Rules

- `required`: `string | boolean` - Error message or true
- `minLength`: `{value: number, message: string}` - Minimum length
- `maxLength`: `{value: number, message: string}` - Maximum length
- `min`: `{value: number, message: string}` - Minimum value (for numbers)
- `max`: `{value: number, message: string}` - Maximum value (for numbers)
- `pattern`: `{value: string | RegExp, message: string}` - Regex pattern (string format: "/pattern/" or raw regex)
- `validate`: Custom validation function

**Note**: For `pattern` validation, you can provide either a regex string (e.g., "/^[a-z]+$/") or a raw regex string without delimiters (e.g., "^[a-z]+$"). React Hook Form will handle the conversion internally.

## Conditional Fields

Show or hide fields based on other field values:

```json
{
  "name": "teamSize",
  "label": "Team Size",
  "type": "input",
  "inputType": "number",
  "condition": {
    "field": "projectType",
    "in": ["team", "enterprise"]
  }
}
```

### Condition Types

- `equals`: Show when field equals specific value
  ```json
  {"field": "projectType", "equals": "enterprise"}
  ```

- `notEquals`: Show when field doesn't equal specific value
  ```json
  {"field": "status", "notEquals": "completed"}
  ```

- `in`: Show when field is in array of values
  ```json
  {"field": "priority", "in": ["high", "critical"]}
  ```

## Multi-Column Layout

Create responsive multi-column forms:

```json
{
  "type": "form",
  "columns": 2,
  "fields": [
    {
      "name": "firstName",
      "label": "First Name",
      "type": "input"
    },
    {
      "name": "lastName",
      "label": "Last Name",
      "type": "input"
    }
  ]
}
```

The `columns` property creates a responsive grid:
- `1`: Single column (default)
- `2`: Two columns on medium screens and up
- `3`: Three columns on medium screens and up
- `4`: Four columns on medium screens and up

## Complete Example

```json
{
  "type": "form",
  "submitLabel": "Create Project",
  "cancelLabel": "Reset",
  "showCancel": true,
  "columns": 2,
  "validationMode": "onBlur",
  "defaultValues": {
    "projectType": "personal",
    "priority": "medium",
    "notifications": true
  },
  "fields": [
    {
      "name": "projectName",
      "label": "Project Name",
      "type": "input",
      "required": true,
      "placeholder": "Enter project name",
      "validation": {
        "minLength": {
          "value": 3,
          "message": "Project name must be at least 3 characters"
        }
      }
    },
    {
      "name": "projectType",
      "label": "Project Type",
      "type": "select",
      "required": true,
      "options": [
        {"label": "Personal", "value": "personal"},
        {"label": "Team", "value": "team"},
        {"label": "Enterprise", "value": "enterprise"}
      ]
    },
    {
      "name": "teamSize",
      "label": "Team Size",
      "type": "input",
      "inputType": "number",
      "placeholder": "Number of team members",
      "condition": {
        "field": "projectType",
        "in": ["team", "enterprise"]
      },
      "validation": {
        "min": {
          "value": 2,
          "message": "Team must have at least 2 members"
        }
      }
    },
    {
      "name": "priority",
      "label": "Priority Level",
      "type": "select",
      "required": true,
      "options": [
        {"label": "Low", "value": "low"},
        {"label": "Medium", "value": "medium"},
        {"label": "High", "value": "high"},
        {"label": "Critical", "value": "critical"}
      ]
    },
    {
      "name": "deadline",
      "label": "Deadline",
      "type": "input",
      "inputType": "date",
      "condition": {
        "field": "priority",
        "in": ["high", "critical"]
      }
    },
    {
      "name": "description",
      "label": "Project Description",
      "type": "textarea",
      "placeholder": "Describe your project goals",
      "validation": {
        "maxLength": {
          "value": 500,
          "message": "Description must not exceed 500 characters"
        }
      }
    },
    {
      "name": "notifications",
      "label": "Enable Notifications",
      "type": "checkbox",
      "description": "Receive updates about project progress"
    }
  ]
}
```

## Form Submission

Handle form submission using the `onAction` callback:

```jsx
import { SchemaRenderer } from '@object-ui/react';

function MyForm() {
  const handleAction = (action) => {
    if (action.type === 'form_submit') {
      console.log('Form submitted:', action.formData);
      // Handle submission (e.g., API call)
      
      // Return error if submission fails
      // return { error: 'Submission failed' };
    }
    
    if (action.type === 'form_change') {
      console.log('Form changed:', action.formData);
    }
    
    if (action.type === 'form_cancel') {
      console.log('Form cancelled');
    }
  };

  return (
    <SchemaRenderer
      schema={formSchema}
      onAction={handleAction}
    />
  );
}
```

## Field Types

### Input
Standard text input with support for various HTML5 input types.

```json
{
  "name": "email",
  "label": "Email",
  "type": "input",
  "inputType": "email",
  "placeholder": "your.email@example.com"
}
```

### Textarea
Multi-line text input for longer content.

```json
{
  "name": "description",
  "label": "Description",
  "type": "textarea",
  "placeholder": "Enter description..."
}
```

### Select
Dropdown selection from predefined options.

```json
{
  "name": "country",
  "label": "Country",
  "type": "select",
  "options": [
    {"label": "United States", "value": "us"},
    {"label": "Canada", "value": "ca"},
    {"label": "United Kingdom", "value": "uk"}
  ]
}
```

### Checkbox
Boolean toggle with label and description.

```json
{
  "name": "terms",
  "label": "I accept the terms and conditions",
  "type": "checkbox",
  "description": "Please read our terms before accepting"
}
```

## Styling

The form component uses Tailwind CSS classes and integrates with the Shadcn UI design system. You can customize the appearance using:

- `className`: Add classes to the form element
- `fieldContainerClass`: Add classes to the fields container
- Individual field properties can't be styled directly, but the component follows the design system

## Best Practices

1. **Use Clear Labels**: Make field labels descriptive and user-friendly
2. **Provide Helpful Placeholders**: Show examples of expected input
3. **Add Descriptions**: Use field descriptions for additional context
4. **Validate Early**: Use `validationMode: "onBlur"` for better UX
5. **Group Related Fields**: Use multi-column layout to group related fields
6. **Handle Errors Gracefully**: Provide clear, actionable error messages
7. **Set Appropriate Default Values**: Pre-fill common choices
8. **Use Conditional Logic**: Show only relevant fields to reduce cognitive load
9. **Test Validation Rules**: Ensure validation messages are helpful

## Accessibility

The form component includes built-in accessibility features:

- Proper label associations with `htmlFor`
- ARIA attributes for error messages
- Keyboard navigation support
- Screen reader friendly error announcements
- Focus management

## Related Components

- [Calendar View](./calendar-view.md) - For date-based data visualization
- Individual form field components (`input`, `select`, `checkbox`, etc.)
