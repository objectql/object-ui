# ObjectUI Storybook Configuration

This directory contains all Storybook configuration and MSW infrastructure for ObjectUI component development.

## 📁 Directory Structure

```
.storybook/
├── main.ts                  # Storybook configuration
├── preview.ts               # Global decorators and parameters
├── msw-browser.ts          # MSW + ObjectStack runtime
├── msw-handlers.ts         # Reusable MSW handlers library
├── msw-debug.tsx           # MSW debug panel component
├── mocks.ts                # MSW handlers registration
├── datasource.ts           # ObjectStack data source helper
├── test-runner.cjs         # Storybook test runner config
├── MSW_SETUP_GUIDE.md      # Complete MSW setup guide
├── COMPONENT_GALLERY.md    # Component catalog (126 components)
├── QUICK_START.md          # Quick start template
└── README.md               # This file
```

## 🚀 Getting Started

### Start Storybook

```bash
pnpm storybook
```

Open http://localhost:6006

### Build Storybook

```bash
pnpm storybook:build
```

### Run Tests

```bash
pnpm storybook:ci
```

## 🎯 Key Features

### 1. MSW Integration

- **In-Browser Runtime** - ObjectStack kernel runs entirely in browser
- **Zero Backend Required** - Develop without backend server
- **Mock Data Collections** - 12 pre-built data collections
- **CRUD Handlers** - Auto-generated CRUD endpoints
- **Plugin Handlers** - Specialized handlers for each plugin

### 2. Debug Panel

Click the "🐛 MSW Debug" button to:
- View all API requests/responses
- Inspect ObjectStack kernel state
- Browse available mock data
- Monitor request timing

### 3. Accessibility Testing

All stories automatically include:
- WCAG 2.1 AA compliance checks
- Color contrast validation
- Keyboard navigation testing
- Screen reader compatibility

### 4. Interactive Controls

- Dynamic prop editing
- Real-time component updates
- Type-safe controls
- Preset configurations

## 📦 Configuration Files

### main.ts

Storybook main configuration:
- Story file patterns
- Addon configuration
- Vite build config
- Path aliases

### preview.ts

Global configuration:
- MSW loader integration
- Debug panel decorator
- Accessibility settings
- Story sorting
- Control matchers

### msw-browser.ts

MSW + ObjectStack runtime:
- Kernel initialization
- Plugin registration
- Mock data seeding
- Bootstrap sequence

### msw-handlers.ts

Reusable MSW handlers:
- Mock data generators
- CRUD handler factory
- Plugin-specific handlers
- Request interceptors

### msw-debug.tsx

Debug panel component:
- Request history viewer
- Kernel state inspector
- Mock data browser
- Performance metrics

## 🎨 Mock Data Collections

### Available Collections

| Collection | Items | Use Case |
|------------|-------|----------|
| contacts | 50 | Contact forms, CRM |
| tasks | 100 | Task lists, projects |
| users | 20 | User lookups |
| kanbanCards | 30 | Kanban boards |
| kanbanColumns | 4 | Kanban lanes |
| calendarEvents | 20 | Calendar views |
| timelineItems | 15 | Timeline displays |
| mapLocations | 25 | Map components |
| ganttTasks | 10 | Gantt charts |
| chatMessages | 30 | Chat interfaces |
| chartData | - | Charts/graphs |
| dashboardMetrics | - | KPI dashboards |

### Usage

```typescript
import { mockData } from '@storybook-config/msw-handlers';

// Use in your story
args: {
  data: mockData.contacts.slice(0, 10),
}
```

## 🔌 Plugin Handlers

### Available Handlers

```typescript
import { pluginHandlers } from '@storybook-config/msw-handlers';

// Use in story parameters
parameters: {
  msw: {
    handlers: [
      ...pluginHandlers.form,      // Form plugin
      ...pluginHandlers.grid,      // Grid plugin
      ...pluginHandlers.kanban,    // Kanban plugin
      ...pluginHandlers.charts,    // Charts plugin
      ...pluginHandlers.dashboard, // Dashboard plugin
      ...pluginHandlers.calendar,  // Calendar plugin
      ...pluginHandlers.timeline,  // Timeline plugin
      ...pluginHandlers.map,       // Map plugin
      ...pluginHandlers.gantt,     // Gantt plugin
      ...pluginHandlers.chatbot,   // Chatbot plugin
    ],
  },
}
```

## 🛠️ Custom Handlers

### Create CRUD Handlers

```typescript
import { createCrudHandlers } from '@storybook-config/msw-handlers';

const myData = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
];

parameters: {
  msw: {
    handlers: createCrudHandlers('my-object', myData),
  },
}
```

### Create Custom Handler

```typescript
import { http, HttpResponse } from 'msw';

parameters: {
  msw: {
    handlers: [
      http.get('/api/custom', () => {
        return HttpResponse.json({ data: 'custom' });
      }),
    ],
  },
}
```

## 📖 Documentation

### For Developers

- [Quick Start](./QUICK_START.md) - Get started in 30 seconds
- [MSW Setup Guide](./MSW_SETUP_GUIDE.md) - Complete MSW documentation
- [Component Gallery](./COMPONENT_GALLERY.md) - All 126 components

### For Contributors

- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Migration Guide](../MIGRATION_GUIDE.md) - Version migration

## 🎭 Addons

### Installed Addons

1. **@storybook/addon-essentials** - Core Storybook features
2. **@storybook/addon-interactions** - Component interaction testing
3. **@storybook/addon-a11y** - Accessibility testing
4. **@storybook/addon-links** - Link between stories
5. **msw-storybook-addon** - MSW integration

### Addon Configuration

```typescript
// .storybook/main.ts
addons: [
  "@storybook/addon-links",
  "@storybook/addon-essentials",
  "@storybook/addon-interactions",
  "@storybook/addon-a11y",
],
```

## 🧪 Testing

### Test Runner

```bash
# Run all tests
pnpm storybook:test

# Run tests in CI
pnpm storybook:ci
```

### Test Configuration

```javascript
// .storybook/test-runner.cjs
module.exports = {
  async preRender(page) {
    // Setup before each story
  },
  async postRender(page) {
    // Assertions after each story
  },
};
```

## 🎯 Best Practices

### Story Organization

```typescript
// Good - Organized by category
export default {
  title: 'Components/Form/Input',
  component: SchemaRenderer,
};

// Bad - Flat structure
export default {
  title: 'Input',
  component: SchemaRenderer,
};
```

### Naming Conventions

```typescript
// Good - Descriptive names
export const Default: Story = {};
export const WithValidation: Story = {};
export const DisabledState: Story = {};

// Bad - Vague names
export const Story1: Story = {};
export const Test: Story = {};
```

### Using MSW

```typescript
// Good - Use reusable handlers
import { mockData, pluginHandlers } from '@storybook-config/msw-handlers';

// Bad - Inline all handlers
parameters: {
  msw: {
    handlers: [
      http.get('/api/...', () => {}),
      http.post('/api/...', () => {}),
      // ... dozens of handlers
    ],
  },
}
```

## 🔍 Debugging

### Enable Verbose Logging

```typescript
// .storybook/msw-browser.ts
kernel.use(new MSWPlugin({
  enableBrowser: true,
  baseUrl: '/api/v1',
  logRequests: true, // ← Enable logging
}));
```

### View Request Logs

1. Open MSW Debug Panel (🐛 button)
2. Click "Requests" tab
3. Select a request to view details

### Inspect Kernel State

1. Open MSW Debug Panel
2. Click "Kernel State" tab
3. View configuration and status

## 🚀 Performance

### Build Optimization

```typescript
// .storybook/main.ts
async viteFinal(config) {
  return mergeConfig(config, {
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  });
}
```

### Story Loading

```typescript
// Use lazy loading for heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const Heavy: Story = {
  render: () => (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  ),
};
```

## 📊 Metrics

### Coverage

- **Total Components:** 126
- **With Stories:** 60+ (48%)
- **With MSW Handlers:** 100+ (79%)
- **With Accessibility Tests:** 100%

### Performance

- **Storybook Start Time:** ~5s
- **Story Load Time:** <100ms
- **MSW Response Time:** <10ms
- **Hot Reload Time:** <2s

## 🤝 Contributing

### Adding a New Story

1. Create story file in appropriate package
2. Import necessary handlers from `msw-handlers.ts`
3. Add accessibility tests
4. Test with MSW debug panel
5. Update Component Gallery

### Adding Mock Data

1. Add data to `msw-handlers.ts`
2. Create CRUD handlers if needed
3. Document in Component Gallery
4. Add usage examples

### Adding Plugin Handler

1. Add handler to `pluginHandlers` in `msw-handlers.ts`
2. Test with plugin component
3. Document usage pattern
4. Update Component Gallery

## 📝 Changelog

### v0.3.0 (Current)

- ✅ MSW infrastructure
- ✅ Debug panel
- ✅ 12 mock data collections
- ✅ Accessibility addon
- ✅ 60+ component stories
- ✅ Comprehensive documentation

### Upcoming

- [ ] Visual regression testing
- [ ] GitHub Pages deployment
- [ ] Component playground
- [ ] Performance monitoring

## 🔗 Links

- [Storybook Documentation](https://storybook.js.org)
- [MSW Documentation](https://mswjs.io)
- [ObjectUI Documentation](https://www.objectui.org)
- [GitHub Repository](https://github.com/objectstack-ai/objectui)

## 📞 Support

- GitHub Issues: https://github.com/objectstack-ai/objectui/issues
- Documentation: https://www.objectui.org
- Discord: Coming soon

---

**Built with ❤️ by the ObjectUI team**
