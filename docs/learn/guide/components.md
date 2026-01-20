---
title: "Components"
---

Object UI provides a comprehensive set of pre-built components that implement common UI patterns. All components are built with **Shadcn UI** and **Tailwind CSS** for maximum flexibility and customization.

## Overview

The `@object-ui/components` package includes:

- **50+ components** covering forms, data display, layout, and feedback
- **Tailwind-native** - fully customizable with Tailwind classes
- **Accessible** - WCAG compliant, keyboard navigation, ARIA labels
- **Type-safe** - Full TypeScript support
- **Themeable** - Dark mode and custom themes
- **Responsive** - Mobile-first design

## Installation

```bash
npm install @object-ui/components @object-ui/react @object-ui/core
```

**Peer Dependencies:**
```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "tailwindcss": "^3.0.0"
}
```

## Setup

### 1. Configure Tailwind

Add Object UI components to your Tailwind content:

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 2. Import Styles

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@object-ui/components/dist/style.css';
```

### 3. Register Components

```tsx
// src/main.tsx or src/App.tsx
import { registerDefaultRenderers } from '@object-ui/components'

// Register all components once
registerDefaultRenderers()
```

## Usage

### With SchemaRenderer

The primary way to use components is through schemas:

```tsx
import { SchemaRenderer } from '@object-ui/react'

const schema = {
  type: 'card',
  title: 'User Profile',
  className: 'max-w-md',
  body: {
    type: 'flex',
    direction: 'column',
    gap: 4,
    children: [
      {
        type: 'input',
        name: 'name',
        label: 'Full Name',
        placeholder: 'Enter your name'
      },
      {
        type: 'input',
        name: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'you@example.com'
      },
      {
        type: 'button',
        label: 'Save',
        variant: 'default'
      }
    ]
  }
}

function App() {
  return <SchemaRenderer schema={schema} />
}
```

### Direct Import

You can also import and use components directly:

```tsx
import { Button, Input, Card } from '@object-ui/components'

function MyForm() {
  return (
    <Card className="max-w-md">
      <Input placeholder="Enter name" />
      <Button>Submit</Button>
    </Card>
  )
}
```

## Component Categories

### Form Components

Components for user input and data entry.

#### Input

Text input field with validation support.

```json
{
  "type": "input",
  "name": "username",
  "label": "Username",
  "placeholder": "Enter username",
  "required": true,
  "className": "w-full"
}
```

**Props:**
- `name` - Field name
- `label` - Field label
- `placeholder` - Placeholder text
- `type` - Input type (text, email, password, number, etc.)
- `required` - Required field
- `disabled` - Disabled state
- `value` - Field value
- `onChange` - Change handler

---

#### Textarea

Multi-line text input.

```json
{
  "type": "textarea",
  "name": "description",
  "label": "Description",
  "placeholder": "Enter description...",
  "rows": 4
}
```

**Props:**
- `name`, `label`, `placeholder`, `required`, `disabled`
- `rows` - Number of visible rows
- `maxLength` - Maximum character count

---

#### Select

Dropdown selection.

```json
{
  "type": "select",
  "name": "country",
  "label": "Country",
  "options": [
    { "value": "us", "label": "United States" },
    { "value": "uk", "label": "United Kingdom" },
    { "value": "ca", "label": "Canada" }
  ]
}
```

**Props:**
- `name`, `label`, `required`, `disabled`
- `options` - Array of `{ value, label }` objects
- `placeholder` - Placeholder text
- `multiple` - Allow multiple selections

---

#### Checkbox

Checkbox input for boolean values.

```json
{
  "type": "checkbox",
  "name": "terms",
  "label": "I agree to the terms and conditions",
  "required": true
}
```

**Props:**
- `name`, `label`, `required`, `disabled`
- `checked` - Checked state
- `onChange` - Change handler

---

#### Radio

Radio button for single selection from a group.

```json
{
  "type": "radio",
  "name": "plan",
  "label": "Select Plan",
  "options": [
    { "value": "free", "label": "Free" },
    { "value": "pro", "label": "Pro" },
    { "value": "enterprise", "label": "Enterprise" }
  ]
}
```

---

#### Switch

Toggle switch for boolean values.

```json
{
  "type": "switch",
  "name": "notifications",
  "label": "Enable Notifications"
}
```

---

#### Date Picker

Date selection component.

```json
{
  "type": "date-picker",
  "name": "birthdate",
  "label": "Birth Date",
  "format": "MM/DD/YYYY"
}
```

**Props:**
- `name`, `label`, `required`, `disabled`
- `format` - Date format string
- `minDate` - Minimum selectable date
- `maxDate` - Maximum selectable date

---

### Layout Components

Components for structuring page layouts.

#### Container

Generic container with optional max-width.

```json
{
  "type": "container",
  "maxWidth": "lg",
  "className": "py-8",
  "children": [...]
}
```

**Props:**
- `maxWidth` - Max width (sm, md, lg, xl, 2xl, full)
- `padding` - Padding size
- `children` - Child elements

---

#### Grid

CSS Grid layout.

```json
{
  "type": "grid",
  "cols": 3,
  "gap": 4,
  "children": [
    { "type": "card", "title": "Card 1" },
    { "type": "card", "title": "Card 2" },
    { "type": "card", "title": "Card 3" }
  ]
}
```

**Props:**
- `cols` - Number of columns (1-12)
- `gap` - Gap between items
- `responsive` - Responsive breakpoints
- `children` - Grid items

---

#### Flex

Flexbox layout.

```json
{
  "type": "flex",
  "direction": "row",
  "justify": "between",
  "align": "center",
  "gap": 4,
  "children": [...]
}
```

**Props:**
- `direction` - Flex direction (row, column)
- `justify` - Justify content (start, center, end, between, around)
- `align` - Align items (start, center, end, stretch)
- `gap` - Gap between items
- `wrap` - Flex wrap

---

#### Card

Card container with optional header and footer.

```json
{
  "type": "card",
  "title": "Card Title",
  "description": "Card description",
  "body": { ... },
  "footer": { ... }
}
```

**Props:**
- `title` - Card title
- `description` - Card description
- `body` - Card body content
- `footer` - Card footer content
- `variant` - Card variant (default, outline)

---

#### Tabs

Tab navigation container.

```json
{
  "type": "tabs",
  "defaultTab": "profile",
  "tabs": [
    {
      "id": "profile",
      "label": "Profile",
      "content": { ... }
    },
    {
      "id": "settings",
      "label": "Settings",
      "content": { ... }
    }
  ]
}
```

**Props:**
- `tabs` - Array of tab objects
- `defaultTab` - Default active tab ID
- `onChange` - Tab change handler

---

#### Accordion

Collapsible sections.

```json
{
  "type": "accordion",
  "items": [
    {
      "title": "Section 1",
      "content": "Content for section 1"
    },
    {
      "title": "Section 2",
      "content": "Content for section 2"
    }
  ]
}
```

**Props:**
- `items` - Array of accordion items
- `type` - Accordion type (single, multiple)
- `defaultOpen` - Default open item(s)

---

### Data Display

Components for displaying data and content.

#### Table

Data table with sorting and pagination.

```json
{
  "type": "table",
  "data": [
    { "id": 1, "name": "John", "email": "john@example.com" },
    { "id": 2, "name": "Jane", "email": "jane@example.com" }
  ],
  "columns": [
    { "key": "name", "label": "Name", "sortable": true },
    { "key": "email", "label": "Email" }
  ]
}
```

**Props:**
- `data` - Array of data objects
- `columns` - Column definitions
- `sortable` - Enable sorting
- `pagination` - Enable pagination
- `pageSize` - Items per page

---

#### List

Vertical list of items.

```json
{
  "type": "list",
  "items": [
    { "title": "Item 1", "description": "Description 1" },
    { "title": "Item 2", "description": "Description 2" }
  ]
}
```

**Props:**
- `items` - Array of list items
- `divider` - Show dividers between items
- `hoverable` - Highlight on hover

---

#### Badge

Small badge for labels and counts.

```json
{
  "type": "badge",
  "label": "New",
  "variant": "default"
}
```

**Props:**
- `label` - Badge text
- `variant` - Badge style (default, secondary, destructive, outline)

---

#### Avatar

User avatar component.

```json
{
  "type": "avatar",
  "src": "https://example.com/avatar.jpg",
  "alt": "User Name",
  "fallback": "UN"
}
```

**Props:**
- `src` - Image URL
- `alt` - Alt text
- `fallback` - Fallback text (initials)
- `size` - Avatar size (sm, md, lg)

---

#### Progress

Progress bar.

```json
{
  "type": "progress",
  "value": 60,
  "max": 100,
  "label": "60% Complete"
}
```

**Props:**
- `value` - Current value
- `max` - Maximum value
- `label` - Progress label
- `variant` - Progress variant

---

### Feedback

Components for user feedback and notifications.

#### Alert

Alert messages.

```json
{
  "type": "alert",
  "variant": "info",
  "title": "Information",
  "message": "This is an informational message."
}
```

**Props:**
- `variant` - Alert type (info, success, warning, error)
- `title` - Alert title
- `message` - Alert message
- `dismissible` - Can be dismissed

---

#### Dialog

Modal dialog.

```json
{
  "type": "dialog",
  "title": "Confirm Action",
  "description": "Are you sure you want to proceed?",
  "content": { ... },
  "actions": [
    { "type": "button", "label": "Cancel", "variant": "outline" },
    { "type": "button", "label": "Confirm", "variant": "default" }
  ]
}
```

**Props:**
- `title` - Dialog title
- `description` - Dialog description
- `content` - Dialog content
- `actions` - Action buttons
- `open` - Open state
- `onClose` - Close handler

---

#### Toast

Toast notifications (requires ToastProvider).

```tsx
import { toast } from '@object-ui/components'

toast({
  title: "Success",
  description: "Your changes have been saved.",
  variant: "success"
})
```

---

#### Popover

Popover overlay.

```json
{
  "type": "popover",
  "trigger": {
    "type": "button",
    "label": "Open Popover"
  },
  "content": {
    "type": "text",
    "value": "Popover content"
  }
}
```

---

### Navigation

Components for navigation and actions.

#### Button

Button component.

```json
{
  "type": "button",
  "label": "Click Me",
  "variant": "default",
  "size": "md",
  "disabled": false
}
```

**Props:**
- `label` - Button text
- `variant` - Button style (default, destructive, outline, secondary, ghost, link)
- `size` - Button size (sm, md, lg)
- `disabled` - Disabled state
- `onClick` - Click handler
- `type` - Button type (button, submit, reset)

---

#### Link

Link component.

```json
{
  "type": "link",
  "href": "/about",
  "label": "About Us",
  "external": false
}
```

**Props:**
- `href` - Link URL
- `label` - Link text
- `external` - Open in new tab
- `variant` - Link style

---

#### Breadcrumb

Breadcrumb navigation.

```json
{
  "type": "breadcrumb",
  "items": [
    { "label": "Home", "href": "/" },
    { "label": "Products", "href": "/products" },
    { "label": "Item", "href": "/products/item" }
  ]
}
```

---

## Customization

### Using Tailwind Classes

All components accept `className` for custom styling:

```json
{
  "type": "button",
  "label": "Custom Button",
  "className": "bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full"
}
```

### Custom Components

Override built-in components with your own:

```tsx
import { getComponentRegistry } from '@object-ui/react'
import { Button } from '@object-ui/components'

function CustomButton(props) {
  return (
    <Button
      {...props}
      className={`my-custom-class ${props.className || ''}`}
    />
  )
}

const registry = getComponentRegistry()
registry.register('button', CustomButton)
```

### Theming

Use Tailwind's theme configuration for global theming:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
}
```

Then use in components:

```json
{
  "type": "button",
  "label": "Primary Button",
  "className": "bg-primary-500 hover:bg-primary-600"
}
```

## Best Practices

### 1. Use Semantic Types

Choose the right component for the job:
- Use `input` for text, not `textarea` for single lines
- Use `select` for many options, `radio` for few options
- Use `dialog` for important actions, `popover` for supplementary info

### 2. Follow Accessibility Guidelines

- Always provide `label` for form fields
- Use `aria-label` for icon-only buttons
- Ensure proper heading hierarchy
- Test keyboard navigation

### 3. Keep Schemas Readable

Break complex schemas into smaller pieces:

```tsx
const formSchema = {
  type: 'form',
  children: [
    personalInfoSection,
    addressSection,
    preferencesSection
  ]
}
```

### 4. Leverage Composition

Compose complex UIs from simple components:

```json
{
  "type": "card",
  "body": {
    "type": "flex",
    "direction": "column",
    "gap": 4,
    "children": [
      { "type": "input", ... },
      { "type": "select", ... },
      { "type": "button", ... }
    ]
  }
}
```

### 5. Use Type Definitions

Leverage TypeScript for type safety:

```tsx
import type { ButtonSchema, InputSchema } from '@object-ui/types'

const button: ButtonSchema = {
  type: 'button',
  label: 'Submit',
  variant: 'default'
}
```

## Examples

### Login Form

```tsx
const loginForm = {
  type: 'card',
  className: 'max-w-md mx-auto mt-8',
  title: 'Welcome Back',
  description: 'Sign in to your account',
  body: {
    type: 'flex',
    direction: 'column',
    gap: 4,
    children: [
      {
        type: 'input',
        name: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'you@example.com',
        required: true
      },
      {
        type: 'input',
        name: 'password',
        label: 'Password',
        type: 'password',
        required: true
      },
      {
        type: 'checkbox',
        name: 'remember',
        label: 'Remember me'
      },
      {
        type: 'button',
        label: 'Sign In',
        variant: 'default',
        className: 'w-full'
      }
    ]
  }
}
```

### Dashboard Stats

```tsx
const stats = {
  type: 'grid',
  cols: 3,
  gap: 4,
  children: [
    {
      type: 'card',
      title: 'Total Users',
      body: {
        type: 'text',
        value: '1,234',
        className: 'text-3xl font-bold'
      }
    },
    {
      type: 'card',
      title: 'Revenue',
      body: {
        type: 'text',
        value: '$12,345',
        className: 'text-3xl font-bold text-green-600'
      }
    },
    {
      type: 'card',
      title: 'Active Projects',
      body: {
        type: 'text',
        value: '42',
        className: 'text-3xl font-bold'
      }
    }
  ]
}
```

### Data Table

```tsx
const userTable = {
  type: 'table',
  data: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' }
  ],
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', sortable: true }
  ],
  pagination: true,
  pageSize: 10
}
```

## Related Documentation

- [Component Registry](./component-registry.md) - Registering components
- [Schema Rendering](./schema-rendering.md) - How schemas work
- [Plugins](./plugins.md) - Extending with plugins
- [API Reference](/api/components.md) - Full API documentation

## Next Steps

1. Explore the [Component Registry](./component-registry.md)
2. Learn about [Plugins](./plugins.md) for extended functionality
3. Check out [Schema Rendering](./schema-rendering.md) for advanced patterns
4. Build your first form with Object UI
