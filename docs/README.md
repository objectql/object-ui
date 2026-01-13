# Object UI Documentation

This directory contains the VitePress documentation site for Object UI.

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

The built site will be in `docs/.vitepress/dist/`.

Preview the built site:

```bash
pnpm docs:preview
```

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch.

See `.github/workflows/deploy-docs.yml` for the deployment configuration.

## Structure

```
docs/
├── .vitepress/
│   ├── config.mts       # VitePress configuration
│   └── dist/            # Build output (generated)
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
├── roadmap.md          # Public roadmap
└── package.json        # Docs workspace config
```

## Adding Content

### New Guide Page

1. Create a new `.md` file in `guide/`
2. Add it to the sidebar in `.vitepress/config.mts`

### New Protocol Spec

1. Create a new `.md` file in `protocol/`
2. Add it to the protocol sidebar section in `.vitepress/config.mts`

## Customization

Edit `.vitepress/config.mts` to customize:
- Navigation menu
- Sidebar structure
- Site metadata
- Theme settings
