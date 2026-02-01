# ObjectStack Console

The standard runtime UI for ObjectStack applications. This package provides the "Console" interface that allows users to interact with objects and apps defined in the ObjectStack protocol.

## Features

- **Dynamic UI**: Renders Dashboards, Grids, and Forms based on JSON schemas
- **Multi-App Support**: Switch between different apps defined in your stack
- **Plugin Architecture**: Can be loaded as a static plugin in the ObjectStack Runtime

## Usage as a Plugin

You can include the console in your ObjectStack Runtime server by installing this package and registering it as a static asset plugin.

```typescript
import { staticPath } from '@object-ui/console';
// Example integration (implementation depends on your server framework)
app.use('/console', express.static(staticPath));
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## License

MIT
