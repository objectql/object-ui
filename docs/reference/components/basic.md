---
title: "Basic Components"
---

Fundamental UI elements for displaying simple content.

## Text `text`

Displays text with standardized typography styles.

```typescript
interface TextSchema {
  type: 'text';
  value: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'lead' | 'large' | 'small' | 'muted';
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string; // Text color class
}
```

## Html `html`

Render raw HTML content safely.

```typescript
interface HtmlSchema {
  type: 'html';
  html: string; // The HTML string to render
}
```

## Image `image`

Displays an image with optional fallback.

```typescript
interface ImageSchema {
  type: 'image';
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  fallback?: string; // URL for fallback image
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}
```

## Icon `icon`

Displays an icon from the Lucide library.

```typescript
interface IconSchema {
  type: 'icon';
  name: string; // Lucide icon name (kebab-case)
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}
```
