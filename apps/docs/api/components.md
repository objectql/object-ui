# Components API

The `@object-ui/components` package provides pre-built UI components that implement the Object UI protocol.

## Installation

```bash
npm install @object-ui/components
```

## Registration

Register all default components:

```tsx
import { registerDefaultRenderers } from '@object-ui/components'

registerDefaultRenderers()
```

Or register individual components:

```tsx
import { Button, Input, Form } from '@object-ui/components'
import { registerRenderer } from '@object-ui/react'

registerRenderer('button', Button)
registerRenderer('input', Input)
registerRenderer('form', Form)
```

## Component List

### Form Components

- `input` - Text input field
- `textarea` - Multi-line text input
- `select` - Dropdown select
- `checkbox` - Checkbox input
- `radio` - Radio button
- `date-picker` - Date selection
- `file-upload` - File upload

### Data Display

- `table` - Data table with sorting/pagination
- `list` - List view
- `card` - Card container
- `tree` - Tree view

### Layout

- `grid` - Grid layout
- `flex` - Flexbox layout
- `container` - Container wrapper
- `tabs` - Tab navigation

### Feedback

- `alert` - Alert messages
- `toast` - Toast notifications
- `dialog` - Modal dialog
- `loading` - Loading indicators

## Customization

### Styling

All components accept Tailwind classes:

```json
{
  "type": "button",
  "className": "bg-blue-500 hover:bg-blue-700 text-white"
}
```

### Extending Components

Create custom components:

```tsx
import { Button } from '@object-ui/components'

function CustomButton(props) {
  return (
    <Button
      {...props}
      className={`custom-styles ${props.className}`}
    />
  )
}

registerRenderer('custom-button', CustomButton)
```

## Theming

Apply themes to all components:

```tsx
import { ThemeProvider } from '@object-ui/components'

<ThemeProvider theme="dark">
  <SchemaRenderer schema={schema} />
</ThemeProvider>
```

## API Reference

Full component API documentation coming soon.

For now, see:
- [GitHub Repository](https://github.com/objectql/object-ui/tree/main/packages/components)
- [Storybook](https://storybook.objectui.org) (coming soon)
