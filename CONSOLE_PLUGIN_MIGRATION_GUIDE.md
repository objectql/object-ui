# Console Plugin Migration Guide

## Step-by-Step Implementation Guide

This guide provides detailed instructions for transforming `@object-ui/console` into a publishable plugin and integrating it with HotCRM.

---

## Prerequisites

- Node.js 18+ with pnpm 10.28.2+
- Understanding of React, TypeScript, and Vite
- Familiarity with ObjectUI architecture
- Access to ObjectUI monorepo

---

## Phase 1: Package Restructuring

### Step 1.1: Relocate Console Package

```bash
# Create new plugin package directory
mkdir -p packages/plugin-console

# Move console files (preserve git history)
git mv apps/console/* packages/plugin-console/
git mv apps/console/.env.production packages/plugin-console/
git mv apps/console/.gitignore packages/plugin-console/

# Remove old directory
rmdir apps/console
```

### Step 1.2: Update Package Configuration

Edit `packages/plugin-console/package.json`:

```json
{
  "name": "@object-ui/plugin-console",
  "version": "2.0.0",
  "private": false,  // ← Changed from true
  "description": "Console plugin for ObjectStack applications - provides CRUD UI and admin features",
  "type": "module",
  "license": "MIT",
  
  // Library exports
  "main": "dist/index.umd.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.umd.cjs"
    },
    "./app": {
      "types": "./dist/app.d.ts",
      "import": "./dist/app.js"
    }
  },
  
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  
  "scripts": {
    "dev": "pnpm msw:init && vite",
    "build": "pnpm build:lib && pnpm build:app",
    "build:lib": "vite build --mode lib",
    "build:app": "pnpm msw:init && vite build --mode app",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  
  // Move to peer dependencies
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "react-router-dom": "^7.0.0",
    "@object-ui/core": "workspace:*",
    "@object-ui/components": "workspace:*",
    "@object-ui/react": "workspace:*",
    "@object-ui/auth": "workspace:*",
    "@object-ui/i18n": "workspace:*",
    "@object-ui/layout": "workspace:*",
    "@object-ui/types": "workspace:*"
  },
  
  // Minimal direct dependencies
  "dependencies": {
    "clsx": "^2.1.0",
    "lucide-react": "^0.563.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^2.2.1"
  },
  
  "devDependencies": {
    "@objectstack/cli": "^3.0.0",
    "@tailwindcss/postcss": "^4.1.18",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^25.2.2",
    "@types/react": "^19.2.13",
    "@vitejs/plugin-react": "^5.1.3",
    "happy-dom": "^20.5.3",
    "msw": "^2.12.9",
    "typescript": "^5.9.3",
    "vite": "^6.0.11",
    "vite-plugin-dts": "^4.5.4",
    "vitest": "^4.0.18"
  }
}
```

### Step 1.3: Update Workspace Configuration

Edit `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'  # Remove if no other apps remain
  # ... rest of config
```

Update `turbo.json` if needed to reflect new package location.

---

## Phase 2: Create Dual Build Configuration

### Step 2.1: Create Vite Configuration for Library Build

Create `packages/plugin-console/vite.config.ts`:

```typescript
import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLibMode = mode === 'lib';
  
  const baseConfig: UserConfig = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.ts'],
      passWithNoTests: true,
    },
  };

  if (isLibMode) {
    // Library build configuration
    return {
      ...baseConfig,
      plugins: [
        ...baseConfig.plugins!,
        dts({
          insertTypesEntry: true,
          include: ['src'],
          exclude: [
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/app-entry/**',
            '**/mocks/**',
            '**/pages/**',
            'node_modules'
          ],
          skipDiagnostics: true,
        }),
      ],
      build: {
        lib: {
          entry: {
            index: resolve(__dirname, 'src/index.tsx'),
            app: resolve(__dirname, 'src/app.tsx'),
          },
          name: 'ObjectUIPluginConsole',
          fileName: (format, entryName) => 
            `${entryName}.${format === 'es' ? 'js' : 'umd.cjs'}`,
        },
        rollupOptions: {
          external: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react-router-dom',
            '@object-ui/auth',
            '@object-ui/components',
            '@object-ui/core',
            '@object-ui/i18n',
            '@object-ui/layout',
            '@object-ui/react',
            '@object-ui/types',
            '@object-ui/fields',
            '@object-ui/plugin-dashboard',
            '@object-ui/plugin-report',
            '@object-ui/plugin-grid',
            '@object-ui/plugin-kanban',
            '@object-ui/plugin-calendar',
            '@object-ui/plugin-gantt',
            '@object-ui/plugin-charts',
            '@object-ui/plugin-list',
            '@object-ui/plugin-detail',
            '@object-ui/plugin-timeline',
            '@object-ui/plugin-map',
            '@object-ui/plugin-view',
            '@object-ui/plugin-form',
            '@object-ui/plugin-markdown',
            '@objectstack/client',
            '@objectstack/spec',
            'lucide-react',
            'sonner',
          ],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react-router-dom': 'ReactRouterDOM',
              '@object-ui/core': 'ObjectUICore',
              '@object-ui/components': 'ObjectUIComponents',
              '@object-ui/react': 'ObjectUIReact',
            },
          },
        },
        sourcemap: true,
        minify: 'esbuild',
      },
    };
  } else {
    // App build configuration (unchanged from original)
    return {
      ...baseConfig,
      build: {
        outDir: 'dist/app',
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
          },
        },
        sourcemap: true,
      },
    };
  }
});
```

---

## Phase 3: Restructure Source Code

### Step 3.1: Create New Directory Structure

```bash
cd packages/plugin-console/src

# Create new directories
mkdir -p lib
mkdir -p app-entry

# Move files
# - Keep components/ as-is (will be exported)
# - Keep hooks/ as-is (will be exported)
# - Move main.tsx and App.tsx to app-entry/
mv main.tsx app-entry/
mv App.tsx app-entry/
```

### Step 3.2: Create Library Entry Point

Create `packages/plugin-console/src/index.tsx`:

```typescript
/**
 * @object-ui/plugin-console
 * 
 * Console plugin for ObjectStack applications.
 * Provides CRUD interfaces, dashboards, and admin features.
 * 
 * @module @object-ui/plugin-console
 */

import { ComponentRegistry } from '@object-ui/core';

// Import components
import { ConsoleLayout } from './components/ConsoleLayout';
import { ObjectView } from './components/ObjectView';
import { DashboardView } from './components/DashboardView';
import { ReportView } from './components/ReportView';
import { RecordDetailView } from './components/RecordDetailView';
import { PageView } from './components/PageView';

/**
 * Register console components with ComponentRegistry
 * 
 * These registrations are side-effects that occur when the plugin is imported.
 * Components become available to the SchemaRenderer automatically.
 */

ComponentRegistry.register('console-layout', ConsoleLayout, {
  namespace: 'console',
  label: 'Console Layout',
  category: 'Layout',
  icon: 'layout',
  description: 'Full console application layout with sidebar and header',
  inputs: [
    { 
      name: 'appConfig', 
      type: 'object', 
      label: 'App Configuration',
      required: true,
      description: 'ObjectStack application configuration'
    },
  ],
});

ComponentRegistry.register('object-view', ObjectView, {
  namespace: 'console',
  label: 'Object View',
  category: 'Views',
  icon: 'table',
  description: 'CRUD interface for ObjectStack objects',
  inputs: [
    { 
      name: 'objectName', 
      type: 'string', 
      label: 'Object Name',
      required: true,
      description: 'Name of the object to display'
    },
    { 
      name: 'viewName', 
      type: 'string', 
      label: 'View Name',
      description: 'Specific view configuration to use'
    },
    {
      name: 'defaultView',
      type: 'enum',
      label: 'Default View Type',
      enum: [
        { label: 'Grid', value: 'grid' },
        { label: 'Kanban', value: 'kanban' },
        { label: 'Calendar', value: 'calendar' },
        { label: 'List', value: 'list' },
      ],
      defaultValue: 'grid'
    },
  ],
  defaultProps: {
    defaultView: 'grid',
  },
});

ComponentRegistry.register('dashboard-view', DashboardView, {
  namespace: 'console',
  label: 'Dashboard View',
  category: 'Views',
  icon: 'layout-dashboard',
  description: 'Render a dashboard by ID',
  inputs: [
    { 
      name: 'dashboardId', 
      type: 'string', 
      label: 'Dashboard ID',
      required: true 
    },
  ],
});

ComponentRegistry.register('report-view', ReportView, {
  namespace: 'console',
  label: 'Report View',
  category: 'Views',
  icon: 'file-bar-chart',
  description: 'Render a report by ID',
  inputs: [
    { 
      name: 'reportId', 
      type: 'string', 
      label: 'Report ID',
      required: true 
    },
  ],
});

ComponentRegistry.register('record-detail', RecordDetailView, {
  namespace: 'console',
  label: 'Record Detail',
  category: 'Views',
  icon: 'file-text',
  description: 'Display a single record in detail view',
  inputs: [
    { name: 'objectName', type: 'string', required: true },
    { name: 'recordId', type: 'string', required: true },
  ],
});

ComponentRegistry.register('page-view', PageView, {
  namespace: 'console',
  label: 'Page View',
  category: 'Views',
  icon: 'file',
  description: 'Render a custom page by ID',
  inputs: [
    { name: 'pageId', type: 'string', required: true },
  ],
});

// Export all components for manual use
export {
  ConsoleLayout,
  ObjectView,
  DashboardView,
  ReportView,
  RecordDetailView,
  PageView,
};

// Export other commonly used components
export { AppSidebar } from './components/AppSidebar';
export { AppHeader } from './components/AppHeader';
export { CommandPalette } from './components/CommandPalette';
export { SearchResultsPage } from './components/SearchResultsPage';
export { ErrorBoundary } from './components/ErrorBoundary';
export { LoadingScreen } from './components/LoadingScreen';

// Export hooks
export { useObjectActions } from './hooks/useObjectActions';
export { useRecentItems } from './hooks/useRecentItems';
export { useFavorites } from './hooks/useFavorites';
export { useBranding } from './hooks/useBranding';

// Export types
export type { 
  ObjectViewProps 
} from './components/ObjectView';
export type { 
  DashboardViewProps 
} from './components/DashboardView';
export type { 
  ReportViewProps 
} from './components/ReportView';

// Note: Full app export is in app.tsx
```

### Step 3.3: Create App Entry Point

Create `packages/plugin-console/src/app.tsx`:

```typescript
/**
 * Full Console Application Export
 * 
 * This module exports the complete console application as a single
 * React component that can be embedded in other applications.
 */

import { BrowserRouter, type BrowserRouterProps } from 'react-router-dom';
import { I18nProvider } from '@object-ui/i18n';
import { AuthProvider } from '@object-ui/auth';
import { SchemaRendererProvider } from '@object-ui/react';
import { ThemeProvider } from './components/theme-provider';
import { ConsoleToaster } from './components/ConsoleToaster';

// Import the main app component
import { AppContent } from './app-entry/App';

// Import all plugins for standalone mode
// Consumers using library mode must import these themselves
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';
import '@object-ui/plugin-view';
import '@object-ui/plugin-form';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-report';
import '@object-ui/plugin-markdown';

export interface ConsoleAppProps {
  /**
   * ObjectStack application configuration
   * Includes apps, objects, branding, etc.
   */
  appConfig: any;
  
  /**
   * Data source adapter for ObjectStack operations
   * If not provided, will use default initialization
   */
  dataSource?: any;
  
  /**
   * Base path for routing
   * @default "/"
   */
  basename?: string;
  
  /**
   * Whether to use hash-based routing instead of history API
   * @default false
   */
  useHashRouter?: boolean;
}

/**
 * Console Application Component
 * 
 * A complete ObjectStack console application that can be embedded
 * in other React applications.
 * 
 * @example
 * ```tsx
 * import { ConsoleApp } from '@object-ui/plugin-console/app';
 * 
 * function MyApp() {
 *   return (
 *     <ConsoleApp 
 *       appConfig={myConfig}
 *       dataSource={myDataSource}
 *       basename="/admin"
 *     />
 *   );
 * }
 * ```
 */
export function ConsoleApp({ 
  appConfig, 
  dataSource, 
  basename = '/',
  useHashRouter = false,
}: ConsoleAppProps) {
  const RouterComponent = useHashRouter 
    ? require('react-router-dom').HashRouter 
    : BrowserRouter;
    
  const routerProps: BrowserRouterProps = useHashRouter 
    ? {} 
    : { basename };

  return (
    <RouterComponent {...routerProps}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider config={appConfig.auth}>
            <SchemaRendererProvider dataSource={dataSource}>
              <AppContent />
              <ConsoleToaster />
            </SchemaRendererProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </RouterComponent>
  );
}

// Re-export for convenience
export { AppContent } from './app-entry/App';
```

### Step 3.4: Update App Entry Files

Edit `packages/plugin-console/src/app-entry/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { ConsoleApp } from '../app';
import appConfig from '../../objectstack.shared';

// Start MSW before rendering the app (dev mode only)
async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCK_SERVER !== 'false') {
    const { startMockServer } = await import('../mocks/browser');
    await startMockServer();
  }

  // Render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConsoleApp appConfig={appConfig} />
    </React.StrictMode>
  );
}

bootstrap();
```

---

## Phase 4: Testing

### Step 4.1: Update Test Configuration

Edit `packages/plugin-console/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/app-entry/',
        'src/mocks/',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### Step 4.2: Run Tests

```bash
cd packages/plugin-console

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm vitest run --coverage
```

---

## Phase 5: Build and Verify

### Step 5.1: Build Library

```bash
cd packages/plugin-console

# Build library only
pnpm build:lib

# Verify output
ls -lah dist/
# Should see: index.js, index.umd.cjs, index.d.ts, app.js, app.d.ts
```

### Step 5.2: Build Standalone App

```bash
# Build app only
pnpm build:app

# Verify output
ls -lah dist/app/
# Should see: index.html, assets/, etc.
```

### Step 5.3: Build Both

```bash
# Build everything
pnpm build

# Check bundle sizes
du -sh dist/
du -sh dist/app/
```

---

## Phase 6: HotCRM Integration

### Step 6.1: Install Plugin in HotCRM

```bash
cd /path/to/hotcrm

# Add dependency
pnpm add @object-ui/plugin-console@workspace:*

# Or if published to npm:
pnpm add @object-ui/plugin-console@^2.0.0
```

### Step 6.2: Option A - Use Full Console App

Create `hotcrm/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConsoleApp } from '@object-ui/plugin-console/app';
import { hotcrmConfig } from './config';
import { createDataSource } from './datasource';

// Import any additional plugins HotCRM needs
import '@object-ui/plugin-custom-crm';

const dataSource = createDataSource();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConsoleApp 
      appConfig={hotcrmConfig}
      dataSource={dataSource}
    />
  </React.StrictMode>
);
```

### Step 6.3: Option B - Use Console Components

Create `hotcrm/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@object-ui/i18n';
import { SchemaRendererProvider } from '@object-ui/react';
import { 
  ConsoleLayout, 
  ObjectView,
  DashboardView 
} from '@object-ui/plugin-console';
import { HotCRMDashboard } from './components/Dashboard';

// Import plugins
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';

function HotCRMApp() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <SchemaRendererProvider dataSource={dataSource}>
          <ConsoleLayout appConfig={hotcrmConfig}>
            <Routes>
              {/* Use console's ObjectView */}
              <Route 
                path="/:app/objects/:objectName" 
                element={<ObjectView />} 
              />
              
              {/* Custom HotCRM dashboard */}
              <Route 
                path="/dashboard" 
                element={<HotCRMDashboard />} 
              />
              
              {/* Use console's dashboard view */}
              <Route 
                path="/reports/:dashboardId" 
                element={<DashboardView />} 
              />
            </Routes>
          </ConsoleLayout>
        </SchemaRendererProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default HotCRMApp;
```

### Step 6.4: Create HotCRM Configuration

Create `hotcrm/src/config.ts`:

```typescript
import type { ObjectStackConfig } from '@objectstack/spec';
import { CRMPlugin } from '@hotcrm/crm';
import { FinancePlugin } from '@hotcrm/finance';
import { MarketingPlugin } from '@hotcrm/marketing';

// Merge all HotCRM plugin metadata
const allPlugins = [CRMPlugin, FinancePlugin, MarketingPlugin];

export const hotcrmConfig: ObjectStackConfig = {
  branding: {
    name: 'HotCRM',
    logo: '/hotcrm-logo.svg',
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
  },
  
  apps: allPlugins.flatMap(plugin => plugin.apps || []),
  
  objects: allPlugins.flatMap(plugin => 
    Object.values(plugin.objects || {})
  ),
  
  auth: {
    providers: ['email', 'google'],
    enableRegistration: false,
  },
  
  features: {
    enableDesigner: false,
    enableAuditLog: true,
  },
};
```

---

## Phase 7: Publishing

### Step 7.1: Prepare for Publishing

```bash
cd packages/plugin-console

# Ensure package.json is correct
cat package.json

# Create README if not exists
cat > README.md << 'EOF'
# @object-ui/plugin-console

Console plugin for ObjectStack applications.

## Installation

\`\`\`bash
pnpm add @object-ui/plugin-console
\`\`\`

## Usage

See [documentation](https://objectui.dev/docs/plugins/console) for details.
EOF

# Ensure LICENSE exists (copy from root if needed)
cp ../../LICENSE ./LICENSE
```

### Step 7.2: Build for Production

```bash
# Clean previous builds
rm -rf dist/

# Build everything
pnpm build

# Verify bundle sizes
du -sh dist/*
```

### Step 7.3: Publish to npm

```bash
# Login to npm (if not already)
npm login

# Publish (dry run first)
npm publish --dry-run

# Publish for real
npm publish --access public

# Or use changesets
pnpm changeset
pnpm changeset version
pnpm changeset publish
```

---

## Phase 8: Documentation

### Step 8.1: Update Main README

Update `packages/plugin-console/README.md`:

````markdown
# @object-ui/plugin-console

> Console plugin for ObjectStack applications - provides CRUD interfaces, dashboards, and admin features.

## Features

- 🎯 **Complete CRUD Interface** - Grid, Kanban, Calendar, List views
- 📊 **Dashboard & Reports** - Pre-built widgets and visualizations
- 🔐 **Authentication & Authorization** - Built-in auth pages and guards
- 🎨 **Theming** - Full Tailwind + Shadcn UI customization
- 🌍 **Internationalization** - 10+ languages supported
- 📱 **Responsive** - Mobile-first design

## Installation

```bash
pnpm add @object-ui/plugin-console
```

## Quick Start

### Option 1: Full Console App

```typescript
import { ConsoleApp } from '@object-ui/plugin-console/app';

function MyApp() {
  return (
    <ConsoleApp 
      appConfig={myConfig}
      dataSource={myDataSource}
    />
  );
}
```

### Option 2: Individual Components

```typescript
import { ObjectView, ConsoleLayout } from '@object-ui/plugin-console';
import '@object-ui/plugin-grid';

function MyApp() {
  return (
    <ConsoleLayout appConfig={config}>
      <ObjectView objectName="contacts" />
    </ConsoleLayout>
  );
}
```

## API Reference

See [full documentation](https://objectui.dev/docs/plugins/console).

## License

MIT © ObjectStack Inc.
````

---

## Troubleshooting

### Build Issues

**Problem:** Type errors during build

```
Solution: Ensure all peer dependencies are installed:
pnpm install --frozen-lockfile
```

**Problem:** "Cannot find module" errors

```
Solution: Check vite.config.ts aliases and tsconfig.json paths match
```

### Runtime Issues

**Problem:** Components not registered

```typescript
// Solution: Import plugin in consuming app
import '@object-ui/plugin-console';
```

**Problem:** Styles not loading

```typescript
// Solution: Import CSS in your app
import '@object-ui/plugin-console/dist/style.css';
```

### Integration Issues

**Problem:** Duplicate React instances

```
Solution: Use peerDependencies correctly and ensure single React version:
pnpm why react
```

---

## Checklist

Before publishing:

- [ ] Package version updated
- [ ] CHANGELOG.md updated
- [ ] README.md complete with examples
- [ ] All tests passing
- [ ] Build succeeds (lib + app)
- [ ] Types generated correctly
- [ ] License file included
- [ ] `.npmignore` configured (or use `files` in package.json)
- [ ] Documentation updated
- [ ] Breaking changes documented

---

## Support

- 📖 [Documentation](https://objectui.dev)
- 🐛 [Issue Tracker](https://github.com/objectstack-ai/objectui/issues)
- 💬 [Discussions](https://github.com/objectstack-ai/objectui/discussions)

---

*Last Updated: 2026-02-13*
