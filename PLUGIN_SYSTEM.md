# Plugin System Enhancements

This document describes the enhanced plugin system for ObjectUI, including dependency management, lifecycle hooks, lazy loading, and the plugin scaffolding CLI.

## Overview

The ObjectUI plugin system has been enhanced with three major improvements:

1. **Plugin Registration Enhancement**: Dependency management and lifecycle hooks
2. **Plugin Lazy Loading**: Optimized loading with suspense and fallback support
3. **Plugin Development Template**: CLI tool for scaffolding new plugins

## 1. Plugin Registration Enhancement

### PluginDefinition Interface

Plugins can now declare dependencies and implement lifecycle hooks:

```typescript
import { PluginSystem, ComponentRegistry } from '@object-ui/core';

const myPlugin: PluginDefinition = {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['base-plugin'], // Optional: plugins this plugin depends on
  peerDependencies: ['@object-ui/core'], // Optional: npm peer dependencies
  
  // Register components
  register: (registry) => {
    registry.register('my-component', MyComponent, {
      label: 'My Component',
      category: 'plugin'
    });
  },
  
  // Optional: Called after registration
  onLoad: async () => {
    console.log('Plugin loaded!');
    // Perform async initialization
  },
  
  // Optional: Called before unload
  onUnload: async () => {
    console.log('Plugin unloaded!');
    // Cleanup resources
  }
};
```

### PluginSystem Class

The `PluginSystem` class manages plugin loading, dependency resolution, and lifecycle:

```typescript
import { PluginSystem, ComponentRegistry } from '@object-ui/core';

const pluginSystem = new PluginSystem();

// Load plugins in dependency order (pass registry for component registration)
await pluginSystem.loadPlugin(basePlugin, ComponentRegistry);
await pluginSystem.loadPlugin(dependentPlugin, ComponentRegistry); // Requires basePlugin

// Check plugin status
if (pluginSystem.isLoaded('my-plugin')) {
  console.log('Plugin is loaded');
}

// Get plugin info
const plugin = pluginSystem.getPlugin('my-plugin');
console.log(plugin.version);

// Unload plugin (checks for dependents first)
await pluginSystem.unloadPlugin('my-plugin');
```

### Dependency Management

The plugin system enforces dependency order:

```typescript
// ❌ This will throw an error
await pluginSystem.loadPlugin({
  name: 'dependent-plugin',
  version: '1.0.0',
  dependencies: ['missing-plugin'], // Not loaded yet
  register: () => {}
}, ComponentRegistry);
// Error: Missing dependency: missing-plugin required by dependent-plugin

// ✅ Load in correct order
await pluginSystem.loadPlugin(basePlugin, ComponentRegistry);
await pluginSystem.loadPlugin(dependentPlugin, ComponentRegistry);
```

The system also prevents unloading plugins that other plugins depend on:

```typescript
await pluginSystem.loadPlugin(basePlugin, ComponentRegistry);
await pluginSystem.loadPlugin(dependentPlugin, ComponentRegistry); // depends on basePlugin

// ❌ This will throw an error
await pluginSystem.unloadPlugin('base-plugin');
// Error: Cannot unload plugin "base-plugin" - plugin "dependent-plugin" depends on it
```

## 2. Plugin Lazy Loading

### createLazyPlugin Utility

The `createLazyPlugin` function enables lazy loading of plugin components with built-in Suspense handling:

```typescript
import { createLazyPlugin } from '@object-ui/react';
import { Skeleton } from '@object-ui/components';

// Basic usage - loads when first rendered
const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid')
);

// With custom fallback
const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <Skeleton className="w-full h-[400px]" /> }
);

// With custom loading message
const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <div>Loading grid plugin...</div> }
);

// Use the component
function MyApp() {
  return <ObjectGrid data={myData} />;
}
```

### Benefits

- **Reduced Initial Bundle Size**: Plugins are only loaded when needed
- **Better Performance**: Faster initial page load
- **User Experience**: Smooth loading with fallback UI
- **Code Splitting**: Automatic webpack/vite code splitting

### Migration from Static Imports

**Before:**
```typescript
import { ObjectGrid } from '@object-ui/plugin-grid';
```

**After:**
```typescript
const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <Skeleton /> }
);
```

## 3. Plugin Development Template

### Using the CLI

Create a new plugin with the scaffolding tool:

```bash
# Interactive mode
pnpm create-plugin

# With plugin name
pnpm create-plugin my-awesome-plugin

# With all options
pnpm create-plugin my-awesome-plugin \
  --description "My awesome plugin for ObjectUI" \
  --author "Your Name"
```

### Generated Structure

The CLI generates a complete plugin package:

```
packages/plugin-my-awesome-plugin/
├── src/
│   ├── index.tsx                 # Plugin export & ComponentRegistry registration
│   ├── MyAwesomePluginImpl.tsx   # Component implementation
│   ├── MyAwesomePluginImpl.test.tsx  # Vitest tests
│   └── types.ts                  # TypeScript type definitions & schema
├── package.json                  # Package configuration with workspace deps
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
└── README.md                     # Plugin documentation
```

### Generated Files Overview

#### `src/index.tsx`
```typescript
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { MyAwesomePlugin } from './MyAwesomePluginImpl';

export { MyAwesomePlugin };
export type { MyAwesomePluginProps } from './MyAwesomePluginImpl';

// Register component with ComponentRegistry
const MyAwesomePluginRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <MyAwesomePlugin {...schema} />;
};

ComponentRegistry.register('my-awesome-plugin', MyAwesomePluginRenderer, {
  label: 'My Awesome Plugin',
  category: 'plugin',
  inputs: [
    // Define your component inputs here
  ],
  defaultProps: {
    // Define default props here
  }
});
```

#### `src/MyAwesomePluginImpl.tsx`
```typescript
import React from 'react';

export interface MyAwesomePluginProps {
  className?: string;
  // Add your props here
}

export const MyAwesomePlugin: React.FC<MyAwesomePluginProps> = ({ className }) => {
  return (
    <div className={className}>
      <h2>MyAwesomePlugin Plugin</h2>
      <p>Implement your plugin logic here.</p>
    </div>
  );
};
```

#### `src/types.ts`
```typescript
export interface MyAwesomePluginSchema {
  type: 'my-awesome-plugin';
  id?: string;
  className?: string;
  // Add schema properties here
}
```

### Development Workflow

1. **Create the plugin:**
   ```bash
   pnpm create-plugin my-plugin
   ```

2. **Navigate to plugin directory:**
   ```bash
   cd packages/plugin-my-plugin
   ```

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Implement your plugin:**
   - Edit `src/MyPluginImpl.tsx` for component logic
   - Edit `src/types.ts` for schema definitions
   - Update `src/index.tsx` for ComponentRegistry metadata

5. **Run tests:**
   ```bash
   pnpm test
   ```

6. **Build the plugin:**
   ```bash
   pnpm build
   ```

7. **Use in your app:**
   ```typescript
   import { MyPlugin } from '@object-ui/plugin-my-plugin';
   ```

### Best Practices

1. **Component Props**: Always define a clear TypeScript interface for your props
2. **Schema Definition**: Create a schema interface in `types.ts` for JSON schema validation
3. **Testing**: Write tests for your component in `*.test.tsx` files
4. **Documentation**: Update the generated README.md with usage examples
5. **Exports**: Export both the component and its props interface
6. **Registration**: Register your component with meaningful metadata (label, category, inputs)

### Plugin Template Conventions

The generated plugin follows ObjectUI best practices:

- ✅ TypeScript strict mode
- ✅ Workspace dependencies (`workspace:*`)
- ✅ React 18/19 peer dependencies
- ✅ Vite for building (fast, modern)
- ✅ Vitest for testing
- ✅ ESLint configuration
- ✅ ComponentRegistry integration
- ✅ Proper type exports

## Integration Example

Here's a complete example using all three enhancements:

```typescript
import { PluginSystem, ComponentRegistry } from '@object-ui/core';
import { createLazyPlugin } from '@object-ui/react';

// 1. Create lazy-loaded plugin components
const GridPlugin = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <div>Loading Grid...</div> }
);

const ChartPlugin = createLazyPlugin(
  () => import('@object-ui/plugin-charts'),
  { fallback: <div>Loading Charts...</div> }
);

// 2. Define plugins with dependencies
const gridPluginDef = {
  name: 'grid-plugin',
  version: '1.0.0',
  register: (registry) => {
    registry.register('grid', GridPlugin);
  },
  onLoad: async () => {
    console.log('Grid plugin loaded');
  }
};

const chartPluginDef = {
  name: 'chart-plugin',
  version: '1.0.0',
  dependencies: ['grid-plugin'], // Charts depend on grid
  register: (registry) => {
    registry.register('chart', ChartPlugin);
  },
  onLoad: async () => {
    console.log('Chart plugin loaded');
  }
};

// 3. Load plugins in order
const pluginSystem = new PluginSystem();

async function initPlugins() {
  await pluginSystem.loadPlugin(gridPluginDef, ComponentRegistry);
  await pluginSystem.loadPlugin(chartPluginDef, ComponentRegistry);
  
  // All plugins are now registered and ready to use
  console.log('Loaded plugins:', pluginSystem.getLoadedPlugins());
}

initPlugins();
```

## API Reference

### PluginDefinition

```typescript
interface PluginDefinition {
  name: string;
  version: string;
  dependencies?: string[];
  peerDependencies?: string[];
  register: (registry: Registry) => void;
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
}
```

### PluginSystem

```typescript
class PluginSystem {
  loadPlugin(plugin: PluginDefinition, registry: Registry): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  isLoaded(name: string): boolean;
  getPlugin(name: string): PluginDefinition | undefined;
  getLoadedPlugins(): string[];
  getAllPlugins(): PluginDefinition[];
}
```

### createLazyPlugin

```typescript
function createLazyPlugin<P = any>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  options?: { fallback?: React.ReactNode }
): React.ComponentType<P>;
```

## Migration Guide

### For Plugin Authors

If you're maintaining an existing plugin, here's how to migrate:

1. **Add plugin definition:**
   ```typescript
   export const myPluginDefinition: PluginDefinition = {
     name: 'my-plugin',
     version: '1.0.0',
     register: (registry) => {
       // Your existing registration code
     }
   };
   ```

2. **Add lifecycle hooks (optional):**
   ```typescript
   onLoad: async () => {
     // Initialize resources
   },
   onUnload: async () => {
     // Cleanup
   }
   ```

3. **Update exports:**
   ```typescript
   export { MyPlugin, myPluginDefinition };
   ```

### For Application Developers

1. **Use lazy loading for better performance:**
   ```typescript
   // Before
   import { MyPlugin } from '@object-ui/plugin-my-plugin';
   
   // After
   const MyPlugin = createLazyPlugin(
     () => import('@object-ui/plugin-my-plugin')
   );
   ```

2. **Use PluginSystem for dependency management:**
   ```typescript
   import { ComponentRegistry } from '@object-ui/core';
   
   const pluginSystem = new PluginSystem();
   await pluginSystem.loadPlugin(basePlugin, ComponentRegistry);
   await pluginSystem.loadPlugin(featurePlugin, ComponentRegistry);
   ```

## Troubleshooting

### Plugin won't load

Check dependencies:
```typescript
const plugin = pluginSystem.getPlugin('my-plugin');
console.log('Dependencies:', plugin?.dependencies);
console.log('Loaded:', pluginSystem.getLoadedPlugins());
```

### Lazy loading not working

Verify import path and default export:
```typescript
// Plugin should export default
export default MyComponent;

// Or export named and re-export as default
export { MyComponent };
export default MyComponent;
```

### Build errors with create-plugin

Make sure you're in the monorepo root and run:
```bash
pnpm install
pnpm --filter @object-ui/create-plugin build
```

## Future Enhancements

- Hot module replacement for plugin development
- Plugin marketplace integration
- Automatic dependency resolution
- Plugin versioning and compatibility checks
- Remote plugin loading

## Contributing

To contribute to the plugin system:

1. Follow the existing code patterns
2. Add tests for new features
3. Update this documentation
4. Submit a PR with clear description

## License

MIT © ObjectStack Inc.
