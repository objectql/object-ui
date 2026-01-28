# @object-ui/components

Standard UI component library for Object UI, built with Shadcn UI + Tailwind CSS.

## Features

- 🎨 **Tailwind Native** - Built entirely with Tailwind CSS utility classes
- 🧩 **Shadcn UI** - Based on Radix UI primitives for accessibility
- 📦 **60+ Components** - Complete set of UI components (46 from Shadcn + 14 custom)
- ♿ **Accessible** - WCAG compliant components
- 🎯 **Type-Safe** - Full TypeScript support
- 🔌 **Extensible** - Easy to customize and extend
- � **Storybook** - Interactive component showcase and development environment
- 🔄 **Sync Tools** - Scripts to keep components updated with latest Shadcn

## Development

We use Storybook for component development and testing.

```bash
# Start Storybook
pnpm storybook

# Build Storybook
pnpm build-storybook
```

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

**📚 See [SHADCN_SYNC.md](../../docs/SHADCN_SYNC.md) for the complete guide.**

## Installation

```bash
npm install @object-ui/components @object-ui/react @object-ui/core
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `tailwindcss` ^3.0.0

## Setup

### 1. Configure Tailwind

Add to your `tailwind.config.js`:

```js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,ts,jsx,tsx}'
  ],
  // ... your config
}
```

### 2. Import Styles

Add to your main CSS file:

```css
@import '@object-ui/components/dist/style.css';
```

### 3. Register Components

```tsx
import { registerDefaultRenderers } from '@object-ui/components'

registerDefaultRenderers()
```

## Usage

### With SchemaRenderer

```tsx
import { SchemaRenderer } from '@object-ui/react'
import { registerDefaultRenderers } from '@object-ui/components'

registerDefaultRenderers()

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
import { registerRenderer } from '@object-ui/react'
import { Button } from '@object-ui/components'

function CustomButton(props) {
  return <Button {...props} className="my-custom-style" />
}

registerRenderer('custom-button', CustomButton)
```

## API Reference

See [full documentation](https://objectui.org/api/components) for detailed API reference.

## License

MIT
