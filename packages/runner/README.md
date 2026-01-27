# @object-ui/runner

Universal Object UI Application Runner - A standalone development server and runtime for testing Object UI schemas.

## Features

- **Schema Development** - Test and debug Object UI schemas in isolation
- **Hot Reload** - Automatic reload on schema changes
- **Plugin Support** - Pre-configured with popular plugins (Kanban, Charts, etc.)
- **Development Ready** - Built-in Vite development server
- **Production Build** - Optimized build for deployment

## Installation

```bash
pnpm add @object-ui/runner
```

## Usage

### As a Development Tool

The runner is primarily used for schema development and testing:

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Programmatic Usage

You can also use the runner as a library in your projects:

```typescript
import { createRunner } from '@object-ui/runner';

const runner = createRunner({
  schema: mySchema,
  plugins: ['kanban', 'charts'],
  theme: 'light'
});

runner.mount('#app');
```

## Pre-installed Plugins

The runner comes with these plugins pre-configured:

- **@object-ui/plugin-kanban** - Kanban board components
- **@object-ui/plugin-charts** - Chart visualization components
- **Additional plugins can be added as needed**

## Schema Loading

The runner can load schemas from various sources:

```typescript
// From JSON file
const schema = await import('./my-schema.json');

// From JavaScript/TypeScript
const schema = {
  type: 'page',
  title: 'My App',
  body: {
    type: 'card',
    content: 'Hello World'
  }
};

// From API endpoint
const schema = await fetch('/api/schema').then(r => r.json());
```

## Configuration

Create a `runner.config.js` file to customize the runner:

```javascript
export default {
  port: 3000,
  host: 'localhost',
  plugins: ['kanban', 'charts'],
  theme: {
    primaryColor: '#3b82f6',
    darkMode: true
  }
};
```

## Development Workflow

1. Create a schema file (JSON or TypeScript)
2. Start the runner with `pnpm dev`
3. Edit the schema - changes reload automatically
4. Test your UI in the browser
5. Build for production with `pnpm build`

## Example Schema

```json
{
  "type": "page",
  "title": "Dashboard",
  "body": {
    "type": "grid",
    "columns": 3,
    "gap": 4,
    "children": [
      {
        "type": "card",
        "title": "Total Users",
        "body": {
          "type": "statistic",
          "value": 1234,
          "trend": "up"
        }
      },
      {
        "type": "card",
        "title": "Revenue",
        "body": {
          "type": "statistic",
          "value": "$56,789",
          "trend": "up"
        }
      },
      {
        "type": "card",
        "title": "Orders",
        "body": {
          "type": "statistic",
          "value": 432,
          "trend": "down"
        }
      }
    ]
  }
}
```

## API Reference

For detailed documentation, visit the [Object UI Documentation](https://www.objectui.org/docs/runner).

## License

MIT
