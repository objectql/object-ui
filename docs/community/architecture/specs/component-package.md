---
title: "Component Package Specification"
---

## Overview

This specification defines the standard for creating, packaging, and distributing ObjectQL component packages. Developers can publish component packages as npm UMD modules, and end users can install them from an application marketplace.

## Package Structure

### 1. Directory Structure

```
my-component-package/
├── package.json              # Package metadata
├── README.md                 # Package documentation
├── LICENSE                   # License file
├── .npmignore               # Files to exclude from npm
├── src/
│   ├── components/          # Component implementations
│   │   ├── MyTable.tsx
│   │   ├── MyForm.tsx
│   │   └── MyChart.tsx
│   ├── index.ts            # Main entry point
│   └── types.ts            # TypeScript definitions
├── dist/                    # Build output (UMD)
│   ├── index.umd.js        # UMD bundle
│   ├── index.umd.js.map    # Source map
│   ├── index.d.ts          # Type definitions
│   └── style.css           # Compiled styles
├── metadata/               # Component metadata
│   ├── my_table.component.yml
│   ├── my_form.component.yml
│   └── my_chart.component.yml
├── examples/               # Usage examples
│   └── demo.tsx
├── tsconfig.json           # TypeScript config
├── rollup.config.js        # Build config
└── objectql.package.json   # ObjectQL package manifest
```

## 2. Package Manifest (objectql.package.json)

Every component package must include an `objectql.package.json` file:

```json
{
  "name": "@mycompany/awesome-components",
  "version": "1.0.0",
  "objectql_version": "^1.7.0",
  "type": "component_library",
  
  "metadata": {
    "displayName": "Awesome Components",
    "description": "A collection of beautiful UI components for ObjectQL",
    "author": "MyCompany",
    "homepage": "https://github.com/mycompany/awesome-components",
    "repository": "https://github.com/mycompany/awesome-components",
    "license": "MIT",
    "category": "ui-components",
    "tags": ["table", "form", "chart", "data-visualization"],
    "icon": "https://cdn.mycompany.com/icon.png",
    "screenshots": [
      "https://cdn.mycompany.com/screenshot1.png",
      "https://cdn.mycompany.com/screenshot2.png"
    ]
  },

  "components": {
    "my_table": {
      "name": "my_table",
      "label": "My Awesome Table",
      "category": "data_display",
      "metadata": "./metadata/my_table.component.yml",
      "implementation": "./dist/index.umd.js",
      "componentName": "MyTable",
      "exports": "MyTable"
    },
    "my_form": {
      "name": "my_form",
      "label": "My Awesome Form",
      "category": "data_entry",
      "metadata": "./metadata/my_form.component.yml",
      "implementation": "./dist/index.umd.js",
      "componentName": "MyForm",
      "exports": "MyForm"
    },
    "my_chart": {
      "name": "my_chart",
      "label": "My Awesome Chart",
      "category": "visualization",
      "metadata": "./metadata/my_chart.component.yml",
      "implementation": "./dist/index.umd.js",
      "componentName": "MyChart",
      "exports": "MyChart"
    }
  },

  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },

  "peerDependencies": {
    "@objectql/types": "^1.7.0",
    "tailwindcss": "^3.0.0"
  },

  "scripts": {
    "postinstall": "./scripts/setup.js"
  },

  "marketplace": {
    "price": "free",
    "trial_days": 0,
    "support_email": "support@mycompany.com",
    "documentation_url": "https://docs.mycompany.com/components",
    "changelog_url": "https://github.com/mycompany/awesome-components/releases"
  }
}
```

## 3. package.json (npm)

Standard npm package.json with UMD build configuration:

```json
{
  "name": "@mycompany/awesome-components",
  "version": "1.0.0",
  "description": "A collection of beautiful UI components for ObjectQL",
  "main": "dist/index.umd.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "metadata",
    "objectql.package.json",
    "README.md",
    "LICENSE"
  ],
  
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "prepublishOnly": "npm run build"
  },

  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@objectql/types": "^1.7.0"
  },

  "devDependencies": {
    "@rollup/plugin-commonjs": "^25.0.0",
    "@rollup/plugin-node-resolve": "^15.0.0",
    "@rollup/plugin-typescript": "^11.0.0",
    "rollup": "^3.0.0",
    "rollup-plugin-postcss": "^4.0.0",
    "typescript": "^5.0.0"
  },

  "keywords": [
    "objectql",
    "components",
    "react",
    "ui"
  ]
}
```

## 4. Build Configuration (rollup.config.js)

Build configuration for UMD output:

```javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'src/index.ts',
  
  output: [
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'AwesomeComponents',
      globals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        '@objectql/types': 'ObjectQLTypes'
      },
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],

  external: ['react', 'react-dom', '@objectql/types'],

  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist'
    }),
    postcss({
      extract: 'style.css',
      minimize: true
    })
  ]
};
```

## 5. Component Implementation

### src/index.ts

```typescript
// Export all components
export { MyTable } from './components/MyTable';
export { MyForm } from './components/MyForm';
export { MyChart } from './components/MyChart';

// Export types
export type {
  MyTableProps,
  MyFormProps,
  MyChartProps
} from './types';

// Version information
export const VERSION = '1.0.0';
export const OBJECTQL_VERSION = '^1.7.0';
```

### src/components/MyTable.tsx

```typescript
import React from 'react';
import type { ComponentProps } from '@objectql/types';

export interface MyTableProps extends ComponentProps {
  object: string;
  columns?: any[];
  sortable?: boolean;
  filterable?: boolean;
}

export const MyTable: React.FC<MyTableProps> = ({
  object,
  columns = [],
  sortable = true,
  filterable = true
}) => {
  return (
    <div className="my-table">
      {/* Component implementation */}
      <h2>My Awesome Table</h2>
      <p>Object: {object}</p>
    </div>
  );
};

// Default export for UMD
export default MyTable;
```

## 6. Component Metadata

### metadata/my_table.component.yml

```yaml
name: my_table
label: My Awesome Table
description: An advanced data table with sorting, filtering, and pagination
category: data_display
version: 1.0.0
author: MyCompany

# UMD specific configuration
umd:
  bundle: dist/index.umd.js
  global_name: AwesomeComponents
  export_name: MyTable
  styles: dist/style.css

implementation: MyTable
framework: react
render_mode: client

props:
  - name: object
    type: string
    required: true
    description: ObjectQL object name to display
  
  - name: columns
    type: array
    description: Column definitions
  
  - name: sortable
    type: boolean
    default: true
    description: Enable sorting
  
  - name: filterable
    type: boolean
    default: true
    description: Enable filtering

events:
  - name: onRowClick
    description: Fired when row is clicked
    payload: "{ row: Record, index: number }"

dependencies:
  - name: react
    version: "^18.0.0"
    type: library
  
  - name: "@objectql/types"
    version: "^1.7.0"
    type: library

features:
  realtime: true
  exportable: true
  responsive: true
  themeable: true

platforms:
  web: true
  mobile: true
  ssr: true
```

## 7. Installation & Usage

### For Developers (Publishing)

```bash
# Build the package
npm run build

# Test locally
npm link

# Publish to npm
npm publish --access public

# Publish to ObjectQL Marketplace
objectql publish --package ./objectql.package.json
```

### For End Users (Installing)

#### Method 1: Via npm

```bash
npm install @mycompany/awesome-components
```

#### Method 2: Via ObjectQL Marketplace

```bash
# Using CLI
objectql install @mycompany/awesome-components

# Or via Studio UI
# Navigate to Marketplace > Browse > Install
```

#### Method 3: Via Application Marketplace UI

```javascript
// In ObjectQL Studio or Application
{
  "packages": [
    {
      "name": "@mycompany/awesome-components",
      "version": "^1.0.0",
      "enabled": true
    }
  ]
}
```

### Using Installed Components

```yaml
# In your page metadata
components:
  - id: my_custom_table
    component: my_table  # Component from installed package
    props:
      object: projects
      sortable: true
      filterable: true
```

```tsx
// In React code
import { MyTable } from '@mycompany/awesome-components';

function MyPage() {
  return (
    <MyTable
      object="projects"
      columns={[...]}
      sortable={true}
    />
  );
}
```

## 8. Package Registry & Marketplace

### Package Registry Structure

```json
{
  "registry": {
    "@mycompany/awesome-components": {
      "name": "@mycompany/awesome-components",
      "latest": "1.0.0",
      "versions": {
        "1.0.0": {
          "published_at": "2024-01-15T00:00:00Z",
          "downloads": 1250,
          "rating": 4.8,
          "verified": true,
          "metadata": {
            "displayName": "Awesome Components",
            "description": "A collection of beautiful UI components",
            "category": "ui-components",
            "tags": ["table", "form", "chart"],
            "icon": "https://cdn.mycompany.com/icon.png"
          },
          "components": [
            "my_table",
            "my_form",
            "my_chart"
          ],
          "tarball": "https://registry.npmjs.org/@mycompany/awesome-components/-/awesome-components-1.0.0.tgz",
          "integrity": "sha512-..."
        }
      }
    }
  }
}
```

### Marketplace API

```typescript
// GET /api/marketplace/packages
// List all available packages

// GET /api/marketplace/packages/@mycompany/awesome-components
// Get package details

// POST /api/marketplace/install
{
  "package": "@mycompany/awesome-components",
  "version": "1.0.0"
}

// POST /api/marketplace/uninstall
{
  "package": "@mycompany/awesome-components"
}

// GET /api/marketplace/installed
// List installed packages
```

## 9. Package Validation

Every package must pass validation before being published to the marketplace:

```bash
# Validate package structure
objectql validate-package

# Validation checks:
# ✓ objectql.package.json exists and is valid
# ✓ All component metadata files exist
# ✓ UMD bundle exists and is valid
# ✓ Type definitions exist
# ✓ README.md exists
# ✓ LICENSE file exists
# ✓ Version follows semver
# ✓ Components are properly exported
# ✓ Dependencies are declared
# ✓ No security vulnerabilities
```

## 10. Security & Quality Standards

### Required Files
- `LICENSE` - Package license
- `README.md` - Documentation
- `CHANGELOG.md` - Version history
- `SECURITY.md` - Security policy

### Quality Checks
- TypeScript type definitions
- Unit tests (coverage > 80%)
- ESLint configuration
- Prettier formatting
- No vulnerabilities in dependencies
- Bundle size < 500KB
- Tree-shakeable exports
- SSR compatible

### Metadata Requirements
- Valid component metadata YAML
- Complete prop definitions
- Event definitions
- Examples
- AI context
- Accessibility information

## 11. Versioning & Updates

Follow semantic versioning:

```
1.0.0 → 1.0.1 (patch)   - Bug fixes
1.0.0 → 1.1.0 (minor)   - New features, backward compatible
1.0.0 → 2.0.0 (major)   - Breaking changes
```

### Update Process

```bash
# Publish new version
npm version patch  # or minor, major
npm run build
npm publish

# Update in marketplace
objectql publish --update
```

### Auto-Update Configuration

```json
{
  "auto_update": {
    "enabled": true,
    "channel": "stable",  // stable, beta, alpha
    "strategy": "minor"   // patch, minor, major
  }
}
```

## 12. Example: Complete Package

See the example package in `examples/component-packages/awesome-components/` for a complete, working implementation.

## 13. Best Practices

1. **Single Responsibility**: Each component should do one thing well
2. **Tree Shaking**: Use ES modules for better tree shaking
3. **Bundle Size**: Keep UMD bundle under 500KB
4. **Type Safety**: Always include TypeScript definitions
5. **Documentation**: Provide comprehensive README and examples
6. **Testing**: Include unit tests with good coverage
7. **Accessibility**: Follow WCAG 2.1 AA standards
8. **Performance**: Optimize for production (minify, compress)
9. **Compatibility**: Test with different ObjectQL versions
10. **Licensing**: Clearly specify license terms

## 14. Support & Maintenance

### Required Support Channels
- GitHub Issues
- Support email
- Documentation site
- Changelog

### Deprecation Policy
- Announce deprecation 6 months in advance
- Provide migration guide
- Support old version for 1 year
- Clear upgrade path

## 15. Related Specifications

- [Component Metadata Specification](../component.md)
- [ObjectQL Package Format](./package-format.md)
- [Marketplace API Specification](./marketplace-api.md)
- [Security Guidelines](./security.md)
