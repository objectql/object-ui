---
title: "Object UI Documentation"
---

This directory contains the VitePress documentation site for Object UI.

## Quick Links

### For Users
- 🏠 [Homepage](./index.md)
- 📖 [Getting Started Guide](./guide/introduction.md)
- 🚀 [Quick Start](./guide/quick-start.md)
- 📦 [Installation](./guide/installation.md)
- 🎨 [Visual Studio](./guide/studio.md)
- 🗺️ [Roadmap](./ROADMAP.md)

### For Developers
- ⚡ [Quick Start for Developers](./quick-start-dev.md) - Get started in 5 minutes
- 📋 [Development Plan](./development-plan.md) - Q1-Q2 2026 priorities and roadmap
- 🤝 [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- 📚 [Best Practices](./BEST_PRACTICES.md) - Code quality guidelines

## Documentation Structure

```
docs/
├── .vitepress/
│   ├── config.mts       # VitePress configuration
│   └── dist/            # Build output (generated)
│
├── guide/               # User Guides
│   ├── introduction.md      # What is Object UI
│   ├── quick-start.md       # 5-minute tutorial
│   ├── installation.md      # Setup instructions
│   ├── studio.md           # Visual designer guide
│   ├── schema-rendering.md  # Schema rendering concepts
│   ├── component-registry.md # Component registration
│   └── expressions.md       # Expression system
│
├── protocol/            # Protocol Specifications
│   ├── overview.md          # Protocol overview
│   ├── implementation-status.md  # Status tracking
│   ├── object.md           # Object protocol
│   ├── view.md             # View protocol
│   ├── page.md             # Page protocol
│   ├── form.md             # Form protocol
│   ├── menu.md             # Menu protocol
│   ├── app.md              # App protocol
│   └── report.md           # Report protocol
│
├── api/                 # API Documentation
│   ├── core.md             # @object-ui/core API
│   ├── react.md            # @object-ui/react API
│   ├── components.md       # @object-ui/components API
│   └── designer.md         # @object-ui/designer API
│
├── spec/                # Technical Specifications
│   ├── architecture.md      # System architecture
│   ├── project-structure.md # Code organization
│   ├── schema-rendering.md  # Rendering spec
│   ├── component.md         # Component metadata spec
│   ├── base-components.md   # Base components spec
│   ├── component-library.md # Component library reference
│   └── component-package.md # Creating component packages
│
├── components/          # Component Examples
│   ├── form.md             # Form component guide
│   └── calendar-view.md    # Calendar view guide
│
├── public/              # Static assets
├── index.md            # Homepage
├── ROADMAP.md          # Product roadmap
└── package.json        # Docs workspace config
```

## Development

### Start Development Server

```bash
# From repository root
pnpm docs:dev

# Or from docs directory
pnpm dev
```

Visit `http://localhost:5173` to see the site.

### Build for Production

```bash
# From repository root
pnpm docs:build

# Or from docs directory
pnpm build
```

The built site will be in `docs/.vitepress/dist/`.

### Preview Built Site

```bash
# From repository root
pnpm docs:preview

# Or from docs directory
pnpm preview
```

## Adding Content

### New Guide Page

1. Create a new `.md` file in `guide/`
2. Add it to the sidebar in `.vitepress/config.mts`:

```typescript
{
  text: 'Getting Started',
  items: [
    // ... existing items
    { text: 'Your New Guide', link: '/guide/your-new-guide' }
  ]
}
```

### New Protocol Specification

1. Create a new `.md` file in `protocol/`
2. Add it to the protocol sidebar section in `.vitepress/config.mts`
3. Update `implementation-status.md` with the status

### New API Documentation

1. Create a new `.md` file in `api/`
2. Add it to the API sidebar in `.vitepress/config.mts`

### New Component Example

1. Create a new `.md` file in `components/`
2. Add it to the components sidebar in `.vitepress/config.mts`

## Documentation Guidelines

### Writing Style

- Use clear, concise language
- Provide code examples for all concepts
- Include both JSON schemas and React code where relevant
- Use TypeScript for code examples
- Add practical, real-world examples

### Markdown Features

VitePress supports enhanced Markdown:

#### Code Groups

```markdown
::: code-group

```bash [npm]
npm install @object-ui/react
```

```bash [pnpm]
pnpm add @object-ui/react
```

:::
```

#### Custom Containers

```markdown
::: tip
This is a tip
:::

::: warning
This is a warning
:::

::: danger
This is a danger message
:::

::: info
This is an info message
:::
```

#### Code Highlighting

Specify language and highlight lines:

```markdown
```ts{2,4-6}
interface Schema {
  type: string  // [!code highlight]
  id?: string
  className?: string // [!code focus]
  props?: Record<string, any>
}
```
```

### Cross-References

Use relative links for internal documentation:

```markdown
See [Schema Rendering](./schema-rendering.md) for details.
See [Protocol Overview](/protocol/overview) for specs.
```

### Front Matter

Add front matter for page metadata:

```markdown
---
title: My Page Title
description: Page description for SEO
---

# My Page Title
```

## Customization

### Theme Configuration

Edit `.vitepress/config.mts` to customize:

- **Navigation menu** - Top navigation bar
- **Sidebar structure** - Left sidebar per section
- **Site metadata** - Title, description, base URL
- **Theme settings** - Colors, fonts, layout
- **Search** - Local search configuration
- **Social links** - GitHub, Twitter, etc.

### Custom Components

Add custom Vue components in `.vitepress/theme/`:

```
.vitepress/
└── theme/
    ├── index.ts        # Theme entry
    └── components/     # Custom components
        └── MyComponent.vue
```

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch.

See `.github/workflows/deploy-docs.yml` for the deployment configuration.

### Manual Deployment

```bash
# Build the docs
pnpm docs:build

# Deploy to GitHub Pages
# (This is typically done automatically via GitHub Actions)
```

## Testing

Before committing documentation changes:

1. **Build locally** - Ensure no build errors
   ```bash
   pnpm docs:build
   ```

2. **Check links** - Verify all internal links work
   ```bash
   # VitePress will warn about dead links during build
   ```

3. **Preview** - View the built site
   ```bash
   pnpm docs:preview
   ```

4. **Proofread** - Check spelling and grammar

## Need Help?

- 📖 [VitePress Documentation](https://vitepress.dev/)
- 💬 [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions)
- 🐛 [Report Issues](https://github.com/objectstack-ai/objectui/issues)

## Contributing

We welcome documentation contributions! Please read our [Contributing Guide](../CONTRIBUTING.md) for details.

### Documentation Improvements

To contribute documentation:

1. Fork the repository
2. Create a branch: `git checkout -b docs/your-improvement`
3. Make your changes in the `docs/` directory
4. Test locally with `pnpm docs:dev`
5. Commit and push
6. Open a pull request

### Style Guide

- Use sentence case for headings
- Keep paragraphs short and focused
- Include code examples with explanations
- Add screenshots for visual features
- Link to related documentation
- Keep examples simple and runnable
