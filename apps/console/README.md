# ObjectStack Console

The standard runtime UI for ObjectStack applications. This package provides the "Console" interface that allows users to interact with objects and apps defined in the ObjectStack protocol.

## Features

- **Spec-Compliant**: Fully implements ObjectStack Spec v0.8.2
- **Dynamic UI**: Renders Dashboards, Grids, and Forms based on JSON schemas
- **Multi-App Support**: Switch between different apps defined in your stack
- **Plugin Architecture**: Can be loaded as a static plugin in the ObjectStack Runtime
- **Flexible Navigation**: Supports object, dashboard, page, url, and group navigation types
- **App Branding**: Supports custom logos, colors, and theming per app
- **Permission-Aware**: Respects app-level permission requirements

## ObjectStack Spec Compliance

This console implements the following ObjectStack Spec features:

### AppSchema Support
- ✅ `name`, `label`, `icon` - Basic app metadata
- ✅ `description`, `version` - Optional app information
- ✅ `homePageId` - Custom landing page configuration
- ✅ `requiredPermissions` - Permission-based access control
- ✅ `branding.logo` - Custom app logo display
- ✅ `branding.primaryColor` - Custom theme color
- ✅ `branding.favicon` - App-specific favicon

### Navigation Support
- ✅ `object` - Navigate to object list views
- ✅ `dashboard` - Navigate to dashboards (planned)
- ✅ `page` - Navigate to custom pages (planned)
- ✅ `url` - External URL navigation with target support
- ✅ `group` - Nested navigation groups
- ✅ Navigation item visibility conditions
- ✅ Recursive navigation tree rendering

### Object Operations
- ✅ Create, Read, Update, Delete (CRUD)
- ✅ ObjectGrid with filtering and sorting
- ✅ ObjectForm with field type mapping
- ✅ Dynamic field rendering based on ObjectSchema

## Usage as a Plugin

You can include the console in your ObjectStack Runtime server by installing this package and registering it as a static asset plugin.

```typescript
import ConsolePlugin from '@object-ui/console';

// In your objectstack.config.ts
export default defineConfig({
  plugins: [
    ConsolePlugin
  ]
});
```

The console will be available at `/console` in your ObjectStack application.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Architecture

The console is built on top of ObjectUI components:
- `@object-ui/react` - Core rendering engine
- `@object-ui/components` - Shadcn/UI components
- `@object-ui/layout` - App shell and layout components
- `@object-ui/plugin-grid` - Data grid component
- `@object-ui/plugin-form` - Form rendering component

## License

MIT
