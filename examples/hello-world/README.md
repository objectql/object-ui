# Hello World — ObjectUI

A minimal example showing the **JSON → UI** flow: define a UI in JSON, render it with `SchemaRenderer`.

## What it demonstrates

1. **Schema** (`schema.json`) — a `Page` containing a `Card` with text and a button
2. **Renderer** (`App.tsx`) — passes the schema to `<SchemaRenderer>` which resolves each `type` from the component registry

## Files

```
examples/hello-world/
├── schema.json      # JSON UI definition
├── App.tsx          # React entry point
├── package.json
└── README.md
```

## How to run

```bash
# From the monorepo root
pnpm install

# Use App.tsx inside your own Vite/Next.js app,
# or explore the schema.json in Storybook:
pnpm --filter @object-ui/components storybook
```

## Learn more

- [CRM Example](../crm/) — full-featured reference app
- [Todo Example](../todo/) — ObjectStack protocol basics
- [Component Stories](../../packages/components/src/stories-json/) — all renderers in action
