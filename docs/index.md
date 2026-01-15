---
layout: home

hero:
  name: "Object UI"
  text: "The Modular Interface Engine"
  tagline: From JSON to world-class UI in minutes
  image:
    src: /logo.svg
    alt: Object UI
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/objectql/objectui

features:
  - icon: ⚡
    title: Blazing Fast
    details: Built on React 18+ with automatic optimizations. 3x faster page loads and 6x smaller bundles than traditional low-code platforms.
  
  - icon: 🎨
    title: Beautiful by Default
    details: Professional designs out of the box with Tailwind CSS and Shadcn/UI. Light/dark themes and full customization support.
  
  - icon: �️
    title: Visual Designer
    details: Drag-and-drop editor to build UIs visually. Real-time preview, property panels, and instant JSON export.
  
  - icon: 🚀
    title: Schema Driven
    details: Define your UI in JSON. No deep expertise in React, design systems, or CSS required.
  
  - icon: 🤖
    title: AI Powered
    details: Natural language to UI generation. Describe what you want and let AI create the schema.
  
  - icon: 🌍
    title: Cross Platform
    details: One schema works everywhere - web, mobile, desktop. Build once, run anywhere.
---

## Quick Example

```json
{
  "type": "form",
  "title": "Contact Us",
  "body": [
    {
      "type": "input",
      "name": "email",
      "label": "Your Email",
      "required": true
    },
    {
      "type": "textarea",
      "name": "message",
      "label": "Message"
    }
  ],
  "actions": [
    {
      "type": "submit",
      "label": "Send Message",
      "level": "primary"
    }
  ]
}
```

That's it! This JSON automatically creates a beautiful, accessible, and functional contact form.

## 🎨 Visual Designer

<div class="tip custom-block" style="border-color: #6366f1;">
  <p class="custom-block-title" style="color: #6366f1;">✨ Object UI Designer</p>
  <p>Object UI includes a visual designer package that allows you to build UIs with a drag-and-drop interface, live preview, and instant JSON export. Perfect for prototyping and learning!</p>
  <p style="margin-top: 12px;">See the <code>@object-ui/designer</code> package for more information.</p>
</div>

## Why Object UI?

<div class="tip custom-block">
  <p><strong>From JSON to World-Class UI</strong></p>
  <p>Building beautiful, performant, and accessible interfaces shouldn't require deep expertise in design systems, state management, or CSS. With Object UI, you describe what you want in JSON, and we handle the rest.</p>
</div>

### Built for Speed

- **3x faster** first contentful paint
- **6x smaller** bundle sizes  
- **Zero runtime** CSS overhead

### Modern Stack

- React 18+ with concurrent features
- Tailwind CSS for styling
- Shadcn/UI components
- TypeScript strict mode

### Production Ready

- WCAG 2.1 AA accessible
- 85%+ test coverage
- Enterprise security
- 99.9% uptime

## Getting Started

<div class="info custom-block">
  <p>Object UI is currently in preview. The Q1 2026 release will be production-ready.</p>
</div>

```bash
# Install the packages
npm install @object-ui/react @object-ui/components

# Start building
import { SchemaRenderer } from '@object-ui/react'
```

[Read the full guide →](/guide/introduction)

## Community

- ⭐ [Star on GitHub](https://github.com/objectql/objectui)
- 📧 [Email us](mailto:hello@objectui.org)
- 🐛 [Report issues](https://github.com/objectql/objectui/issues)
