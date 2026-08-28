# @object-ui/components

Standard UI component library for Object UI, built with Shadcn UI + Tailwind CSS.

## Features

- 🎨 **Tailwind Native** - Built entirely with Tailwind CSS utility classes
- 🧩 **Shadcn UI** - Based on Radix UI primitives for accessibility
- 📦 **60+ Components** - Complete set of UI components (46 from Shadcn + 14 custom)
- ♿ **Accessible** - WCAG compliant components
- 🎯 **Type-Safe** - Full TypeScript support
- 🔌 **Extensible** - Easy to customize and extend
- 🔄 **Sync Tools** - Scripts to keep components updated with latest Shadcn

## Keeping Components Updated

ObjectUI provides tools to sync components with the latest Shadcn UI versions:

```bash
# Analyze components (offline)
pnpm shadcn:analyze

# Check for updates (online)
pnpm shadcn:check

# Update a component
pnpm shadcn:update button --backup
```

**📚 See [README_SHADCN_SYNC.md](./README_SHADCN_SYNC.md) for the complete guide.**

## Installation

```bash
npm install @object-ui/components @object-ui/react @object-ui/core
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `tailwindcss` ^4.2.1

## Setup

There is no `tailwind.config.js` step. This package is Tailwind 4, which is
configured in CSS: it has no such file of its own, and consuming it does not need
one on your side either.

### 1. Import Styles

Add to your main CSS file, after your own Tailwind entry:

```css
@import 'tailwindcss';
@import '@object-ui/components/style.css';
```

`style.css` is the stylesheet this package compiles at build time from its own
sources. It already carries every utility its components use **and** the theme
tokens those utilities are built on — `bg-primary`, `border-input`, `ring-ring`
and the rest of the Shadcn palette — so importing it is the whole of the styling
setup.

You do **not** add a `@source` line for `node_modules/@object-ui/components`.
Pointing Tailwind at the published files generates the shape-only utilities a
second time and still cannot produce the themed ones, because the `@theme` block
they come from lives in this package's unpublished source. Your own Tailwind
entry goes on generating the classes your own source uses, as it always did.

### 2. Register Components

```tsx
import { initializeComponents } from '@object-ui/components'

initializeComponents()
```

Importing the package already registers its components as a side effect;
`initializeComponents()` is the explicit call for bundlers that would otherwise
tree-shake that import away.

## Usage

### With SchemaRenderer

```tsx
import { SchemaRenderer } from '@object-ui/react'
import { initializeComponents } from '@object-ui/components'

initializeComponents()

const schema = {
  type: 'card',
  title: 'Welcome',
  body: {
    type: 'text',
    value: 'Hello from Object UI!'
  }
}

function App() {
  return <SchemaRenderer schema={schema} />
}
```

### Direct Import

You can also import UI components directly:

```tsx
import { Button, Input, Card } from '@object-ui/components'

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text" />
      <Button>Submit</Button>
    </Card>
  )
}
```

## Available Components

### Form Components
- `input` - Text input
- `textarea` - Multi-line text
- `select` - Dropdown select
- `checkbox` - Checkbox
- `radio` - Radio button
- `date-picker` - Date selection
- `switch` - Toggle switch

### Layout Components
- `container` - Container wrapper
- `grid` - Grid layout
- `flex` - Flexbox layout
- `card` - Card container
- `tabs` - Tab navigation
- `accordion` - Collapsible sections

### Data Display
- `table` - Data table
- `list` - List view
- `badge` - Badge label
- `avatar` - User avatar
- `progress` - Progress bar

### Feedback
- `alert` - Alert messages
- `toast` - Toast notifications
- `dialog` - Modal dialog
- `popover` - Popover overlay

### Navigation
- `button` - Button component
- `link` - Link component
- `breadcrumb` - Breadcrumb navigation

## Notification Surfaces

Direct-import React components (not schema blocks) that render the notifications
raised through `NotificationProvider` from `@object-ui/react`. One per spec
`displayType`, so a `banner` no longer presents as a toast:

| Component | `displayType` | Where to mount it |
| --- | --- | --- |
| `<NotificationSnackbar />` | `snackbar` | anywhere inside the provider — it anchors itself bottom-center |
| `<NotificationBanners />` | `banner` | top of the content area (it takes space in the flow) |
| `<NotificationAlerts />` | `alert` | anywhere inside the provider — blocking dialog, FIFO queue |
| `<NotificationInline scope="…" />` | `inline` | in the surface that raises them |

`toast` stays with the host's `onToast` delegate (sonner in the console). All of
them draw the notification's `severity` icon unless it declares an `icon`
override naming a real Lucide icon. See the
[notifications guide](https://objectui.org/docs/guide/notifications).

<!-- doc-snippet: fragment — router-layout excerpt: `Outlet` is react-router's, supplied by the host application -->
```tsx
import { NotificationBanners, NotificationAlerts } from '@object-ui/components';

<main>
  <NotificationBanners />
  <Outlet />
  <NotificationAlerts />
</main>
```

## Customization

### Override Styles

All components accept `className` for Tailwind classes:

```json
{
  "type": "button",
  "label": "Click Me",
  "className": "bg-blue-500 hover:bg-blue-700 text-white"
}
```

### Custom Components

Register your own components:

```tsx
import { ComponentRegistry } from '@object-ui/core'
import { Button } from '@object-ui/components'

function CustomButton(props: Record<string, unknown>) {
  return <Button {...props} className="my-custom-style" />
}

ComponentRegistry.register('custom-button', CustomButton)
```

`ComponentRegistry` is a process-level singleton exported by `@object-ui/core`;
`SchemaRenderer` resolves every `type` against it, so a component registered
here is renderable from schema anywhere in the app.

## API Reference

See [full documentation](https://objectui.org/docs/components) for detailed API reference.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/components)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/components)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
