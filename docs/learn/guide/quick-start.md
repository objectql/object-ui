---
title: "Quick Start"
---

You can use Object UI in two ways: via the **CLI** (for rapid schema-driven apps) or as a **React Library** (for valid existing projects).

## Method A: The CLI Way (Fastest)

Perfect for building dashboards, admin panels, and prototypes without writing React code.

```bash
# 1. Scaffolding a new project
npx @object-ui/cli init my-admin --template dashboard

# 2. Start the engine
cd my-admin
npx @object-ui/cli dev
```

That's it! Open `app.json` to start editing your UI.

## Method B: The React Library Way

Let's integrate Object UI into an existing React project.

### The Hello World

Create a new file `src/App.tsx`. We will define a simple login form using JSON.

```tsx
// src/App.tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { RestDataSource } from '@object-ui/data-rest'; 
// Or import '@object-ui/components/styles.css' if needed within your setup

// 1. Define the Protocol (The UI)
const loginSchema = {
  type: 'page',
  title: 'Welcome Back',
  className: "flex items-center justify-center min-h-screen bg-slate-50",
  body: {
    type: "form",
    className: "w-full max-w-md p-8 bg-white rounded-xl shadow-lg border",
    title: "Sign In",
    fields: [
      {
        type: "input",
        name: "email",
        label: "Email Address",
        required: true,
        inputType: "email",
        placeholder: "you@example.com"
      },
      {
        type: "input",
        name: "password",
        label: "Password",
        required: true,
        inputType: "password"
      }
    ],
    actions: [
      {
        type: "button",
        label: "Login",
        submit: true,
        className: "w-full bg-blue-600 hover:bg-blue-700 text-white"
      }
    ]
  }
};

// 2. Define Connectivity (Optional for local forms)
// For this demo, we'll use a mocked data source
const dataSource = {
  find: async () => [],
  create: async (resource, data) => {
    alert(`Logging in with: ${JSON.stringify(data)}`);
    return data;
  }
};

export default function App() {
  return (
    // 3. Render the Engine
    <SchemaRenderer 
      schema={loginSchema} 
      dataSource={dataSource}
    />
  );
}
```

## Explanation

1.  **Schema Definition**: We defined a complete layout (Page -> Form -> Fields) using a plain JavaScript object. Note the usage of standard Tailwind classes in `className`.
2.  **Engine Initialization**: `<SchemaRenderer>` takes the JSON and recursively resolves the correct component implementations from `@object-ui/components`.
3.  **Data Handling**: When you click "Login", the form automatically collects the values (`email`, `password`) and calls `dataSource.create()` because the button has `submit: true`.

## Next Steps

*   Explore [Schema Rendering](./schema-rendering) to understand how JSON maps to React.
*   Connect real data using [Data Connectivity](./data-source).
*   Use the [Visual Studio](./studio) to drag-and-drop generate this JSON.
