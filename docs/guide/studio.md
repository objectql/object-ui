# Object UI Designer

The **Object UI Designer** is a powerful, interactive visual editor that allows you to design and prototype user interfaces without writing code. It combines a drag-and-drop designer, live preview, and instant JSON export capabilities.

## 🚀 Getting Started

The designer is available as the `@object-ui/designer` package. You can use it in your own applications or run the designer demo:

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git
cd objectui

# Install dependencies
pnpm install

# Run the designer demo
pnpm designer
```

## Features

### 🎨 Visual Designer
- **Drag-and-Drop**: Drag components from the palette directly onto the canvas
- **Smart Positioning**: Intelligent drop zone detection for precise component placement
- **Live Preview**: See your changes in real-time as you design
- **Component Search**: Quickly find the components you need

### 📝 Code Editor
- **JSON Editor**: Edit schemas directly with syntax highlighting
- **Split View**: Code on the left, preview on the right
- **Syntax Validation**: Real-time JSON validation with error messages
- **Auto-format**: Beautiful, readable JSON output

### 📱 Responsive Preview
- **Multiple Viewports**: Test your design in Desktop, Tablet, and Mobile views
- **Device Frames**: Realistic device mockups for mobile and tablet
- **Instant Switching**: Toggle between viewports with one click

### ⚡ Productivity Features
- **Undo/Redo**: Full history management (`Ctrl+Z` / `Ctrl+Y`)
- **Copy/Paste**: Duplicate components easily (`Ctrl+C` / `Ctrl+V`)
- **Export JSON**: Download your schema as a `.json` file
- **Copy to Clipboard**: One-click copy for easy integration

## Getting Started

### 1. Choose a Template

When you open the Studio, you'll see a gallery of pre-built examples organized by category:

- **Primitives**: Basic building blocks (inputs, buttons, text)
- **Layouts**: Page structures and responsive grids
- **Data Display**: Tables, lists, and cards
- **Forms**: Complete form examples with validation
- **Complex**: Advanced examples like dashboards and admin panels

Click any example to load it in the Studio.

### 2. Design Mode

In **Design Mode**, you can:
- Select components by clicking them
- Edit properties in the right panel
- Drag new components from the palette
- Reorder components by dragging
- Delete components with the `Delete` key

**Tips:**
- Use the property panel to customize colors, spacing, and behavior
- Try adding `className` properties with Tailwind CSS classes
- Nested components can be expanded to edit their children

### 3. Preview Mode

Switch to **Preview Mode** to see how your interface looks without the designer chrome:
- Test responsiveness with viewport toggles
- Interact with components to verify behavior
- Check the visual design at different screen sizes

### 4. Code Mode

In **Code Mode**, you have:
- Full JSON schema on the left
- Live preview on the right
- Real-time validation
- Direct editing for advanced users

**Pro Tip:** Copy the JSON and paste it directly into your React application:

```tsx
import { SchemaRenderer } from '@object-ui/react';

const schema = {
  // Paste your copied JSON here
};

function MyComponent() {
  return <SchemaRenderer schema={schema} />;
}
```

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Z` / `Cmd+Z` | Undo | Undo the last change |
| `Ctrl+Y` / `Cmd+Y` | Redo | Redo the last undone change |
| `Ctrl+C` / `Cmd+C` | Copy | Copy the selected component |
| `Ctrl+V` / `Cmd+V` | Paste | Paste the copied component |
| `Delete` / `Backspace` | Delete | Delete the selected component |

## Use Cases

### 1. **Rapid Prototyping**
Quickly design and test UI concepts without writing code. Export the JSON when ready for development.

### 2. **Learning Tool**
Understand how Object UI schemas work by experimenting with the visual designer and seeing the JSON output.

### 3. **Client Demos**
Create interactive mockups to show clients and gather feedback before implementation.

### 4. **Component Library Exploration**
Browse and test all available components to understand their properties and behavior.

### 5. **Schema Generation**
Generate complex schemas visually, then fine-tune the JSON for production use.

## Examples Gallery

The Studio includes curated examples in multiple categories:

### Layouts
- **Dashboard**: KPI cards, charts, and responsive grid
- **Grid Layout**: Multi-column responsive layouts
- **Tabs**: Tabbed interface with multiple panels

### Forms
- **User Registration**: Complete signup form with validation
- **Contact Form**: Simple form with text inputs and textarea
- **Multi-step Form**: Wizard-style form with progress indicator

### Complex
- **Admin Panel**: Full-featured dashboard with navigation
- **E-commerce**: Product listing with filters
- **Analytics**: Data visualization and reporting

## Best Practices

### 1. Start with a Template
Don't start from scratch - use an existing example as a starting point and customize it.

### 2. Use Semantic Components
Choose the right component for the job:
- Use `<Form>` for data collection
- Use `<Card>` for content grouping
- Use `<Grid>` for responsive layouts

### 3. Leverage Tailwind Classes
Add custom styling with `className` properties:
```json
{
  "type": "button",
  "label": "Submit",
  "className": "bg-indigo-600 hover:bg-indigo-700"
}
```

### 4. Test Responsiveness
Always preview your design in multiple viewport sizes to ensure it works on all devices.

### 5. Export and Iterate
Export your schema, integrate it into your app, and come back to the Studio to make adjustments.

## Limitations

The Studio is designed for:
- ✅ Prototyping and design
- ✅ Learning and experimentation
- ✅ Schema generation

It is **not** designed for:
- ❌ Production data management (no backend connection)
- ❌ Complex state management (use your app for that)
- ❌ Custom component development (extend Object UI separately)

## What's Next?

- [Read the full guide](/guide/introduction)
- [Explore the API reference](/api/react)
- [Check out component specifications](/protocol/overview)
- [View the project roadmap](/ROADMAP)

## Feedback

We'd love to hear your thoughts on the Studio!

- 🐛 [Report bugs](https://github.com/objectql/objectui/issues)
- 💡 [Request features](https://github.com/objectql/objectui/issues)
- ⭐ [Star on GitHub](https://github.com/objectql/objectui)
