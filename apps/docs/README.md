# Object UI Documentation

This is the VitePress documentation site for Object UI.

## Development

Start the development server:

```bash
pnpm docs:dev
```

Visit `http://localhost:5173` to see the site.

## Building

Build the documentation:

```bash
pnpm docs:build
```

Preview the built site:

```bash
pnpm docs:preview
```

## Structure

```
apps/docs/
├── .vitepress/
│   └── config.mts       # VitePress configuration
├── guide/               # User guides
│   ├── introduction.md
│   ├── quick-start.md
│   └── installation.md
├── protocol/            # Protocol specifications
│   ├── overview.md
│   ├── object.md
│   ├── view.md
│   └── ...
├── api/                 # API documentation
│   ├── core.md
│   ├── react.md
│   ├── components.md
│   └── designer.md
├── index.md            # Homepage
└── roadmap.md          # Public roadmap
```

## Adding Content

### New Guide Page

1. Create a new `.md` file in `guide/`
2. Add it to the sidebar in `.vitepress/config.mts`

### New Protocol Spec

1. Create a new `.md` file in `protocol/`
2. Add it to the protocol sidebar section

## Customization

Edit `.vitepress/config.mts` to customize:
- Navigation menu
- Sidebar structure
- Site metadata
- Theme settings
