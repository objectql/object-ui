# Plugin Markdown

Markdown renderer with GitHub Flavored Markdown support.

## Installation

```bash
npm install @object-ui/plugin-markdown
```

## Usage

### Basic Usage

```tsx
// Import once in your app entry point
import '@object-ui/plugin-markdown'

// Use in schemas
const schema = {
  type: 'markdown',
  content: '# Hello World\n\nThis is **markdown** text with [links](https://example.com).'
}
```

## Features

- **GitHub Flavored Markdown** (tables, task lists, strikethrough)
- **XSS protection** (sanitized output)
- **Code syntax highlighting**
- **Lazy-loaded** (~100-200 KB loads only when rendered)

## Schema API

```typescript
{
  type: 'markdown',
  content?: string,    // Markdown content
  className?: string   // Tailwind classes
}
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | string | `''` | Markdown content to render |
| `className` | string | `''` | Additional Tailwind CSS classes |

## Supported Markdown Features

### Headers

```markdown
# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header
```

### Text Formatting

```markdown
**Bold text**
*Italic text*
~~Strikethrough~~
`Inline code`
```

### Links and Images

```markdown
[Link text](https://example.com)
![Alt text](https://example.com/image.jpg)
```

### Lists

```markdown
- Unordered item 1
- Unordered item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2
   1. Nested ordered item
```

### Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Code Blocks

````markdown
```javascript
function hello() {
  console.log("Hello, World!");
}
```
````

### Blockquotes

```markdown
> This is a blockquote
> It can span multiple lines
```

### Horizontal Rules

```markdown
---
***
___
```

## Examples

### Documentation Page

```tsx
const docSchema = {
  type: 'markdown',
  content: `
# Getting Started

Welcome to our documentation!

## Installation

Install the package using npm:

\`\`\`bash
npm install our-package
\`\`\`

## Quick Start

1. Import the package
2. Configure your settings
3. Start building!

For more information, see the [API Reference](/api).
  `,
  className: 'prose prose-lg max-w-none'
}
```

### README Viewer

```tsx
const readmeSchema = {
  type: 'markdown',
  content: `
# Project Name

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

A brief description of the project.

## Features

- ✅ Feature 1
- ✅ Feature 2
- ✅ Feature 3

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`javascript
import { Component } from 'project-name'

const app = new Component()
app.run()
\`\`\`

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md).

## License

MIT
  `,
  className: 'prose dark:prose-invert'
}
```

### Release Notes

```tsx
const releaseNotes = {
  type: 'markdown',
  content: `
# Release Notes - v2.5.0

## 🎉 New Features

- Added dark mode support
- Improved performance by 40%
- New dashboard components

## 🐛 Bug Fixes

- Fixed login redirect issue (#123)
- Resolved memory leak in table component (#456)

## 🔄 Changes

- Updated dependencies
- Improved documentation
- Refactored authentication flow

## ⚠️ Breaking Changes

- Removed deprecated \`oldAPI\` method
- Changed config file format from JSON to YAML

## 📦 Dependencies

| Package | Old Version | New Version |
|---------|------------|-------------|
| react   | 18.2.0     | 18.3.0      |
| vite    | 4.5.0      | 5.0.0       |
  `
}
```

### API Documentation

```tsx
const apiDocs = {
  type: 'markdown',
  content: `
# API Reference

## Methods

### \`getData(id: string): Promise<Data>\`

Fetches data by ID.

**Parameters:**
- \`id\` (string) - The unique identifier

**Returns:**
- Promise resolving to Data object

**Example:**
\`\`\`typescript
const data = await getData('user-123')
console.log(data.name)
\`\`\`

### \`updateData(id: string, updates: Partial<Data>): Promise<void>\`

Updates existing data.

**Parameters:**
- \`id\` (string) - The unique identifier
- \`updates\` (Partial<Data>) - Fields to update

**Example:**
\`\`\`typescript
await updateData('user-123', { name: 'John Doe' })
\`\`\`
  `
}
```

## Styling with Tailwind

Use Tailwind Typography plugin for better markdown styling:

```tsx
const schema = {
  type: 'markdown',
  content: '# My Document\n\nContent here...',
  className: 'prose prose-lg prose-slate dark:prose-invert max-w-none'
}
```

Common prose classes:

- `prose` - Base typography styles
- `prose-sm` / `prose-lg` / `prose-xl` - Size variants
- `prose-slate` / `prose-gray` - Color schemes
- `dark:prose-invert` - Dark mode support
- `max-w-none` - Remove max-width constraint

## Security (XSS Protection)

All markdown content is automatically sanitized using `rehype-sanitize` to prevent XSS attacks:

```tsx
// Safe - HTML tags are sanitized
const schema = {
  type: 'markdown',
  content: '**Safe** markdown with <script>alert("XSS")</script>'
}
// The script tag will be removed in the output
```

## Bundle Size

The plugin uses lazy loading to optimize bundle size:

- **Initial load**: ~0.2 KB (entry point)
- **Lazy chunk**: ~100-200 KB (loaded when markdown is rendered)
- **Includes react-markdown and plugins**

## TypeScript Support

```typescript
import type { MarkdownSchema } from '@object-ui/plugin-markdown'

const markdownSchema: MarkdownSchema = {
  type: 'markdown',
  content: '# Hello TypeScript!'
}
```

## Related Documentation

- [Plugin System Overview](../guide/plugins.md)
- [Lazy-Loaded Plugins Architecture](../lazy-loaded-plugins.md)
- [Package README](https://github.com/objectstack-ai/objectui/tree/main/packages/plugin-markdown)
