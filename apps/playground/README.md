# Object UI Playground

A live, interactive playground to showcase Object UI's schema-driven rendering capabilities.

## Features

- **Split View Editor**: JSON editor with syntax validation on the left, live preview on the right
- **Real-time Rendering**: See your changes instantly as you edit JSON schemas
- **Example Gallery**: Curated examples organized by category (Primitives, Layouts, Forms)
- **Responsive Preview**: Toggle between desktop, tablet, and mobile viewports
- **Copy Schema**: One-click copy to clipboard for easy integration
- **Error Highlighting**: Clear JSON syntax error messages

## Examples Included

### Primitives
- Simple page layouts
- Input component states (required, disabled, email)
- Button variants (destructive, outline, ghost, etc.)

### Layouts
- Responsive grid layouts
- Analytics dashboard with KPI cards
- Tabs component demonstration

### Forms
- User registration form with various input types
- Grid-based form layouts

## Running the Playground

From the monorepo root:

```bash
pnpm install
pnpm --filter @apps/playground dev
```

Or from this directory:

```bash
pnpm install
pnpm dev
```

The playground will be available at `http://localhost:5174`

## Building for Production

```bash
pnpm build
```

## Purpose

This playground serves as:

1. **Product Demo**: Show what Object UI can do without any backend
2. **Learning Tool**: Help developers understand schema structure
3. **Testing Ground**: Experiment with different configurations
4. **Documentation**: Live, interactive examples are better than static code samples

## Key Selling Points Demonstrated

- ✅ **Tailwind Native**: Edit `className` properties and see instant results
- ✅ **Schema-Driven**: Everything is pure JSON - no JSX needed
- ✅ **Responsive**: Built-in responsive grid layouts
- ✅ **Complete**: From simple buttons to complex dashboards
- ✅ **Standalone**: No backend required - works with any data source
