/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import * as yaml from 'js-yaml';

export interface RouteInfo {
  path: string;
  filePath: string;
  schema: unknown;
  isDynamic: boolean;
  paramName?: string;
}

// Helper function to check if a file is a supported schema file
export function isSupportedSchemaFile(filename: string): boolean {
  return filename.endsWith('.json') || 
         filename.endsWith('.yml') ||
         filename.endsWith('.yaml');
}

// Helper function to extract the base filename without extension
export function getBaseFileName(filename: string): string {
  // Remove supported extensions
  return filename
    .replace(/\.(json|yml|yaml)$/, '');
}

// Helper function to parse schema file (JSON or YAML)
export function parseSchemaFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  } else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    return yaml.load(content);
  }
  
  throw new Error(`Unsupported file format: ${filePath}`);
}

export function scanPagesDirectory(pagesDir: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  
  const scanDir = (dir: string, routePrefix: string = '') => {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        const newPrefix = routePrefix + '/' + entry;
        scanDir(fullPath, newPrefix);
      } else if (isSupportedSchemaFile(entry)) {
        // Process schema file
        const fileName = getBaseFileName(entry);
        let routePath: string;
        let isDynamic = false;
        let paramName: string | undefined;
        
        if (fileName === 'index') {
          // index.schema.json or index.page.json maps to the directory path
          routePath = routePrefix || '/';
        } else if (fileName.startsWith('[') && fileName.endsWith(']')) {
          // Dynamic route: [id].schema.json -> /:id
          paramName = fileName.slice(1, -1);
          routePath = routePrefix + '/:' + paramName;
          isDynamic = true;
        } else {
          // Regular file: about.schema.json -> /about
          routePath = routePrefix + '/' + fileName;
        }
        
        // Read and parse schema
        try {
          const schema = parseSchemaFile(fullPath);
          
          routes.push({
            path: routePath,
            filePath: fullPath,
            schema,
            isDynamic,
            paramName,
          });
        } catch (error) {
          console.warn(chalk.yellow(`⚠ Warning: Failed to parse ${fullPath}: ${error instanceof Error ? error.message : error}`));
        }
      }
    }
  };
  
  scanDir(pagesDir);
  
  // Sort routes: exact routes first, then dynamic routes
  routes.sort((a, b) => {
    if (a.isDynamic && !b.isDynamic) return 1;
    if (!a.isDynamic && b.isDynamic) return -1;
    return a.path.localeCompare(b.path);
  });
  
  return routes;
}

/** This package's own name, used to locate its manifest for the platform range. */
const CLI_PACKAGE_NAME = '@object-ui/cli';

/**
 * `@object-ui/*` packages the generated apps IMPORT, and therefore must declare.
 *
 * Every entry is imported by a generated `src/App.tsx` — the two platform
 * packages by name, the seven plugins as side-effect imports that register
 * their components with the registry. Until objectui#3827 only the first two
 * were declared, so a generated app asked npm for nine packages having named
 * two of them; the seven plugins resolved in this workspace purely because the
 * temp app is created under `<cwd>` and hoisting reached the root
 * `node_modules`.
 *
 * `@object-ui/core` and `@object-ui/types` are deliberately absent: the
 * generated sources never import them (only `commands/dev.ts` aliases them for
 * Vite), and declaring a versioned dependency nothing imports is the defect
 * objectui#3755 removed from the sibling generator. `app-generator.test.ts`
 * gates both directions.
 */
const PLATFORM_RUNTIME_PACKAGES = [
  '@object-ui/react',
  '@object-ui/components',
  '@object-ui/plugin-charts',
  '@object-ui/plugin-editor',
  '@object-ui/plugin-kanban',
  '@object-ui/plugin-markdown',
  '@object-ui/plugin-form',
  '@object-ui/plugin-grid',
  '@object-ui/plugin-view'
] as const;

/** Memoised so the manifest walk happens at most once per process. */
let cachedCliVersion: string | undefined;

/**
 * This CLI's own version, read from its own `package.json`.
 *
 * Walks up from this module rather than joining a fixed `../package.json`,
 * because the same source sits at `src/utils/` in the repo and is bundled into
 * `dist/` when published — a relative depth that is correct in one is wrong in
 * the other.
 */
function cliVersion(): string {
  if (cachedCliVersion !== undefined) return cachedCliVersion;

  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const manifest = JSON.parse(readFileSync(candidate, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === CLI_PACKAGE_NAME && typeof manifest.version === 'string') {
        cachedCliVersion = manifest.version;
        return cachedCliVersion;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `Could not locate the ${CLI_PACKAGE_NAME} manifest to version the generated app's ` +
      `platform dependencies against. Refusing to write a package.json with a guessed range.`
  );
}

/**
 * The range the generated apps declare for every `@object-ui/*` dependency.
 *
 * Derived from this CLI's own version instead of being written out as a
 * literal, because `.changeset/config.json` puts `@object-ui/cli` in the SAME
 * `fixed` group as every package in `PLATFORM_RUNTIME_PACKAGES`: they are
 * released together and always carry the identical version. So `^<own
 * version>` is both current and guaranteed to exist on the registry — whatever
 * CLI version a user is running was published alongside its siblings.
 *
 * The literal it replaces was `^0.1.0` for packages published at 17.x, which
 * never resolved to any published version at all (objectui#3827; the registry
 * has no 0.1.0 for `@object-ui/react`). A literal here is not merely a fossil
 * risk, it is a fossil generator: the fixed group re-versions on every release,
 * so any hard-coded range is stale the next day. Deriving it removes the class.
 */
function platformPackageRange(): string {
  return `^${cliVersion()}`;
}

/**
 * React's range in both generated manifests.
 *
 * Quotes the repo root verbatim (an exact pin there) rather than the wider
 * `^18.0.0 || ^19.0.0` the platform packages accept as a peer. The peer range
 * says what CAN work; this says what is actually exercised — inside this
 * workspace the temp app resolves React by hoisting to the root, so the root's
 * version is the only one the generated code has ever run against. Declaring
 * `^18.3.1`, as it did until objectui#3827, named a major nothing here tests.
 */
const REACT_RANGE = '19.2.8';

/**
 * `dependencies` for an app generated WITHOUT routing (`createTempApp`).
 *
 * Exactly the packages `src/main.tsx` and `src/App.tsx` import. No
 * `react-router-dom` and no `lucide-react`: this variant generates neither a
 * router nor a layout.
 */
function buildAppDependencies(): Record<string, string> {
  const range = platformPackageRange();
  return {
    react: REACT_RANGE,
    'react-dom': REACT_RANGE,
    ...Object.fromEntries(PLATFORM_RUNTIME_PACKAGES.map((name) => [name, range]))
  };
}

/**
 * `dependencies` for a routed app (`createTempAppWithRouting`).
 *
 * Adds the two packages the routed variant's own sources import and the plain
 * one's do not: `react-router-dom` (router in `src/App.tsx`) and `lucide-react`
 * (icons in `src/Layout.tsx`).
 *
 * `lucide-react` was imported and never declared until objectui#3827 — twice
 * over, `import * as LucideIcons` plus a named `{ Moon, Sun }`, both live in
 * the generated layout. `commands/dev.ts` had been papering over it in the
 * consumer, aliasing `lucide-react` to a path resolved out of
 * `packages/components` with the comment "avoid dependency not found in temp
 * app"; that alias only runs in monorepo mode, so every other path was left
 * with an unsatisfiable import. Declaring it at the producer is the fix — the
 * alias becomes a workspace convenience rather than the only thing holding the
 * import up.
 */
function buildRoutedAppDependencies(): Record<string, string> {
  const range = platformPackageRange();
  return {
    react: REACT_RANGE,
    'react-dom': REACT_RANGE,
    'react-router-dom': '^7.18.2',
    'lucide-react': '^1.28.0',
    ...Object.fromEntries(PLATFORM_RUNTIME_PACKAGES.map((name) => [name, range]))
  };
}


/**
 * `devDependencies` shared by both generated apps (identical in both today).
 *
 * Every range is anchored to an in-repo manifest, and
 * `app-generator.test.ts`'s `DEV_DEPENDENCY_ANCHORS` names the anchor for each
 * one and fails on an unanchored addition. The three Tailwind-side entries are
 * deliberately NOT anchored to the repo's Tailwind 4 — see
 * `TAILWIND_V3_DEFERRED` in that test file, and objectui#3852.
 */
const APP_DEV_DEPENDENCIES: Record<string, string> = {
  '@types/react': '19.2.18',
  '@types/react-dom': '19.2.4',
  '@vitejs/plugin-react': '^6.0.5',
  autoprefixer: '^10.5.4',
  postcss: '^8.5.26',
  tailwindcss: '^3.4.19',
  typescript: '^6.0.3',
  vite: '^8.2.0'
};

/** The generated `tsconfig.json`, identical for both generators. */
const APP_TSCONFIG = {
  compilerOptions: {
    target: 'ES2020',
    useDefineForClassFields: true,
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    skipLibCheck: true,
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    jsx: 'react-jsx',
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true
  },
  include: ['src']
};

/** The generated `postcss.config.js`, identical for both generators. */
const APP_POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

/**
 * Where the generator is running, as far as the generated files are concerned.
 *
 * Passed in rather than read from `process.cwd()` inside the builders so the
 * file map is a pure function of its inputs and can be asserted over directly.
 */
export interface AppGeneratorContext {
  /** The directory `objectui` was invoked from. */
  cwd: string;
  /** Whether `cwd` is a pnpm workspace root (root `node_modules` is reachable). */
  isMonorepo: boolean;
}

/** The context the CLI commands themselves generate under. */
function currentContext(): AppGeneratorContext {
  const cwd = process.cwd();
  return { cwd, isMonorepo: existsSync(join(cwd, 'pnpm-workspace.yaml')) };
}

/**
 * The generated `package.json` for an app without routing.
 *
 * In a monorepo both maps are written EMPTY, which is pre-existing behaviour:
 * the temp app lives under `<cwd>` and resolves everything by hoisting, and
 * `commands/dev.ts` skips `npm install` entirely there. The consequence worth
 * naming is that the ranges below are never the ranges exercised in this repo
 * (objectui#3742's second cost), which is exactly why the tests anchor them to
 * in-repo manifests instead of trusting a green command.
 */
export function buildAppPackageJson(context: Pick<AppGeneratorContext, 'isMonorepo'>): Record<string, unknown> {
  return {
    name: 'objectui-temp-app',
    private: true,
    type: 'module',
    // In monorepo, we use root node_modules, so we don't need dependencies here
    dependencies: context.isMonorepo ? {} : buildAppDependencies(),
    devDependencies: context.isMonorepo ? {} : { ...APP_DEV_DEPENDENCIES }
  };
}

/**
 * The generated `package.json` for a routed app.
 *
 * Unlike the variant above this one has no monorepo branch — it always writes
 * the full manifest, so a missing declaration here is missing everywhere and
 * cannot be explained away by hoisting.
 */
export function buildRoutedAppPackageJson(): Record<string, unknown> {
  return {
    name: 'objectui-temp-app',
    private: true,
    type: 'module',
    dependencies: buildRoutedAppDependencies(),
    devDependencies: { ...APP_DEV_DEPENDENCIES }
  };
}

/** The generated `tailwind.config.js`; content globs widen inside a monorepo. */
function buildTailwindConfig(context: AppGeneratorContext): string {
  // Define Tailwind Content Paths
  // Include JSON files specifically
  const contentPaths = ["'./index.html'", "'./src/**/*.{js,ts,jsx,tsx,json}'"];
  if (context.isMonorepo) {
    const componentsPath = join(context.cwd, 'packages/components/src/**/*.{ts,tsx}');
    const pluginsPath = join(context.cwd, 'packages/plugin-*/src/**/*.{ts,tsx}');
    contentPaths.push(`'${componentsPath}'`);
    contentPaths.push(`'${pluginsPath}'`);
  }

  return `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [${contentPaths.join(', ')}],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [],
};`;
}

/** Writes a generated file map onto `tmpDir`, creating nested directories. */
function writeGeneratedFiles(tmpDir: string, files: Record<string, string>): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = join(tmpDir, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
}

export function createTempApp(tmpDir: string, schema: unknown) {
  writeGeneratedFiles(tmpDir, buildAppFiles(schema, currentContext()));
}

/**
 * Every file `createTempApp` writes, as `relative path -> contents`.
 *
 * Exported so the tests assert over the SAME artifact the CLI writes rather
 * than over this file's source text — the shape objectui#3733/#3826 settled on
 * for the sibling generator, and the only way a structural gate (imports vs
 * declarations, entry reachability) can be written at all.
 */
export function buildAppFiles(schema: unknown, context: AppGeneratorContext): Record<string, string> {
  // Create index.html
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Object UI App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

  // Create main.tsx
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

  // Create App.tsx
  const appTsx = `import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-editor';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-form';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-view';

const schema = ${JSON.stringify(schema, null, 2)};

function App() {
  return <SchemaRenderer schema={schema} />;
}

export default App;`;

  // Create index.css
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

  return {
    'index.html': html,
    'src/main.tsx': mainTsx,
    'src/App.tsx': appTsx,
    'src/index.css': indexCss,
    'tailwind.config.js': buildTailwindConfig(context),
    'postcss.config.js': APP_POSTCSS_CONFIG,
    'package.json': JSON.stringify(buildAppPackageJson(context), null, 2),
    'tsconfig.json': JSON.stringify(APP_TSCONFIG, null, 2)
  };
}

export function createTempAppWithRouting(tmpDir: string, routes: RouteInfo[], appConfig?: unknown) {
  writeGeneratedFiles(tmpDir, buildRoutedAppFiles(routes, appConfig, currentContext()));
}

/**
 * Every file `createTempAppWithRouting` writes, as `relative path -> contents`.
 *
 * `src/main.tsx` is the entry — `index.html` loads exactly that one module — so
 * every other generated `src/**` module has to be reachable from it, which is
 * the reachability gate objectui#3826 established for the sibling generator and
 * `app-generator.test.ts` ports here. `src/Layout.tsx` is written only when
 * `appConfig` is present, precisely because that is the only case in which
 * `src/App.tsx` imports it.
 */
export function buildRoutedAppFiles(
  routes: RouteInfo[],
  appConfig: unknown,
  context: AppGeneratorContext
): Record<string, string> {
  const files: Record<string, string> = {};

  // Create index.html
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${(appConfig as any)?.title || 'Object UI App'}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

  files['index.html'] = html;

  const schemaImports: string[] = [];
  const routeComponents: string[] = [];

  routes.forEach((route, index) => {
    const schemaVarName = `schema${index}`;
    const schemaFileName = `page${index}.json`;

    // Add schema to the schemas directory
    files[`src/schemas/${schemaFileName}`] = JSON.stringify(route.schema, null, 2);

    // Add import statement
    schemaImports.push(`import ${schemaVarName} from './schemas/${schemaFileName}';`);

    // Add route component
    routeComponents.push(`        <Route path="${route.path}" element={<SchemaRenderer schema={${schemaVarName}} />} />`);
  });

  // Create theme-provider.tsx
  const themeProviderTsx = `import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}`;
  files['src/theme-provider.tsx'] = themeProviderTsx;

  // Create main.tsx
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from "./theme-provider"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);`;

  files['src/main.tsx'] = mainTsx;

  // Generate Layout Code if appConfig is present
  let layoutImport = '';
  let layoutWrapperStart = '';
  let layoutWrapperEnd = '';
  
  if (appConfig) {
      // Very basic Layout implementation for now
      // Logic: If appConfig is present, current version assumes it's just a config object, 
      // but we need a Layout component that renders navigation.
      // Since we don't have a Layout component in @object-ui/components yet, we generate a simple one.

      const layoutCode = `
import { Link, useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"
import { 
  cn,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
  SidebarTrigger,
  Separator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from '@object-ui/components'; 

const DynamicIcon = ({ name, className }) => {
  // @ts-expect-error - Dynamic icon lookup from Lucide icons
  const Icon = LucideIcons[name];
  if (!Icon) return null;
  return <Icon className={className} />;
};

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Switch Theme</span>
            <span className="truncate text-xs">Light / Dark</span>
          </div>
          <LucideIcons.ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <LucideIcons.Sun className="mr-2 size-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <LucideIcons.Moon className="mr-2 size-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <LucideIcons.Monitor className="mr-2 size-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const AppLayout = ({ app, children }) => {
  const location = useLocation();
  const menu = app.menu || [];
  
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center gap-2 px-2 py-2">
             <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
               {app.logo && <DynamicIcon name={app.logo} className="size-4" />}
               {!app.logo && <span className="text-xl font-bold">O</span>}
             </div>
             <div className="grid flex-1 text-left text-sm leading-tight">
               <span className="truncate font-semibold">{app.title || "Object UI"}</span>
               <span className="truncate text-xs">Showcase</span>
             </div>
           </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {menu.map((item, idx) => {
                 // Collapsible Item (Children present)
                 if (item.children && item.children.length > 0) {
                   const isActive = item.children.some(child => child.path === location.pathname);
                   return (
                     <Collapsible key={idx} asChild defaultOpen={isActive} className="group/collapsible">
                       <SidebarMenuItem>
                         <CollapsibleTrigger asChild>
                           <SidebarMenuButton tooltip={item.label}>
                             {item.icon && <DynamicIcon name={item.icon} />}
                             <span>{item.label}</span>
                             <DynamicIcon name="ChevronRight" className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                           </SidebarMenuButton>
                         </CollapsibleTrigger>
                         <CollapsibleContent>
                           <SidebarMenuSub>
                             {item.children.map((child, cIdx) => (
                               <SidebarMenuSubItem key={cIdx}>
                                 <SidebarMenuSubButton asChild isActive={location.pathname === child.path}>
                                   <Link to={child.path || '#'}>
                                      <span>{child.label}</span>
                                   </Link>
                                 </SidebarMenuSubButton>
                               </SidebarMenuSubItem>
                             ))}
                           </SidebarMenuSub>
                         </CollapsibleContent>
                       </SidebarMenuItem>
                     </Collapsible>
                   );
                 }

                 // Single Item
                 if (item.path) {
                   return (
                     <SidebarMenuItem key={idx}>
                       <SidebarMenuButton asChild isActive={location.pathname === item.path} tooltip={item.label}>
                         <Link to={item.path}>
                           {item.icon && <DynamicIcon name={item.icon} />}
                           <span>{item.label}</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   );
                 }
                 return null;
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <ModeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 items-center justify-between">
              <span className="font-medium">{app.title}</span>
            </div>
        </header>
        <div className="flex-1 flex flex-col min-h-0 bg-muted/20 p-4">
          <div className="mx-auto max-w-full w-full">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
`;
      files['src/Layout.tsx'] = layoutCode;
      
      layoutImport = `import AppLayout from './Layout';\nconst appConfig = ${JSON.stringify(appConfig)};`;
      layoutWrapperStart = `<AppLayout app={appConfig}>`;
      layoutWrapperEnd = `</AppLayout>`;
  }

  // Create App.tsx with routing
  const appTsx = `import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-editor';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-form';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-view';
${schemaImports.join('\n')}
${layoutImport}

function App() {
  return (
    <BrowserRouter>
      ${layoutWrapperStart}
      <Routes>
${routeComponents.join('\n')}
      </Routes>
      ${layoutWrapperEnd}
    </BrowserRouter>
  );
}

export default App;`;

  files['src/App.tsx'] = appTsx;

  // Create index.css with Tailwind
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased min-h-screen;
  }
}`;

  files['src/index.css'] = indexCss;

  files['tailwind.config.js'] = buildTailwindConfig(context);
  files['postcss.config.js'] = APP_POSTCSS_CONFIG;
  files['package.json'] = JSON.stringify(buildRoutedAppPackageJson(), null, 2);
  files['tsconfig.json'] = JSON.stringify(APP_TSCONFIG, null, 2);

  return files;
}
