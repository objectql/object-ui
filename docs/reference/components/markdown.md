---
title: "Markdown Component"
---

Renders Markdown content with support for GFM (GitHub Flavored Markdown).

## Markdown `markdown`

```typescript
interface MarkdownSchema {
  type: 'markdown';
  content: string; // The markdown string
  className?: string; // Container style
}
```

**Features:**
- Automatic link rendering
- Table support
- Code syntax highlighting (via Prism or similar)
- Image rendering
