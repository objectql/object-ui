---
title: "Object UI CLI User Guide"
---

## Introduction

Object UI CLI is a runtime environment that treats **JSON as Source Code**. 

It allows you to build, run, and deploy complete enterprise applications using **only JSON file structures**, eliminating the need for React component code, boilerplates, or build configurations.

## Project Philosophy: "Just JSON"

A standard Object UI project contains no `.tsx` or `src` folders. It is simply a collection of schema definition files.

### Project Structure Types

#### 1. Single-File App (`app.json`)
The simplest form. A single JSON file defines the entire application.

```bash
my-tool/
└── app.json  # Defines the root Schema
```

#### 2. Multi-Page Enterprise App (`pages/`)
For complex applications. The folder structure automatically determines the routing (File-System Routing).

```bash
my-crm/
├── pages/
│   ├── index.json        # Route: /
│   ├── login.json        # Route: /login
│   ├── customers/
│   │   ├── index.json    # Route: /customers
│   │   └── [id].json     # Route: /customers/:id (Dynamic)
│   └── settings.json     # Route: /settings
└── assets/               # Images and static files
```

## Installation

```bash
# Install globally
npm install -g @object-ui/cli

# Run without installing
npx @object-ui/cli serve
```

## Commands

### `init` - Create Project

Creates a new folder with the standard JSON structure.

```bash
objectui init my-app --template dashboard
```

### `serve` - Development Server

Starts the local development engine. It watches your JSON files and Hot Reloads (HMR) the UI instantly.

```bash
# Run the current folder (Auto-detects pages/ or app.json)
objectui serve

# Run on a specific port
objectui serve --port 8080
```

### `build` - Production Build

Compiles your JSON files into a static Single Page Application (SPA) - standard HTML/CSS/JS ready for deployment.

```bash
objectui build
# Output: ./dist (Deployable to Vercel, Netlify, or Nginx)
```

## Routing System

Object UI implements **File-System Routing**. You do not configure a router; you simply create files in the `pages/` directory.

### Static Routes

| File Path | URL Path |
| :--- | :--- |
| `pages/index.json` | `/` |
| `pages/about.json` | `/about` |
| `pages/dashboard/settings.json` | `/dashboard/settings` |

### Dynamic Routes

Use square brackets `[]` in filenames to define dynamic URL parameters.

| File Path | URL Path | Parameter Access |
| :--- | :--- | :--- |
| `pages/users/[id].json` | `/users/123` | `${params.id}` = 123 |
| `pages/blog/[slug].json` | `/blog/hello-world` | `${params.slug}` = "hello-world" |

### Using Parameters in Schema

You can access route parameters directly in your JSON properties using the expression syntax:

```json
{
  "type": "page",
  "title": "User Profile",
  "body": {
    "type": "text",
    "value": "Currently viewing user ID: ${params.id}"
  }
}
```

## Schema Examples

### 1. Minimal Application (`app.json`)

```json
{
  "type": "page",
  "title": "Hello World",
  "className": "flex items-center justify-center h-screen",
  "body": "Welcome to Object UI"
}
```

### 2. Dashboard Page (`pages/dashboard.json`)

```json
{
  "type": "page",
  "title": "Analytics Dashboard",
  "className": "bg-slate-50 p-6 min-h-screen",
  "body": [
    {
      "type": "header",
      "title": "Business Overview",
      "className": "mb-6"
    },
    {
      "type": "grid",
      "columns": 3,
      "gap": 4,
      "children": [
        {
          "type": "card",
          "title": "Revenue",
          "body": "$12,450"
        },
        {
          "type": "card",
          "title": "Active Users",
          "body": "1,234"
        },
        {
          "type": "card",
          "title": "Growth",
          "body": "+24%"
        }
      ]
    }
  ]
}
```

## Navigation

To navigate between pages without writing code, use the `navigate` helper in `onClick` events.

```json
{
  "type": "button",
  "label": "Go to User Settings",
  "onClick": "navigate('/settings')"
}
```

## FAQ

### 1. Can I use custom React components?
In a "Just JSON" project, you are limited to the standard component library provided by Object UI. To use custom React components, you would need to eject to a standard Vite React project structure.

### 2. How do I style components?
Use standard Tailwind CSS classes in the `className` property. The CLI includes a pre-packaged Tailwind runtime.

```json
{
  "type": "button",
  "className": "bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
}
```
