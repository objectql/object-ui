---
title: "Components API"
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

*   [Layout Components](../components/layout.md) (Grid, Card, Container, etc.)
*   [Basic Components](../components/basic.md) (Text, Image, Icon, HTML)
*   [Form Components](../components/form.md) (Input, Select, Checkbox, Form, etc.)
*   [Data Display](../components/data-display.md) (Table, List, Tag, Tree, etc.)
*   [Navigation](../components/navigation.md) (Button, Link, Menu, etc.)
*   [Feedback](../components/feedback.md) (Alert, Progress, Toast, etc.)
*   [Overlay](../components/overlay.md) (Dialog, Drawer, Tooltip, etc.)

## Plugins

*   [Charts](../components/charts.md) (Bar, Line, Pie, etc.)
*   [Kanban](../components/kanban.md) (Board View)
*   [Markdown](../components/markdown.md) (Rich Text)
