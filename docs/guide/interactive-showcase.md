# Interactive Component Documentation

This guide explains how to create an interactive component documentation experience similar to Shadcn UI, where users can see live previews, read descriptions, and edit code to see results.

## 🎯 Goals

1. **Visual Preview** - Show the rendered component
2. **Component Description** - Explain what the component does and when to use it
3. **Editable Code** - Allow users to modify the JSON schema
4. **Live Updates** - See changes in real-time
5. **Copy-Paste Ready** - Easy to copy the schema

## 🏗️ Architecture

### Component Documentation Structure

Each component page should include:

```
┌─────────────────────────────────────────┐
│ Component Name & Description            │
├─────────────────────────────────────────┤
│                                         │
│  Live Preview (Rendered Component)      │
│                                         │
├─────────────────────────────────────────┤
│  JSON Schema (Editable)                 │
│  [Copy] [Reset]                         │
└─────────────────────────────────────────┘
```

## 📝 Implementation Options

### Option 1: Enhanced Showcase Pages (Short Term)

**Add code display to existing showcase pages:**

Each component page (e.g., `pages/form/button.json`) can include:

1. **Preview Card** - Visual display (already exists)
2. **Code Block** - JSON schema in a code component
3. **Description** - Component documentation

**Example Structure:**

```json
{
  "type": "page",
  "title": "Button - Object UI",
  "body": [
    {
      "type": "div",
      "className": "space-y-6",
      "children": [
        {
          "type": "text",
          "value": "Button",
          "className": "text-3xl font-bold"
        },
        {
          "type": "text",
          "value": "Trigger actions and events with customizable buttons.",
          "className": "text-lg text-muted-foreground"
        },
        {
          "type": "separator"
        },
        {
          "type": "div",
          "className": "grid gap-6",
          "children": [
            {
              "type": "text",
              "value": "Preview",
              "className": "text-xl font-semibold"
            },
            {
              "type": "card",
              "className": "p-6",
              "children": {
                "type": "button",
                "label": "Click me",
                "variant": "default"
              }
            },
            {
              "type": "text",
              "value": "Code",
              "className": "text-xl font-semibold"
            },
            {
              "type": "code-block",
              "language": "json",
              "code": "{\n  \"type\": \"button\",\n  \"label\": \"Click me\",\n  \"variant\": \"default\"\n}",
              "showCopy": true
            }
          ]
        }
      ]
    }
  ]
}
```

**Pros:**
- ✅ Works with existing infrastructure
- ✅ No new components needed
- ✅ Easy to implement

**Cons:**
- ❌ Not live-editable
- ❌ Separate preview and code

### Option 2: Interactive Playground Component (Medium Term)

**Create a new `playground` component:**

```json
{
  "type": "playground",
  "component": "button",
  "description": "Trigger actions and events with customizable buttons.",
  "defaultSchema": {
    "type": "button",
    "label": "Click me",
    "variant": "default"
  },
  "examples": [
    {
      "name": "Primary Button",
      "schema": { "type": "button", "label": "Primary", "variant": "default" }
    },
    {
      "name": "Secondary Button",
      "schema": { "type": "button", "label": "Secondary", "variant": "secondary" }
    }
  ]
}
```

**Features:**
- Live preview at the top
- Editable JSON editor below
- Instant updates on edit
- Example switcher
- Copy button

**Pros:**
- ✅ Interactive editing
- ✅ Real-time preview
- ✅ Better UX

**Cons:**
- ❌ Requires new component development
- ❌ Need to integrate code editor (Monaco/CodeMirror)

### Option 3: Separate Playground App (Long Term)

**Create a dedicated playground application:**

Similar to `play.tailwindcss.com` or Shadcn's component pages.

**URL Structure:**
- `play.objectui.org/button` - Button playground
- `play.objectui.org/input` - Input playground
- `play.objectui.org/` - General playground

**Features:**
- Split view (code | preview)
- Multiple file support
- Share via URL
- Export options
- Template gallery

**Pros:**
- ✅ Full-featured experience
- ✅ Shareable links
- ✅ Professional appearance

**Cons:**
- ❌ Significant development effort
- ❌ Separate hosting needed
- ❌ More maintenance

## 🚀 Recommended Approach

### Phase 1: Enhanced Documentation (Now - Week 1)

**Immediate improvements to showcase:**

1. **Add Component Descriptions**
   - Edit each component page to include proper descriptions
   - Add usage guidelines
   - Include props/schema reference

2. **Add Code Blocks**
   - Show the JSON schema alongside the preview
   - Add copy buttons
   - Include multiple examples

3. **Improve Layout**
   - Better spacing
   - Clear sections (Description, Preview, Code, Examples)
   - Responsive design

**Implementation:**

For each component page (e.g., `button.json`), follow this structure:

```json
{
  "type": "page",
  "title": "Component Name",
  "body": [
    {
      "type": "div",
      "className": "container mx-auto py-8 max-w-5xl space-y-8",
      "children": [
        // Header Section
        {
          "type": "div",
          "className": "space-y-2",
          "children": [
            {
              "type": "text",
              "value": "Component Name",
              "className": "text-4xl font-bold tracking-tight"
            },
            {
              "type": "text",
              "value": "Brief description of what this component does.",
              "className": "text-xl text-muted-foreground"
            }
          ]
        },
        
        // Usage Section
        {
          "type": "div",
          "className": "space-y-4",
          "children": [
            {
              "type": "text",
              "value": "Usage",
              "className": "text-2xl font-semibold"
            },
            {
              "type": "text",
              "value": "Detailed explanation of when and how to use this component.",
              "className": "text-muted-foreground"
            }
          ]
        },
        
        // Example Section
        {
          "type": "div",
          "className": "space-y-4",
          "children": [
            {
              "type": "text",
              "value": "Example",
              "className": "text-2xl font-semibold"
            },
            
            // Preview
            {
              "type": "div",
              "className": "space-y-2",
              "children": [
                {
                  "type": "text",
                  "value": "Preview",
                  "className": "text-sm font-medium text-muted-foreground"
                },
                {
                  "type": "card",
                  "className": "p-8 flex items-center justify-center min-h-[200px]",
                  "children": {
                    // Actual component here
                  }
                }
              ]
            },
            
            // Code
            {
              "type": "div",
              "className": "space-y-2",
              "children": [
                {
                  "type": "text",
                  "value": "Code",
                  "className": "text-sm font-medium text-muted-foreground"
                },
                {
                  "type": "code-block",
                  "language": "json",
                  "code": "{ ... }",
                  "showCopy": true
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Phase 2: Code Editor Component (Weeks 2-4)

**Develop a `code-editor` component:**

```typescript
// packages/components/src/renderers/CodeEditorRenderer.tsx
import { Editor } from '@monaco-editor/react';

interface CodeEditorSchema {
  type: 'code-editor';
  language: 'json' | 'typescript' | 'javascript';
  value: string;
  onChange?: string; // Action reference
  height?: string;
  readOnly?: boolean;
}

export const CodeEditorRenderer = ({ schema, value, onChange }) => {
  return (
    <Editor
      height={schema.height || '300px'}
      language={schema.language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        readOnly: schema.readOnly
      }}
    />
  );
};
```

**Then create an interactive playground component:**

```typescript
// packages/components/src/renderers/PlaygroundRenderer.tsx
export const PlaygroundRenderer = ({ schema }) => {
  const [code, setCode] = useState(JSON.stringify(schema.defaultSchema, null, 2));
  const [parsedSchema, setParsedSchema] = useState(schema.defaultSchema);

  useEffect(() => {
    try {
      setParsedSchema(JSON.parse(code));
    } catch (e) {
      // Handle error
    }
  }, [code]);

  return (
    <div className="grid gap-4">
      {/* Preview */}
      <Card>
        <SchemaRenderer schema={parsedSchema} />
      </Card>
      
      {/* Editor */}
      <CodeEditor
        language="json"
        value={code}
        onChange={setCode}
      />
    </div>
  );
};
```

### Phase 3: Dedicated Playground App (Month 2-3)

**Build a separate playground application:**

- Full-featured code editor
- Multiple panes (files, preview, console)
- Share functionality
- Template library
- AI assistance (future)

## 📚 Component Documentation Template

### Minimum Required Information

Each component page should include:

1. **Name** - Component type identifier
2. **Description** - What it does (1-2 sentences)
3. **Usage** - When to use it
4. **Props/Schema** - Available options
5. **Examples** - 2-3 common use cases
6. **Code** - JSON schema for each example
7. **Accessibility** - ARIA labels, keyboard support
8. **Related** - Links to similar components

### Example: Button Component

```markdown
# Button

Trigger actions and events with customizable buttons.

## Usage

Use buttons to enable users to take actions, submit forms, or navigate to other pages. Choose the appropriate variant based on the action's importance and context.

## Schema

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| type | string | - | Must be "button" |
| label | string | - | Button text |
| variant | string | "default" | Visual style |
| size | string | "default" | Button size |
| disabled | boolean | false | Disable interaction |
| icon | string | - | Lucide icon name |

## Examples

### Primary Action
Use for the main action on a page.
[Preview]
[Code]

### Secondary Action
Use for less important actions.
[Preview]
[Code]

### Destructive Action
Use for delete or dangerous actions.
[Preview]
[Code]
```

## 🎨 Visual Design

### Layout Structure

```
┌────────────────────────────────────────────────┐
│ Component Name                                 │
│ Brief description                              │
├────────────────────────────────────────────────┤
│                                                │
│ When to use this component...                 │
│                                                │
├────────────────────────────────────────────────┤
│ Installation                                   │
│ npm install @object-ui/components              │
├────────────────────────────────────────────────┤
│ Example 1: Primary Button                     │
│ ┌──────────────────────────────────────────┐  │
│ │                                          │  │
│ │    [Rendered Component Preview]          │  │
│ │                                          │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ ```json                                        │
│ {                                              │
│   "type": "button",                            │
│   "label": "Click me"                          │
│ }                                              │
│ ```                                            │
│ [Copy Code]                                    │
├────────────────────────────────────────────────┤
│ Props                                          │
│ [Table of all properties]                     │
├────────────────────────────────────────────────┤
│ Related Components                             │
│ • Link • IconButton • DropdownMenu            │
└────────────────────────────────────────────────┘
```

## 🔧 Technical Implementation

### Adding Code Blocks to Showcase

**Step 1: Create a markdown/code renderer**

If not already available, create a component to display formatted code:

```json
{
  "type": "code-block",
  "language": "json",
  "code": "{\n  \"type\": \"button\",\n  \"label\": \"Click me\"\n}",
  "showLineNumbers": true,
  "showCopy": true
}
```

**Step 2: Update component pages**

For each component in `examples/showcase/pages/`, add structured documentation sections.

**Step 3: Add copy functionality**

Users should be able to copy code with one click.

### Interactive Editing (Future)

**Requirements:**
- Code editor (Monaco Editor recommended)
- Real-time JSON parsing
- Error handling
- State management

**Libraries:**
- `@monaco-editor/react` - VS Code editor
- `react-json-view` - JSON viewer/editor
- `prism-react-renderer` - Syntax highlighting

## 📱 Responsive Design

Ensure the documentation works well on all devices:

- **Desktop**: Side-by-side preview and code
- **Tablet**: Stacked with good spacing
- **Mobile**: Single column, collapsible sections

## ♿ Accessibility

- Keyboard navigation for all interactive elements
- Screen reader announcements for code copying
- Focus indicators
- ARIA labels

## 🚀 Getting Started

### For Contributors

To add documentation for a new component:

1. Create a new file in `examples/showcase/pages/[category]/[component].json`
2. Follow the template structure above
3. Include description, examples, and code
4. Test on all screen sizes
5. Submit PR

### For Users

To use the interactive documentation:

1. Visit the showcase at `http://localhost:3000` (or deployed URL)
2. Navigate to the component you want to use
3. Read the description and usage guidelines
4. Copy the JSON code
5. Paste into your project
6. Customize as needed

## 🔗 Related Documentation

- [Showcase Guide](./showcase.md) - Complete showcase overview
- [Component Registry](./component-registry.md) - All available components
- [Schema Rendering](./schema-rendering.md) - How the engine works

---

**Status**: Phase 1 (Enhanced Documentation) is recommended for immediate implementation.
**Timeline**: 1-2 weeks for Phase 1, 1 month for Phase 2, 2-3 months for Phase 3.
