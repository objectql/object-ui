# Designer API

The `@object-ui/designer` package provides a visual drag-and-drop editor for creating Object UI schemas.

::: warning Coming Soon
The Designer is planned for release in Q3 2026. This documentation is a preview.
:::

## Planned Features

### Visual Editor

```tsx
import { Designer } from '@object-ui/designer'

function App() {
  const [schema, setSchema] = useState(null)
  
  return (
    <Designer
      schema={schema}
      onChange={setSchema}
    />
  )
}
```

### Component Palette

Drag components from the palette to the canvas.

### Property Editor

Edit component properties visually with a sidebar panel.

### Real-time Preview

See your changes instantly with live preview.

### AI Assistant

Generate schemas using natural language:

```tsx
<Designer
  enableAI={true}
  aiPrompt="Create a user registration form"
/>
```

### Collaboration

Real-time multi-user editing like Google Docs.

## Stay Updated

Want to be notified when Designer launches?

- ⭐ [Star on GitHub](https://github.com/objectql/object-ui)
- 📧 [Email us](mailto:hello@objectui.org)
- 📋 [View Roadmap](/roadmap)

## Roadmap

See the [full roadmap](/roadmap#q3-2026-visual-designer-available-september-2026) for Designer features and timeline.
