# Object UI CLI User Guide

## Introduction

Object UI CLI is a command-line tool that allows you to quickly build and run applications using JSON schema files.

## Installation

```bash
# Install globally
npm install -g @object-ui/cli

# Or using pnpm
pnpm add -g @object-ui/cli

# Or use with npx (no installation required)
npx @object-ui/cli --help
```

## Quick Start

### 1. Create a New Application

```bash
# Use default template (dashboard)
objectui init my-app

# Use specific template
objectui init my-app --template form

# Create in current directory
objectui init . --template simple
```

**Available Templates:**
- `dashboard` - Complete dashboard interface (default)
- `form` - Form example
- `simple` - Simple starter template

### 2. Start Development Server

```bash
# Navigate to app directory
cd my-app

# Start server
objectui serve app.json

# Custom port
objectui serve app.json --port 8080

# Specify host
objectui serve app.json --host 0.0.0.0
```

### 3. Edit Schema

Open the `app.json` file and modify the JSON content to see real-time updates in your application.

## Command Reference

### `objectui init [name]`

Create a new Object UI application.

**Arguments:**
- `[name]` - Application name (optional, default: `my-app`)

**Options:**
- `-t, --template <template>` - Template to use: `simple`, `form`, or `dashboard` (default: `dashboard`)

**Examples:**
```bash
objectui init blog --template dashboard
objectui init form-app --template form
objectui init . --template simple
```

### `objectui serve [schema]`

Start a development server to render your JSON schema.

**Arguments:**
- `[schema]` - Path to JSON schema file (optional, default: `app.json`)

**Options:**
- `-p, --port <port>` - Server port (default: `3000`)
- `-h, --host <host>` - Server host (default: `localhost`)

**Examples:**
```bash
objectui serve
objectui serve my-schema.json
objectui serve app.json --port 8080
objectui serve app.json --host 0.0.0.0 --port 3001
```

## Schema Examples

### Simple Example

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center",
  "body": {
    "type": "card",
    "title": "Welcome to Object UI",
    "body": {
      "type": "text",
      "content": "Start building your application!"
    }
  }
}
```

### Form Example

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center p-4",
  "body": {
    "type": "card",
    "className": "w-full max-w-md",
    "title": "Contact Us",
    "body": {
      "type": "div",
      "className": "p-6 space-y-4",
      "body": [
        {
          "type": "input",
          "label": "Name",
          "placeholder": "Enter your name"
        },
        {
          "type": "input",
          "label": "Email",
          "inputType": "email",
          "placeholder": "your@email.com"
        },
        {
          "type": "textarea",
          "label": "Message",
          "placeholder": "Enter your message"
        },
        {
          "type": "button",
          "label": "Submit",
          "className": "w-full"
        }
      ]
    }
  }
}
```

## Adding Routing to Your Application

The CLI supports two approaches for routing: **file-system based routing** (recommended, Next.js-style) and manual React Router setup.

### Approach 1: File-System Based Routing (Recommended) ✅

The CLI automatically detects a `pages/` directory and generates routes based on the folder hierarchy.

#### Directory Structure

Create a `pages/` directory with your schema files:

```
my-app/
├── pages/
│   ├── index.json           → /
│   ├── about.json           → /about
│   ├── blog/
│   │   ├── index.yml        → /blog
│   │   └── [id].yaml        → /blog/:id
│   └── users/
│       └── [userId].json    → /users/:userId
└── app.layout.json (optional, reserved for future layout support)
```

**Supported File Extensions:**
- `.json` - JSON format
- `.yml` / `.yaml` - YAML format

Use any extension you prefer. YAML files are parsed automatically. The simple extension naming allows for future specialized file types (`.menu.json`, `.layout.json`, etc.).

#### Example Page Schemas

**pages/index.json:**
```json
{
  "type": "div",
  "className": "p-8",
  "body": {
    "type": "card",
    "title": "Home Page",
    "body": {
      "type": "text",
      "content": "Welcome to the home page!"
    }
  }
}
```

**pages/about.yml (YAML format):**
```yaml
type: div
className: p-8
body:
  type: card
  title: About Page
  body:
    type: text
    content: Learn more about us!
```

**pages/about.json:**
```json
{
  "type": "div",
  "className": "p-8",
  "body": {
    "type": "card",
    "title": "About Page",
    "body": {
      "type": "text",
      "content": "Learn more about us!"
    }
  }
}
```

**pages/blog/[id].json** (Dynamic route):
```json
{
  "type": "div",
  "className": "p-8",
  "body": {
    "type": "card",
    "title": "Blog Post",
    "body": {
      "type": "text",
      "content": "Blog post ID: ${params.id}"
    }
  }
}
```

#### Running with File-System Routing

When you have a `pages/` directory, the CLI automatically detects it and sets up routing:

```bash
objectui serve
```

The serve command will:
1. Detect the `pages/` directory
2. Automatically install `react-router-dom`
3. Generate route configuration based on file structure
4. Set up the application with all routes

You'll see output like:
```
📁 Detected pages/ directory - using file-system routing
✓ Found 5 route(s)
  / → pages/index.json
  /about → pages/about.json
  /blog → pages/blog/index.json
  /blog/:id → pages/blog/[id].json
  /users/:userId → pages/users/[userId].schema.json
```

#### Route Mapping Rules

- `pages/index.json` → `/`
- `pages/about.json` → `/about`
- `pages/blog/index.json` → `/blog`
- `pages/blog/[id].json` → `/blog/:id` (dynamic parameter)
- `pages/users/[userId]/posts/[postId].schema.json` → `/users/:userId/posts/:postId`

#### Navigation Between Pages

Use link components or buttons with navigation:

```json
{
  "type": "div",
  "className": "flex gap-4",
  "body": [
    {
      "type": "button",
      "label": "Go to About",
      "onClick": "() => window.location.href='/about'"
    }
  ]
}
```

**Note:** For now, navigation is done through standard links. Schema-level navigation helpers are planned for a future release.

### Approach 2: Manual React Router Setup

For more control, you can manually set up React Router in the generated application.

#### Step 1: Install React Router

Navigate to your `.objectui-tmp` directory after running `objectui serve`:

```bash
cd .objectui-tmp
npm install react-router-dom
```

#### Step 2: Create Multiple Schema Files

Create separate schema files for each route.

#### Step 3: Modify App.tsx

Update the generated `src/App.tsx` in `.objectui-tmp/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import homeSchema from './schemas/home.schema.json';
import aboutSchema from './schemas/about.schema.json';

function App() {
  return (
    <BrowserRouter>
      <nav className="bg-gray-100 p-4">
        <Link to="/" className="mr-4">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<SchemaRenderer schema={homeSchema} />} />
        <Route path="/about" element={<SchemaRenderer schema={aboutSchema} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Alternative: Schema-Based Navigation

You can also define navigation in your main schema using button click handlers:

```json
{
  "type": "div",
  "className": "min-h-screen",
  "body": [
    {
      "type": "div",
      "className": "bg-gray-100 p-4 flex gap-4",
      "body": [
        {
          "type": "button",
          "label": "Home",
          "variant": "ghost",
          "onClick": "navigate('/')"
        },
        {
          "type": "button",
          "label": "About",
          "variant": "ghost",
          "onClick": "navigate('/about')"
        }
      ]
    },
    {
      "type": "div",
      "className": "p-8",
      "body": "<!-- Page content here -->"
    }
  ]
}
```

## Layouts and Nested Routes

**Note:** Layout support with `app.json` and `_layout.json` is planned for a future release. Currently, all routing is handled at the page level.

## Running Example Projects

The Object UI repository includes ready-to-use examples that demonstrate various UI patterns and features. You can run them directly using the CLI:

### Available Examples

1. **Basic Form** - Contact form with validation
   ```bash
   objectui serve examples/basic-form/app.json
   ```

2. **Dashboard** - Analytics dashboard with metrics and activity feeds
   ```bash
   objectui serve examples/dashboard/app.json
   ```

3. **Data Display** - User profiles, task lists, progress bars, and badges
   ```bash
   objectui serve examples/data-display/app.json
   ```

4. **Landing Page** - Complete marketing page with hero section and CTAs
   ```bash
   objectui serve examples/landing-page/app.json
   ```

5. **CLI Demo** - Bilingual form demonstration
   ```bash
   objectui serve examples/cli-demo/app.schema.json
   ```

### Exploring Examples

Each example includes:
- `app.json` - The JSON schema definition
- `README.md` - Detailed documentation and customization guide
- `.gitignore` - Git ignore configuration

To explore an example:

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git
cd objectui/examples

# View available examples
ls -la

# Run an example
objectui serve basic-form/app.json
```

Then open http://localhost:3000 in your browser and start editing the `app.json` file to see live updates!

For more details, see the [Examples README](https://github.com/objectql/objectui/tree/main/examples).

## FAQ

### 1. How to customize styles?

Object UI uses Tailwind CSS. You can add Tailwind classes to any component's `className` property:

```json
{
  "type": "button",
  "label": "Button",
  "className": "bg-blue-500 hover:bg-blue-600 text-white"
}
```

### 2. How to use data binding?

Use the `${expression}` syntax:

```json
{
  "type": "text",
  "content": "Welcome, ${user.name}!"
}
```

### 3. What components are supported?

See the complete component list:
- [Component Documentation](https://www.objectui.org/docs/api/components)
- [Protocol Specification](https://www.objectui.org/docs/protocol/overview)

## Learn More

- [Official Website](https://www.objectui.org)
- [Documentation](https://www.objectui.org/docs)
- [GitHub Repository](https://github.com/objectql/objectui)
- [Examples](https://github.com/objectql/objectui/tree/main/examples)

## License

MIT
