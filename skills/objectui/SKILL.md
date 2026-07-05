---
name: objectui
description: Universal Server-Driven UI (SDUI) Engine for building JSON-driven React interfaces with Shadcn design quality. Use for schema-driven page building, plugin development, component integration, testing, auth/permissions, data integration, i18n, mobile responsiveness, project setup, and ObjectUI console development. Triggers on ObjectUI, SchemaRenderer, JSON UI schemas, SDUI, metadata-driven UIs, `@object-ui/*` packages. Do NOT use for server-side ObjectStack concerns (data modelling, API endpoints, automation, formulas, agents) — those belong to the `objectstack-*` skills.
user-invocable: false
---

# ObjectUI

> **A Universal, Server-Driven UI (SDUI) Engine built on React + Tailwind + Shadcn.**

ObjectUI renders JSON metadata from the `@objectstack/spec` protocol into pixel-perfect, accessible, and interactive enterprise interfaces (Dashboards, Kanbans, CRUDs, Forms, Grids).

**Repository:** [github.com/objectstack-ai/objectui](https://github.com/objectstack-ai/objectui)

## Strategic Positioning

- **The "JSON-to-Shadcn" Bridge:** The only library combining Low-Code speed with Shadcn/Tailwind design quality.
- **The "Face" of ObjectStack:** Official renderer for the ecosystem, while remaining **Backend Agnostic**.

## Scope

**In scope** (use this skill):
- Anything under `packages/` in this repo — `@object-ui/*` core, plugins, components, fields, layout, providers, app-shell, runner, CLI.
- The `apps/console` and `apps/site` consumer apps.
- Authoring or debugging JSON schemas consumed by `<SchemaRenderer>`.

**Out of scope** (defer to sibling skills):
- Designing data objects, fields, validations, hooks → `objectstack-data`.
- REST/GraphQL endpoints, auth providers, route guards → `objectstack-api`.
- Flows, workflows, triggers, approvals → `objectstack-automation`.
- CEL formulas / predicates → `objectstack-formula`.
- Bootstrap, plugins, kernel hooks, drivers → `objectstack-platform`.
- ObjectQL query construction → `objectstack-query`.

## Core Principles

### 0. English-Only Codebase

This is an international open-source project. ALL user-facing text in components, documentation, comments, and UI labels MUST be written in English. Do NOT use Chinese or any other non-English language in component text, code comments, doc files, or console/log messages.

### 1. Strict Adherence to `@objectstack/spec`

All component schemas, JSON structures, and data types MUST strictly follow definitions in `@objectstack/spec`. Do not invent new schema properties — if the spec says `columns`, do not use `fields`. Check the spec before writing any `interface` or `type`.

### 2. Protocol Agnostic (The Universal Adapter)

Never hardcode `objectql.find()` or any specific backend call. Always go through the `DataSource` interface, injected via `<SchemaRendererProvider dataSource={...} />`. Users might back ObjectUI with REST, GraphQL, ObjectQL, or a local JSON file.

### 3. Documentation Driven Development

For EVERY feature implemented or refactored, you MUST update:
1. The package `README.md`.
2. The corresponding `content/docs/guide/*.md` (if guide-worthy).

A task is not "done" until docs reflect the new code.

### 4. "Shadcn Native" Aesthetics

We are essentially "Serializable Shadcn". When implementing a component (e.g. `Card`), strictly follow Shadcn's DOM structure (`CardHeader` / `CardTitle` / `CardContent`). ALWAYS expose `className` in the schema props so users can override styles from JSON.

### 5. The Action System (Interactivity)

Actions are defined **as data**, not functions. Example:

```json
{
  "events": {
    "onClick": [
      { "action": "validate", "target": "form_1" },
      { "action": "submit", "target": "form_1" },
      { "action": "navigate", "params": { "url": "/success" } }
    ]
  }
}
```

`@object-ui/core` dispatches these via an Event Bus.

### 6. Layout as Components

Layouts are just components that render children. Treat `Grid`, `Stack`, `Container` as first-class citizens. Layout schemas must support responsive props (e.g. `cols: { sm: 1, md: 2, lg: 4 }`).

### 7. Type Safety over Magic

- **No `any`:** use strict Generics.
- **Registry:** map type strings (`"type": "button"`) to React components via `ComponentRegistry`.
- **No `eval()` or runtime dynamic imports** for component resolution — security risk.

### 8. The "No-Touch" Zones (Shadcn Purity)

**Protected path:** `packages/components/src/ui/**/*.tsx` — these are upstream 3rd-party files overwritten by sync scripts. You are FORBIDDEN from modifying their logic or styles. To customize a primitive, wrap it in `packages/components/src/custom/` instead.

See `rules/no-touch-zones.md` for the full list and rationale.

## Tech Stack (Strict Constraints)

- **Core:** React 18+ (Hooks), TypeScript 5.0+ (Strict).
- **Styling:** Tailwind CSS (utility-first).
  - ✅ REQUIRED: `class-variance-authority` (cva) for variants, `tailwind-merge` + `clsx` (`cn()`) for overrides.
  - ❌ FORBIDDEN: inline styles (`style={{}}`), CSS Modules, Styled-components.
- **UI Primitives:** Shadcn UI (Radix UI) + Lucide Icons.
- **State:** Zustand (global), React Context (scoped).
- **Testing:** Vitest + React Testing Library + Playwright (E2E).

## Quick Reference

**Architecture & Patterns** → [`guides/architecture.md`](./guides/architecture.md)
*(package topology, JSON protocol shape, ComponentRegistry / SchemaRenderer patterns, AI workflows for adding components & actions)*

### Guides

- **App composition — choosing object nav vs views vs pages vs dashboards** → [`guides/app-composition.md`](./guides/app-composition.md)
- **Page building & schema design** → [`guides/page-builder.md`](./guides/page-builder.md)
- **Custom plugin development** → [`guides/plugin-development.md`](./guides/plugin-development.md)
- **Expression syntax & debugging** → [`guides/schema-expressions.md`](./guides/schema-expressions.md)
- **Data fetching & DataSource** → [`guides/data-integration.md`](./guides/data-integration.md)
- **New project setup (CLI, Vite, Tailwind, runner)** → [`guides/project-setup.md`](./guides/project-setup.md)
- **Testing components & schemas** → [`guides/testing.md`](./guides/testing.md)
- **Multi-language support** → [`guides/i18n.md`](./guides/i18n.md)
- **Mobile & responsive design** → [`guides/mobile.md`](./guides/mobile.md)
- **Auth, roles, tenants & permissions** → [`guides/auth-permissions.md`](./guides/auth-permissions.md)
- **Console development (`apps/console`, `app-shell`, providers, MSW debugging)** → [`guides/console-development.md`](./guides/console-development.md)

### Critical Global Rules

- **JSON protocol compliance** → [`rules/protocol.md`](./rules/protocol.md)
- **Styling & Tailwind usage** → [`rules/styling.md`](./rules/styling.md)
- **Component composition patterns** → [`rules/composition.md`](./rules/composition.md)
- **No-touch zones (Shadcn upstream)** → [`rules/no-touch-zones.md`](./rules/no-touch-zones.md)

## Common Mistakes to Avoid

- Writing large bespoke React JSX trees before defining a schema.
- Hardcoding API calls directly inside visual renderers.
- Introducing package coupling (e.g. a UI package depending on business logic).
- Registering components without a namespace in plugin-heavy projects.
- Skipping docs updates for newly introduced schema patterns.
- Putting expression values in top-level `value` / `label` fields instead of `props.*`.
- Missing Shadcn CSS variables — components render but look completely unstyled.
- Forgetting `@source` directives in Tailwind config — utility classes not generated for ObjectUI packages.

## Fast Triage Playbook for Ambiguous Requests

If the request is underspecified:

1. Infer likely page category (list / detail / form / dashboard).
2. Produce a minimal viable schema first.
3. Mark assumptions clearly.
4. Provide one conservative and one advanced variant.

This keeps momentum while inviting focused user feedback.

---

**You are the Architect. Build the Engine.**
