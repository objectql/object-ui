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
pnpm add @object-ui/components @object-ui/core @object-ui/react
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
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0"
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
  "@object-ui/plugin-designer": "latest",
  "@object-ui/plugin-workflow": "latest",
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

### src/index.css (Shadcn theme)

This file is critical — without it, Object UI components render unstyled.

```css
@import "tailwindcss";

/* Scan ObjectUI packages for utility class generation */
@source "../node_modules/@object-ui/components/src/**/*.tsx";
@source "../node_modules/@object-ui/fields/src/**/*.tsx";
@source "../node_modules/@object-ui/layout/src/**/*.tsx";
@source "../node_modules/@object-ui/react/src/**/*.tsx";

/* Map Shadcn CSS variables to Tailwind 4 color tokens */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

Adjust `@source` paths to match your project structure relative to `node_modules`.

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

## Monorepo structure

The ObjectUI monorepo uses pnpm workspaces + Turborepo:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'examples/*'
```

### Build order (Turbo pipeline)

Turbo respects `^build` dependencies: packages build before apps that depend on them.

```
@object-ui/types        → (no deps)
@object-ui/core         → types
@object-ui/components   → (no deps from core)
@object-ui/fields       → components, types
@object-ui/layout       → components
@object-ui/react        → core, types
@object-ui/plugin-*     → components, core, react, types
apps/console            → all packages
```

### Common monorepo commands

```bash
# Root commands
pnpm dev                    # Start all dev servers
pnpm build                  # Build all packages (excl. site)
pnpm build:all              # Build everything including site
pnpm test                   # Run all tests
pnpm lint                   # Lint all packages
pnpm type-check             # TypeScript check all

# Scoped commands
pnpm --filter @object-ui/core build       # Build single package
pnpm --filter "apps/*" dev                # Dev all apps

# Scoped tests — always from the repo root, paths relative to it, no `--`
pnpm exec vitest run packages/core/                  # Test single package
pnpm exec vitest run packages/core/src/<file>.test.ts   # Test single file

# Setup from clean clone
./scripts/setup.sh                        # Full automated setup
# Or manually:
pnpm install
pnpm build
pnpm test
```

Note that tests are scoped by a **path filter from the repo root**, not by
`pnpm --filter <pkg> test`. The `--filter` form (and `turbo run test`, and
`cd packages/x && pnpm exec vitest`) makes vitest treat the package directory as its
root: the root-level `unit`/`dom`/`dom-heavy` projects declare their `include` globs
relative to that root and match nothing, while the `apps/console` project — brought in
by absolute path — still resolves. The run then executes console's 22 files, reports
`Test Files 22 passed (22)`, and never touches the package you asked for. A guard in
`vitest.config.mts` rejects those invocations with a non-zero exit and prints the
correct form:

```
vitest 调用被拒绝:从包目录跑 vitest 会静默跑错测试集 (objectui#3378)
...
正确跑法 —— 一律在【仓库根目录】执行,路径前【不要】加 `--`:
  pnpm exec vitest run packages/<pkg>/src/<file>.test.ts   # 只跑一个文件
  pnpm exec vitest run packages/<pkg>/   # 只跑一个包
  pnpm test   # 全量(CI 跑的就是它)
```

The same guard rejects a path placed behind `--` (`pnpm --filter <pkg> test --
--run <path>`), which pnpm forwards verbatim and vitest's CLI parser discards.

### Adding a workspace package as dependency

```bash
# In any package.json
{
  "@object-ui/core": "workspace:*"
}
```

Then `pnpm install` to link.

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
- `ObjectRenderer`, `DashboardRenderer`, `PageRenderer`
- `AdapterProvider`, `MetadataProvider`, `ExpressionProvider`
- `useObjectActions`, `useRecentItems`, `useAdapter`, `useMetadataItem`

```tsx
import { AppShell, ObjectRenderer, AdapterProvider, MetadataProvider } from '@object-ui/app-shell';

<AdapterProvider adapter={myAdapter}>
  <MetadataProvider value={metadata}>
    <AppShell sidebar={<MySidebar />}>
      <ObjectRenderer objectName="contact" />
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
| Need shell + object/dashboard/page/form renderers | + `@object-ui/app-shell` |
| Need full admin console (sidebar, system hub, navigation) | study `apps/console` patterns |
| Need a CLI-driven dev server | `@object-ui/cli` (`objectui dev`) |
| Need a standalone runtime bundle | `@object-ui/runner` |

## Deployment

### Vite production build

```bash
pnpm build            # Builds all packages
cd apps/console
pnpm build            # Produces dist/
pnpm preview          # Serve dist/ locally
```

### Vercel deployment

`apps/console/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Environment variables

```bash
VITE_API_BASE_URL=/api/v1
VITE_AUTH_BASE_URL=/api/v1/auth
```

Access in code: `import.meta.env.VITE_API_BASE_URL`

## Troubleshooting

### Components render unstyled
- Missing `@source` directives in CSS — Tailwind can't find ObjectUI utility classes
- Missing `:root` CSS variables — Shadcn components need color tokens
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
