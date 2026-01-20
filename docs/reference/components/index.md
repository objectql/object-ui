---
title: "Component Overview"
---

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

## Component Reference

Detailed documentation for each component category:

*   [Basic Components](./basic.md) (Text, Image, Icon, HTML)
*   [Layout Components](./layout.md) (Grid, Card, Container, etc.)
*   [Form Components](./form.md) (Input, Select, Checkbox, Form, etc.)
*   [Data Display](./data-display.md) (Table, List, Tag, Tree, etc.)
*   [Navigation](./navigation.md) (Button, Link, Menu, etc.)
*   [Feedback](./feedback.md) (Alert, Progress, Toast, etc.)
*   [Overlay](./overlay.md) (Dialog, Drawer, Tooltip, etc.)

## Plugins

*   [Charts](./charts.md) (Bar, Line, Pie, etc.)
*   [Kanban](./kanban.md) (Board View)
*   [Markdown](./markdown.md) (Rich Text)
