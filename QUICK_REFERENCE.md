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

### Run Docs

```bash
pnpm --filter @object-ui/site dev        # Docs site at http://localhost:3000
```

### Test

Always run vitest **from the repo root**, with paths written relative to it and **no
`--`** before them:

```bash
pnpm test                                              # Run every vitest project (CI runs this)
pnpm exec vitest run packages/core/                    # Run a single package's tests
pnpm exec vitest run packages/core/src/<file>.test.ts  # Run a single test file
pnpm exec vitest run apps/console/                     # Run just the console tests
pnpm playwright test                                   # End-to-end tests
```

Not `pnpm --filter <pkg> test`, not `turbo run test`, not `cd packages/x && pnpm exec
vitest`, and never a path behind `--`. Each of those moved vitest's root into a package,
where the root `unit`/`dom`/`dom-heavy` projects match nothing and only `apps/console`
resolves: 22 foreign files passed, your package never ran, output green
(objectui#3378/#3288). A guard in `vitest.config.mts` now **exits non-zero** on all of
them and prints the correct invocation:

```
vitest 调用被拒绝:从包目录跑 vitest 会静默跑错测试集 (objectui#3378)
...
正确跑法 —— 一律在【仓库根目录】执行,路径前【不要】加 `--`:
  pnpm exec vitest run packages/<pkg>/src/<file>.test.ts   # 只跑一个文件
  pnpm exec vitest run packages/<pkg>/   # 只跑一个包
  pnpm test   # 全量(CI 跑的就是它)
```

Details in [AGENTS.md](./AGENTS.md) (“怎么跑测试”) and `scripts/vitest-invocation-guard.mjs`.

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
| `packages/*` | 39 published packages (`@object-ui/*`) |
| `apps/console` | Full ObjectUI console app (Vite + React) |
| `apps/site` | Public docs site at <https://www.objectui.org> (fumadocs) |
| `apps/server` | Vercel backend for `demo.objectstack.ai` |
| `examples/*` | Runnable integration examples (CRM, todo, byo-backend-console, console-starter, …) |
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

- **Version:** v3.3.2 (latest published patch; v3.3.0 was the first official release of the 39-package set)
- **Spec:** `@objectstack/spec` ^4.0.4 (upgraded from 3.3.x — UI sub-export remains backward compatible)
- **Client:** `@objectstack/client` ^4.0.4
- **Node.js:** ≥ 20 (see root `engines.node`)
- **pnpm:** ≥ 9 (the workspace pins `pnpm@10.31.0` via `packageManager`)
- **React:** 18.x or 19.x
- **TypeScript:** ≥ 5.0 (strict mode)

> Pending unreleased work is queued in `.changeset/` (currently: `mobile-ux-round2.md`
> patches `plugin-kanban`, `plugin-calendar`, `plugin-timeline`).
