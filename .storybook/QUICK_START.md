# ObjectUI Quick Start Template

Get started with ObjectUI component development in under 30 seconds.

## 🚀 Quick Start

### Option 1: Using Storybook (Recommended)

```bash
# Clone the repo
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Start Storybook
pnpm storybook
```

Open http://localhost:6006 - you're ready to go! 🎉

### Option 2: Create a New Component Story

```bash
# Create a new story file
touch packages/components/src/stories-json/my-component.stories.tsx
```

```typescript
// packages/components/src/stories-json/my-component.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';
import { mockData } from '@storybook-config/msw-handlers';

const meta = {
  title: 'Components/MyComponent',
  component: SchemaRenderer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <SchemaRenderer schema={args as unknown as BaseSchema} />,
  args: {
    type: 'my-component',
    props: {
      title: 'Hello World',
    },
  } as any,
};

export const WithMockData: Story = {
  render: (args) => <SchemaRenderer schema={args as unknown as BaseSchema} />,
  args: {
    type: 'my-component',
    data: mockData.contacts.slice(0, 5),
  } as any,
};
```

## 📁 Project Structure

```
objectui/
├── .storybook/                    # Storybook configuration
│   ├── main.ts                    # Storybook config
│   ├── preview.ts                 # Global decorators & parameters
│   ├── msw-browser.ts            # MSW + ObjectStack runtime
│   ├── msw-handlers.ts           # Reusable MSW handlers
│   ├── msw-debug.tsx             # Debug panel component
│   ├── MSW_SETUP_GUIDE.md        # Complete MSW guide
│   └── COMPONENT_GALLERY.md      # Component catalog
├── packages/
│   ├── components/               # UI components
│   │   └── src/
│   │       ├── stories-json/     # Component stories
│   │       └── renderers/        # Component implementations
│   ├── fields/                   # Field widgets
│   ├── layout/                   # Layout components
│   └── plugin-*/                 # Plugin packages
└── examples/
    └── msw-todo/                 # MSW example app
```

## 🎨 Component Categories

### Available Now
- ✅ **Basic** (11) - Text, Icon, Button Group, etc.
- ✅ **Feedback** (8) - Progress, Spinner, Alert, Toast
- ✅ **Data Display** (9) - Badge, Avatar, Table, Card
- ✅ **Layout** (9) - Grid, Flex, Stack, Tabs

### Coming Soon
- 🔄 **Form** (17) - Input, Select, Date Picker, etc.
- 🔄 **Overlay** (10) - Dialog, Sheet, Dropdown, etc.
- 🔄 **Field Widgets** (37) - Specialized form fields
- 🔄 **Plugins** (14) - Grid, Kanban, Charts, etc.

## 🛠️ Common Patterns

### 1. Simple Component

```typescript
{
  type: 'button',
  props: { variant: 'default' },
  children: [{ type: 'text', content: 'Click Me' }]
}
```

### 2. Component with Mock Data

```typescript
import { mockData } from '@storybook-config/msw-handlers';

{
  type: 'table',
  columns: [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
  ],
  data: mockData.contacts.slice(0, 10),
}
```

### 3. Component with Custom MSW Handler

```typescript
import { http, HttpResponse } from 'msw';

export const MyStory: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/custom', () => {
          return HttpResponse.json({ data: 'custom response' });
        }),
      ],
    },
  },
  render: () => <MyComponent />,
};
```

### 4. Component with Multiple States

```typescript
export const LoadingState: Story = {
  args: { loading: true },
};

export const ErrorState: Story = {
  args: { error: 'Something went wrong' },
};

export const EmptyState: Story = {
  args: { data: [] },
};

export const WithData: Story = {
  args: { data: mockData.contacts.slice(0, 10) },
};
```

## 🔧 Available Mock Data

```typescript
import { mockData } from '@storybook-config/msw-handlers';

// Use any of these:
mockData.contacts        // 50 contact records
mockData.tasks          // 100 task records
mockData.users          // 20 user records
mockData.kanbanCards    // 30 kanban cards
mockData.kanbanColumns  // 4 kanban columns
mockData.calendarEvents // 20 calendar events
mockData.timelineItems  // 15 timeline items
mockData.mapLocations   // 25 map locations
mockData.ganttTasks     // 10 gantt tasks
mockData.chatMessages   // 30 chat messages
mockData.chartData      // Chart datasets
mockData.dashboardMetrics // Dashboard KPIs
```

## 🎯 Creating Custom Mock Data

```typescript
// In your story file
const customData = Array.from({ length: 20 }, (_, i) => ({
  id: `item-${i}`,
  name: `Item ${i}`,
  value: Math.random() * 100,
}));

export const WithCustomData: Story = {
  render: () => <YourComponent data={customData} />,
};
```

## 🐛 Debugging

### Enable MSW Debug Panel

The debug panel is automatically available in Storybook.

Click the "🐛 MSW Debug" button in the bottom-right corner to:
- View all API requests/responses
- Inspect ObjectStack kernel state
- Browse available mock data

### View Console Logs

```typescript
// MSW requests are automatically logged
console.log('[MSW] GET /api/v1/data/contact');
console.log('[MSW] Response 200 (45ms)');
```

## 🧪 Testing

### Run Tests

```bash
# Unit tests
pnpm test

# Test with coverage
pnpm test:coverage

# Test in watch mode
pnpm test:watch
```

### Run Storybook Tests

```bash
# Start Storybook and run tests
pnpm storybook:ci
```

## 📚 Learn More

- [MSW Setup Guide](./.storybook/MSW_SETUP_GUIDE.md) - Complete MSW documentation
- [Component Gallery](./.storybook/COMPONENT_GALLERY.md) - All 126 components
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [ObjectUI Docs](https://www.objectui.org) - Official documentation

## 🚀 Next Steps

1. ✅ Browse existing components in Storybook
2. ✅ Try modifying a story
3. ✅ Create a new component
4. ✅ Add MSW handlers for your component
5. ✅ Write tests for your component
6. ✅ Submit a PR

## ❓ Common Issues

### Issue: Storybook won't start

**Solution:**
```bash
# Re-install dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild packages
pnpm build
```

### Issue: MSW not intercepting requests

**Solution:**
```bash
# Re-initialize MSW
pnpm dlx msw init public/ --save
```

### Issue: Component not showing in Storybook

**Solution:**
- Check story file is in `packages/*/src/**/*.stories.tsx`
- Verify story exports are correct
- Check Storybook terminal for errors

## 💡 Tips

1. **Use Hot Reload** - Changes appear instantly (< 5 seconds)
2. **Use Mock Data** - Reuse existing `mockData` collections
3. **Test Edge Cases** - Loading, error, empty states
4. **Check Accessibility** - Use the a11y addon
5. **Debug with Panel** - Use MSW debug panel for requests

## 🎉 You're Ready!

Start building amazing components with ObjectUI + MSW! 

```bash
pnpm storybook
```

Happy coding! 🚀
