---
name: objectui-project-setup
description: Set up, configure, and build Object UI projects — from initializing new apps to configuring the monorepo build system. Use this skill when the user asks to create a new Object UI project, set up a Vite + React app with Object UI, configure pnpm workspace, run the CLI (objectui init/dev/build/serve/studio), debug build issues, configure Turbo pipelines, set up ObjectStack config files, or deploy an Object UI app. Also applies when the user asks about monorepo structure, package dependencies, build order, dev server setup, or "how do I start a new project with Object UI".
---

# ObjectUI Project Setup

Use this skill to set up new Object UI projects, configure the build system, and manage the monorepo development workflow.

## Quick start: new project from scratch

### Using the CLI

```bash
npx @object-ui/cli init my-app
cd my-app
pnpm install
pnpm dev
```

The `init` command scaffolds a project with templates: `simple`, `form`, `dashboard`, etc.

### Manual setup (Vite + React)

```bash
pnpm create vite my-app --template react-ts
cd my-app
pnpm add @object-ui/components @object-ui/core @object-ui/react @object-ui/fields
pnpm add -D tailwindcss @tailwindcss/vite postcss
```

Then configure the required files (see "Essential configuration files" below).

## Essential configuration files

### package.json (minimum dependencies)

```json
{
  "dependencies": {
    "@object-ui/components": "latest",
    "@object-ui/core": "latest",
    "@object-ui/react": "latest",
    "@object-ui/fields": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^6.0.3",
    "vite": "^8.2.1",
    "@vitejs/plugin-react": "^6.0.5"
  }
}
```

Add plugins as needed (full plugin catalog):
```json
{
  "@object-ui/plugin-grid": "latest",
  "@object-ui/plugin-list": "latest",
  "@object-ui/plugin-detail": "latest",
  "@object-ui/plugin-form": "latest",
  "@object-ui/plugin-kanban": "latest",
  "@object-ui/plugin-calendar": "latest",
  "@object-ui/plugin-timeline": "latest",
  "@object-ui/plugin-gantt": "latest",
  "@object-ui/plugin-dashboard": "latest",
  "@object-ui/plugin-report": "latest",
  "@object-ui/plugin-charts": "latest",
  "@object-ui/plugin-map": "latest",
  "@object-ui/plugin-editor": "latest",
  "@object-ui/plugin-markdown": "latest",
  "@object-ui/plugin-view": "latest",
  "@object-ui/plugin-tree": "latest",
  "@object-ui/plugin-designer": "latest",
  "@object-ui/plugin-ai": "latest",
  "@object-ui/plugin-chatbot": "latest"
}
```

Opt-in platform packages (auth, i18n, mobile, realtime):
```json
{
  "@object-ui/auth": "latest",
  "@object-ui/permissions": "latest",
  "@object-ui/i18n": "latest",
  "@object-ui/mobile": "latest",
  "@object-ui/collaboration": "latest"
}
```

Embedding shell + provider stack into a third-party app:
```json
{
  "@object-ui/app-shell": "latest",
  "@object-ui/providers": "latest"
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### postcss.config.js

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### src/index.css (ObjectUI stylesheets)

This file is critical — without it, Object UI components render unstyled. There is no
`tailwind.config.js` step: ObjectUI is Tailwind 4, configured in CSS.

```css
@import "tailwindcss";
@import "@object-ui/components/style.css";
@import "@object-ui/fields/style.css";
```

That is the whole of the styling setup. Each `style.css` is a real package export, mapped
to that package's `dist/index.css` and compiled at build time from the package's own
sources: the components sheet carries every utility its components use **and** the
`@theme` block those utilities are built on, so the whole Shadcn palette
(`bg-background`, `bg-primary`, `border-input`, `ring-ring`) and the `:root` / `.dark`
token defaults arrive with it. You do not restate those tokens in a `@theme` block of your
own.

The order matters: `@object-ui/fields/style.css` is a supplement compiled against the
components theme, with every rule that sheet already ships subtracted from it. Imported
first, or alone, its rules resolve against tokens that are not there yet.

Do **not** point Tailwind at the ObjectUI packages inside `node_modules`, with neither a
v4 `@source` line nor a v3 `content` entry. The published tarballs carry `dist` only, and
the `@theme` block the themed utilities come from lives in package source, which is not
published — so scanning them regenerates shape-only utilities the two sheets already carry
and cannot produce the themed ones at all. Your own `@source` lines (or Tailwind's
defaults) go on covering *your* source, exactly as before.

To recolour, override the token values rather than the utilities — they are Shadcn HSL
channel triples, not finished colours:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
}
```

See `content/docs/guide/theming.md` for the full token list and the `ThemeProvider` route.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## CLI commands

| Command | What it does |
|---------|-------------|
| `objectui init` | Scaffold new project from template (`simple`, `form`, `dashboard`) |
| `objectui dev` | Dev server with HMR + schema watching (alias: `objectui serve`) |
| `objectui build` | Production build (Vite) |
| `objectui start` | Serve a previously-built production bundle |
| `objectui studio` | Visual UI editor |
| `objectui validate` | Validate a schema file (CI-friendly, exits non-zero on failure) |
| `objectui check` | Validate every schema file in the project |
| `objectui lint` | Lint generated app code (ESLint) |
| `objectui test` | Run app tests (Vitest) |
| `objectui generate` | Code/schema generation (`object`, `page`, `plugin`) |
| `objectui add` | Add a component renderer scaffold |
| `objectui create plugin` | Scaffold a new plugin |
| `objectui doctor` | Diagnostics (Node version, deps, etc.) |
| `objectui analyze` | Analyze bundle size / render performance |

### Dev server modes

**Single schema file:**
```bash
objectui dev schema.json --port 3000
```

**File-system routing (pages/ directory):**
```
pages/
├── index.json        → /
├── dashboard.json    → /dashboard
└── settings.json     → /settings
```

```bash
objectui dev pages/ --port 3000
```

## objectstack.config.ts

Configuration for the ObjectStack runtime (objects, views, data, plugins):

```typescript
import { defineConfig } from '@objectstack/runtime';

export default defineConfig({
  apps: [
    {
      name: 'my-app',
      label: 'My Application',
      objects: [
        {
          name: 'contacts',
          label: 'Contacts',
          fields: [
            { name: 'name', type: 'text', label: 'Name', required: true },
            { name: 'email', type: 'email', label: 'Email' },
            { name: 'status', type: 'select', label: 'Status', options: ['active', 'inactive'] },
          ],
        },
      ],
    },
  ],
});
```

## Runtime & integration packages

ObjectUI ships three integration layers for third-party apps. Pick the smallest one that fits.

### `@object-ui/react` — pure renderer (lowest level)

Use when you have your own router, shell and providers and only need to render schemas.

```tsx
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

<SchemaRendererProvider dataSource={dataSource}>
  <SchemaRenderer schema={pageSchema} />
</SchemaRendererProvider>
```

### `@object-ui/providers` — reusable context stack

Framework-agnostic providers without console-specific dependencies:

- `DataSourceProvider` / `useDataSource` — generic data source binding.
- `MetadataProvider` / `useMetadata` — apps / objects / dashboards / pages metadata.
- `ThemeProvider` / `useTheme` — light/dark/system theming wired to Shadcn variables.

```tsx
import { DataSourceProvider, MetadataProvider, ThemeProvider } from '@object-ui/providers';

<ThemeProvider>
  <DataSourceProvider dataSource={myDataSource}>
    <MetadataProvider metadata={myMetadata}>
      <App />
    </MetadataProvider>
  </DataSourceProvider>
</ThemeProvider>
```

### `@object-ui/app-shell` — minimal shell + renderers

Use when integrating ObjectUI into a host system (CRM, ERP, custom admin) and you want:

- `AppShell` (sidebar + main split layout)
- `ObjectView`, `RecordDetailView`, `DashboardView`, `PageView`, `ReportView`
- `AdapterProvider`, `MetadataProvider`, `ExpressionProvider`
- `useObjectActions`, `useRecentItems`, `useAdapter`, `useMetadataItem`

⚠️ These are `*View`, not `*Renderer`. `ObjectRenderer` exists nowhere in the
repo; `DashboardRenderer` is `@object-ui/plugin-dashboard`'s; `PageRenderer` is
internal to `@object-ui/components` and is reached through the registry, not by
import. Importing any of the three from `app-shell` does not resolve.

```tsx
import { AppShell, ObjectView, AdapterProvider, MetadataProvider } from '@object-ui/app-shell';

<AdapterProvider adapter={myAdapter}>
  <MetadataProvider value={metadata}>
    <AppShell sidebar={<MySidebar />}>
      <ObjectView objectName="contact" />
    </AppShell>
  </MetadataProvider>
</AdapterProvider>
```

App-shell is router-agnostic — wire it into React Router / Next.js / TanStack Router yourself.

### `@object-ui/runner` — universal runtime

Standalone runtime + dev server that ships with `plugin-charts` and `plugin-kanban` pre-registered. Useful for:

- Running a schema as a one-off app (no project scaffolding).
- Embedding a "play with this schema" sandbox.
- Reproducing bugs against a known-good runtime.

Typical usage is via the `objectui dev` CLI (which wraps the same renderer).

### Decision matrix

| Need | Use |
|------|-----|
| Bare renderer in existing app | `@object-ui/react` |
| Need shared providers (data/metadata/theme) | + `@object-ui/providers` |
| Need shell + object/dashboard/page/record views | + `@object-ui/app-shell` |
| Need full admin console (sidebar, system hub, navigation) | study `apps/console` patterns |
| Need a CLI-driven dev server | `@object-ui/cli` (`objectui dev`) |
| Need a standalone runtime bundle | `@object-ui/runner` |

## Deployment

### Vite production build

```bash
pnpm build            # Produces dist/
pnpm preview          # Serve dist/ locally
```

### Environment variables

```bash
VITE_API_BASE_URL=/api/v1
VITE_AUTH_BASE_URL=/api/v1/auth
```

Access in code: `import.meta.env.VITE_API_BASE_URL`

## Troubleshooting

### Components render unstyled
- Missing the `@object-ui/components/style.css` / `@object-ui/fields/style.css` imports — ObjectUI's own utilities never reach the page
- The two sheets imported in the wrong order, or the components one left out — the fields sheet carries no tokens of its own
- Overridden `:root` tokens written as finished colours instead of Shadcn HSL channel triples (`0 0% 100%`), so `hsl(var(--token))` resolves to nothing
- CSS file not imported in `main.tsx`

### Module not found errors
- Run `pnpm install` to ensure workspace links are resolved
- Run `pnpm build` — downstream packages need built `dist/` directories
- Check `tsconfig.json` path aliases match project structure

### Turbo cache issues
- `pnpm turbo run build --force` to bypass cache
- Delete `.turbo/` directory for clean state

### Vite HMR not working
- Check `vite.config.ts` has `react()` plugin
- Ensure file extensions are `.tsx` not `.jsx` when using TypeScript
