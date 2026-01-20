---
title: "Object UI Best Practices"
---

This guide covers best practices for building applications with Object UI's JSON-driven approach.

## Table of Contents

- [Schema Design](#schema-design)
- [Performance](#performance)
- [Type Safety](#type-safety)
- [Maintainability](#maintainability)
- [API Integration](#api-integration)
- [Security](#security)
- [Testing](#testing)
- [Accessibility](#accessibility)

## Schema Design

### 1. Keep Schemas Modular and Reusable

**❌ Bad:**
```json
{
  "type": "div",
  "body": [
    {
      "type": "card",
      "title": "User 1",
      "body": [
        { "type": "text", "content": "Name: John" },
        { "type": "text", "content": "Email: john@example.com" }
      ]
    },
    {
      "type": "card",
      "title": "User 2",
      "body": [
        { "type": "text", "content": "Name: Jane" },
        { "type": "text", "content": "Email": "jane@example.com" }
      ]
    }
  ]
}
```

**✅ Good:**
```json
{
  "type": "div",
  "dataSource": {
    "api": "/api/users"
  },
  "body": {
    "type": "grid",
    "columns": 2,
    "children": "${data.map(user => ({ type: 'card', title: user.name, body: [{ type: 'text', content: user.email }] }))}"
  }
}
```

### 2. Use Semantic Types

Choose the most appropriate component type for your content.

**❌ Bad:**
```json
{
  "type": "div",
  "className": "border p-4",
  "body": "This is a warning"
}
```

**✅ Good:**
```json
{
  "type": "alert",
  "variant": "warning",
  "description": "This is a warning"
}
```

### 3. Leverage Conditional Rendering

Use `visibleOn`, `hiddenOn`, and `disabledOn` for dynamic UIs.

**✅ Good:**
```json
{
  "type": "button",
  "label": "Delete",
  "variant": "destructive",
  "visibleOn": "${user.role === 'admin'}",
  "disabledOn": "${item.status === 'locked'}"
}
```

### 4. Structure Complex Forms Logically

Group related fields and use clear labels.

**✅ Good:**
```json
{
  "type": "form",
  "fields": [
    {
      "name": "personalInfo",
      "type": "group",
      "label": "Personal Information",
      "fields": [
        { "name": "firstName", "type": "input", "label": "First Name" },
        { "name": "lastName", "type": "input", "label": "Last Name" }
      ]
    },
    {
      "name": "contactInfo",
      "type": "group",
      "label": "Contact Information",
      "fields": [
        { "name": "email", "type": "input", "inputType": "email", "label": "Email" },
        { "name": "phone", "type": "input", "inputType": "tel", "label": "Phone" }
      ]
    }
  ]
}
```

## Performance

### 1. Use Data Fetching Wisely

**❌ Bad** - Fetch data in every component:
```json
{
  "type": "div",
  "body": [
    {
      "type": "card",
      "dataSource": { "api": "/api/stats" },
      "body": "..."
    },
    {
      "type": "card",
      "dataSource": { "api": "/api/stats" },
      "body": "..."
    }
  ]
}
```

**✅ Good** - Fetch once at parent level:
```json
{
  "type": "div",
  "dataSource": { "api": "/api/stats" },
  "body": [
    {
      "type": "card",
      "body": "${data.users}"
    },
    {
      "type": "card",
      "body": "${data.orders}"
    }
  ]
}
```

### 2. Enable Caching for Static Data

```json
{
  "dataSource": {
    "api": "/api/countries",
    "cache": {
      "key": "countries-list",
      "duration": 3600000,
      "staleWhileRevalidate": true
    }
  }
}
```

### 3. Use Pagination for Large Lists

```json
{
  "type": "crud",
  "api": "/api/users",
  "pagination": {
    "enabled": true,
    "pageSize": 20,
    "pageSizeOptions": [10, 20, 50]
  }
}
```

### 4. Optimize Polling Intervals

```json
{
  "dataSource": {
    "api": "/api/dashboard/stats",
    "pollInterval": 30000,
    "fetchOnMount": true
  }
}
```

## Type Safety

### 1. Use TypeScript for Schema Generation

**✅ Good:**
```typescript
import { FormBuilder, input } from '@object-ui/core/builder';

const loginForm = new FormBuilder()
  .field({
    name: 'email',
    type: 'input',
    inputType: 'email',
    required: true
  })
  .field({
    name: 'password',
    type: 'input',
    inputType: 'password',
    required: true
  })
  .submitLabel('Login')
  .build();
```

### 2. Validate Schemas Before Runtime

```typescript
import { validateSchema, assertValidSchema } from '@object-ui/core/validation';

// Validate and get detailed errors
const result = validateSchema(schema);
if (!result.valid) {
  console.error('Schema errors:', result.errors);
}

// Or assert and throw on error
assertValidSchema(schema);
```

### 3. Use Schema Version for Compatibility

```json
{
  "$schema": "https://objectui.org/schema/v1",
  "type": "page",
  "body": [...]
}
```

## Maintainability

### 1. Use Descriptive IDs and Test IDs

**✅ Good:**
```json
{
  "type": "button",
  "id": "submit-login-button",
  "testId": "login-submit",
  "label": "Login"
}
```

### 2. Document Complex Expressions

```json
{
  "type": "text",
  "content": "${data.users.filter(u => u.active && u.verified).length}",
  "description": "Count of active and verified users"
}
```

### 3. Use Constants for Repeated Values

Instead of:
```json
{
  "api": "/api/v1/users",
  "operations": {
    "create": { "api": "/api/v1/users" },
    "update": { "api": "/api/v1/users/${id}" }
  }
}
```

Use environment variables or configuration:
```json
{
  "api": "${env.API_BASE}/users",
  "operations": {
    "create": { "api": "${env.API_BASE}/users" },
    "update": { "api": "${env.API_BASE}/users/${id}" }
  }
}
```

### 4. Organize Large Schemas

Split large schemas into multiple files:

```typescript
// schemas/users/list.json
// schemas/users/form.json
// schemas/users/detail.json

import userList from './schemas/users/list.json';
import userForm from './schemas/users/form.json';
```

## API Integration

### 1. Always Handle Errors

**✅ Good:**
```json
{
  "onClick": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/action",
        "method": "POST"
      },
      "successMessage": "Action completed successfully!",
      "errorMessage": "Failed to complete action. Please try again.",
      "showLoading": true
    }
  }
}
```

### 2. Use Confirmation for Destructive Actions

**✅ Good:**
```json
{
  "type": "action",
  "label": "Delete",
  "level": "danger",
  "confirmText": "Are you sure you want to delete this item? This action cannot be undone.",
  "api": "/api/items/${id}",
  "method": "DELETE"
}
```

### 3. Provide User Feedback

```json
{
  "api": {
    "request": {
      "url": "/api/save",
      "method": "POST"
    },
    "showLoading": true,
    "successMessage": "Changes saved successfully!",
    "errorMessage": "Failed to save changes",
    "reload": true
  }
}
```

### 4. Transform Data at the Source

**✅ Good:**
```json
{
  "dataSource": {
    "api": "/api/products",
    "transform": "data => data.products.map(p => ({ ...p, displayName: `${p.name} (${p.sku})` }))"
  }
}
```

## Security

### 1. Never Expose Sensitive Data in Schemas

**❌ Bad:**
```json
{
  "api": {
    "url": "/api/users",
    "headers": {
      "Authorization": "******"
    }
  }
}
```

**✅ Good:**
```json
{
  "api": {
    "url": "/api/users",
    "headers": {
      "Authorization": "${env.API_TOKEN}"
    }
  }
}
```

### 2. Validate User Input

```json
{
  "name": "email",
  "type": "input",
  "inputType": "email",
  "required": true,
  "validation": {
    "pattern": {
      "value": "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
      "message": "Please enter a valid email address"
    }
  }
}
```

### 3. Use HTTPS for APIs

```json
{
  "api": "https://api.example.com/data"
}
```

### 4. Sanitize Dynamic Content

When displaying user-generated content, use appropriate sanitization.

## Testing

### 1. Use Test IDs for E2E Tests

```json
{
  "type": "button",
  "testId": "submit-form",
  "label": "Submit"
}
```

Then in tests:
```typescript
await page.getByTestId('submit-form').click();
```

### 2. Validate Schemas in Tests

```typescript
import { validateSchema } from '@object-ui/core/validation';

test('schema is valid', () => {
  const result = validateSchema(mySchema);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

### 3. Test Dynamic Expressions

```typescript
test('expression evaluates correctly', () => {
  const schema = {
    type: 'text',
    content: '${user.name}'
  };
  
  const context = { user: { name: 'John' } };
  const result = evaluateExpression(schema.content, context);
  expect(result).toBe('John');
});
```

## Accessibility

### 1. Use Semantic HTML and ARIA Labels

**✅ Good:**
```json
{
  "type": "button",
  "label": "Close",
  "ariaLabel": "Close dialog",
  "icon": "x"
}
```

### 2. Provide Alternative Text for Images

```json
{
  "type": "image",
  "src": "/logo.png",
  "alt": "Company Logo"
}
```

### 3. Ensure Keyboard Navigation

```json
{
  "type": "dialog",
  "closeOnEscape": true,
  "showClose": true
}
```

### 4. Use Appropriate Color Contrast

Use Tailwind's semantic color classes for proper contrast:

```json
{
  "type": "button",
  "className": "bg-primary text-primary-foreground"
}
```

## Common Patterns

### Dashboard Card

```json
{
  "type": "card",
  "className": "shadow-lg",
  "body": [
    {
      "type": "flex",
      "justify": "between",
      "align": "start",
      "body": [
        {
          "type": "div",
          "body": [
            {
              "type": "text",
              "content": "Total Users",
              "className": "text-sm font-medium text-muted-foreground"
            },
            {
              "type": "text",
              "content": "${data.userCount}",
              "className": "text-3xl font-bold"
            }
          ]
        },
        {
          "type": "icon",
          "name": "users",
          "className": "text-muted-foreground"
        }
      ]
    }
  ]
}
```

### Data Table with Actions

```json
{
  "type": "crud",
  "resource": "user",
  "api": "/api/users",
  "columns": [...],
  "rowActions": [
    {
      "type": "action",
      "label": "Edit",
      "icon": "edit"
    },
    {
      "type": "action",
      "label": "Delete",
      "icon": "trash",
      "level": "danger",
      "confirmText": "Delete this user?"
    }
  ]
}
```

### Multi-Step Form

```json
{
  "type": "tabs",
  "items": [
    {
      "value": "step1",
      "label": "Personal Info",
      "content": {
        "type": "form",
        "fields": [...]
      }
    },
    {
      "value": "step2",
      "label": "Contact Info",
      "content": {
        "type": "form",
        "fields": [...]
      }
    }
  ]
}
```

## Summary

- ✅ Keep schemas modular and reusable
- ✅ Use semantic component types
- ✅ Leverage conditional rendering
- ✅ Optimize data fetching and caching
- ✅ Use TypeScript for type safety
- ✅ Validate schemas before runtime
- ✅ Handle errors gracefully
- ✅ Never expose sensitive data
- ✅ Add test IDs for testing
- ✅ Follow accessibility guidelines

Following these best practices will help you build maintainable, performant, and accessible applications with Object UI.
