---
title: "Object UI CLI"
---

The Object UI CLI allows you to rapidly prototype, develop, and build applications completely from JSON/YAML schemas, without manually setting up a React project.

## Installation

You can run the CLI directly using `npx` (recommended) or install it globally.

### Using npx (Recommended)

```bash
npx @object-ui/cli init my-app
```

### Global Install

```bash
npm install -g @object-ui/cli
# or
pnpm add -g @object-ui/cli
```

## Quick Start

### 1. Initialize a new project

The `init` command creates a new folder with a ready-to-use template.

```bash
npx @object-ui/cli init my-app
```

You can choose from different templates:

*   **simple**: Minimal configuration.
*   **dashboard**: A full admin dashboard layout (default).
*   **form**: A comprehensive form example.

```bash
npx @object-ui/cli init my-app --template dashboard
```

### 2. Start Development

Navigate to your folder and start the dev server. It watches your JSON files and hot-reloads the browser.

```bash
cd my-app
npx @object-ui/cli dev app.json
```

Now you can edit `app.json` or any linked pages, and see changes instantly.

### 3. Build for Production

When you are ready to deploy, build your app into static HTML/JS/CSS assets.

```bash
npx @object-ui/cli build app.json --out-dir dist
```

You can then serve the `dist` folder with any static web server (Nginx, Vercel, Netlify, etc.).

## Command Reference

### `init`

Scaffolds a new project.

```bash
objectui init <name> [options]
```

*   `--template, -t`: Template name (`simple`, `form`, `dashboard`).

### `dev`

Starts the development server.

```bash
objectui dev [schema] [options]
```

*   `[schema]`: Entry point file (default: `app.json`).
*   `--port, -p`: Port number (default: `3000`).
*   `--no-open`: Don't open browser automatically.

### `build`

Builds the static application.

```bash
objectui build [schema] [options]
```

*   `[schema]`: Entry point file (default: `app.json`).
*   `--out-dir, -o`: Output directory (default: `dist`).
*   `--clean`: Empty output directory before building.
