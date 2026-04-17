# Quick Reference

A one-page cheat-sheet for working in the `objectui` monorepo.

## Common Commands

### Install & Build

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build every package (turbo, parallel & cached)
pnpm typecheck            # Run tsc --noEmit across the workspace
pnpm lint                 # Run eslint across the workspace
```

### Run Docs & Storybook

```bash
pnpm --filter @object-ui/site dev        # Docs site at http://localhost:3000
pnpm storybook                           # Component playground at http://localhost:6006
```

### Test

```bash
pnpm test                                 # Run every vitest project
pnpm --filter @object-ui/console test     # Run just the console tests
pnpm --filter @object-ui/core test        # Run a single package's tests
pnpm playwright test                      # End-to-end tests
```

### Run Examples

```bash
pnpm --filter @object-ui/example-crm dev          # CRM demo
pnpm --filter @object-ui/example-todo dev         # Todo demo
pnpm --filter @object-ui/example-kitchen-sink dev # Kitchen-sink showcase
```

### Release (via changesets)

```bash
pnpm changeset                 # Author a changeset for your PR
pnpm changeset version         # Apply changesets & bump versions
pnpm changeset publish         # Publish to npm (CI only)
```

## Repository Layout

| Path | Purpose |
| --- | --- |
| `packages/*` | 39 published packages (`@object-ui/*`, `@objectstack/plugin-ui`) |
| `apps/console` | Full ObjectUI console app (Vite + React) |
| `apps/site` | Public docs site at <https://www.objectui.org> (fumadocs) |
| `apps/server` | Vercel backend for `demo.objectstack.ai` |
| `examples/*` | Runnable integration examples (CRM, todo, minimal-console, …) |
| `content/docs/` | MDX source for the docs site |
| `e2e/` | Playwright end-to-end tests |
| `.changeset/` | Pending release notes |

## Package Tiers

| Tier | Location | Role |
| --- | --- | --- |
| Protocol | `packages/types` | Pure TypeScript types (no runtime deps) |
| Engine | `packages/core` | Registry, expression engine, action runner |
| Atoms | `packages/components` | Shadcn primitives |
| Fields | `packages/fields` | Form field widgets |
| Layout | `packages/layout`, `packages/app-shell` | Page skeletons |
| Plugins | `packages/plugin-*` | Heavy view widgets (grid, kanban, charts, …) |
| Runtime | `packages/react`, `packages/runner` | React bindings & bootstrap |
| Adapters | `packages/data-objectstack`, `packages/providers` | Data source integration |
| Platform | `packages/auth`, `packages/permissions`, `packages/tenant`, `packages/i18n`, `packages/mobile`, `packages/collaboration` | Cross-cutting concerns |
| Tooling | `packages/cli`, `packages/create-plugin`, `packages/vscode-extension` | Developer experience |

## Key Documents

- [README.md](./README.md) — project overview & quick start
- [CHANGELOG.md](./CHANGELOG.md) — release notes
- [ROADMAP.md](./ROADMAP.md) — development plan
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution workflow
- [`content/docs/`](./content/docs/) — full documentation source

## Current Release

- **Version:** v3.3.0 (first official release)
- **Spec:** `@objectstack/spec` v3.3.0
- **Client:** `@objectstack/client` v3.3.0
- **Node.js:** ≥ 18
- **React:** 18.x or 19.x
- **TypeScript:** ≥ 5.0 (strict mode)
