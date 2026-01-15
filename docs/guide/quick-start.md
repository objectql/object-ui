# Quick Start

Get up and running with Object UI in less than 5 minutes.

## Installation

Install Object UI packages using your preferred package manager:

::: code-group

```bash [npm]
npm install @object-ui/react @object-ui/components
```

```bash [yarn]
yarn add @object-ui/react @object-ui/components
```

```bash [pnpm]
pnpm add @object-ui/react @object-ui/components
```

:::

## Your First Component

Create a simple form with Object UI:

```tsx
import React from 'react'
import { SchemaRenderer } from '@object-ui/react'
import { registerDefaultRenderers } from '@object-ui/components'

// Register the default components
registerDefaultRenderers()

const schema = {
  type: "form",
  title: "Contact Form",
  body: [
    {
      type: "input",
      name: "name",
      label: "Your Name",
      required: true
    },
    {
      type: "input",
      name: "email",
      label: "Email",
      inputType: "email",
      required: true
    },
    {
      type: "textarea",
      name: "message",
      label: "Message",
      rows: 4
    }
  ],
  actions: [
    {
      type: "submit",
      label: "Send Message",
      level: "primary"
    }
  ]
}

function App() {
  const handleSubmit = (data) => {
    console.log('Form submitted:', data)
  }

  return (
    <SchemaRenderer 
      schema={schema}
      onSubmit={handleSubmit}
    />
  )
}

export default App
```

That's it! You now have a fully functional, validated form with professional styling.

## Add Data

Pass data to your components using the `data` prop:

```tsx
const data = {
  user: {
    name: 'John Doe',
    email: 'john@example.com'
  }
}

<SchemaRenderer 
  schema={schema}
  data={data}
/>
```

Reference data in your schema using expressions:

```json
{
  "type": "text",
  "value": "${user.name}"
}
```

## Conditional Rendering

Show/hide components based on conditions:

```json
{
  "type": "alert",
  "message": "Welcome, Admin!",
  "visibleOn": "${user.role === 'admin'}"
}
```

## API Integration

Connect to your backend API:

```tsx
const schema = {
  type: "crud",
  api: {
    list: "/api/users",
    create: "/api/users",
    update: "/api/users/${id}",
    delete: "/api/users/${id}"
  },
  columns: [
    { name: "name", label: "Name" },
    { name: "email", label: "Email" },
    { name: "role", label: "Role" }
  ]
}
```

Object UI automatically handles:
- Data fetching and caching
- Pagination
- Sorting and filtering
- CRUD operations
- Loading and error states

## Styling

Customize styles using Tailwind classes:

```json
{
  "type": "card",
  "className": "p-6 shadow-lg rounded-xl bg-gradient-to-r from-blue-500 to-purple-500",
  "body": {
    "type": "text",
    "value": "Beautiful Card",
    "className": "text-white text-2xl font-bold"
  }
}
```

## Next Steps

Now that you have the basics:

- [Installation Guide](/guide/installation) - Detailed setup instructions
- [Schema Rendering](/guide/schema-rendering) - Learn the core concepts
- [Component Registry](/guide/component-registry) - Understand component registration
- [Expression System](/guide/expressions) - Master dynamic expressions

## Examples

Check out our JSON-based examples that you can run immediately:

- [Basic Form](https://github.com/objectql/objectui/tree/main/examples/basic-form) - Contact form with validation
- [Dashboard](https://github.com/objectql/objectui/tree/main/examples/dashboard) - Analytics dashboard with metrics
- [Data Display](https://github.com/objectql/objectui/tree/main/examples/data-display) - Lists, badges, and progress bars
- [Landing Page](https://github.com/objectql/objectui/tree/main/examples/landing-page) - Complete marketing page
- [All Examples](https://github.com/objectql/objectui/tree/main/examples) - View the full collection

Run any example with the CLI:
```bash
npm install -g @object-ui/cli
objectui serve examples/basic-form/app.json
```

## Need Help?

- 📖 [Full Documentation](/)
- 💬 [GitHub Discussions](https://github.com/objectql/objectui/discussions)
- 🐛 [Report Issues](https://github.com/objectql/objectui/issues)
- 📧 [Email Support](mailto:hello@objectui.org)
