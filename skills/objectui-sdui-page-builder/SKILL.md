---
name: objectui-sdui-page-builder
description: Build and integrate Schema-Driven UI pages in third-party projects using Object UI. Use this skill whenever the user asks to create app pages from JSON schemas, wire SchemaRenderer into an existing React app, implement CRUD/dashboard/form/list/detail pages with Object UI, or migrate handwritten React pages to schema-driven rendering. Use it even if the user does not explicitly mention "skill" or "SchemaRenderer" but describes metadata-driven page development, console-like page composition, or JSON-to-UI workflows.
---

# ObjectUI SDUI Page Builder

Use this skill to guide app developers (not framework maintainers) to build production pages with Object UI's Schema-Driven UI Engine.

## What this skill should optimize for

- Deliver working page features quickly with JSON-first design.
- Keep architecture aligned with Object UI conventions.
- Keep third-party projects backend-agnostic through DataSource interfaces.
- Produce outputs that are immediately usable in app codebases.

## When to use this skill

Use this skill when requests include:

- "Build a page with Object UI / SchemaRenderer"
- "Create a CRUD/dashboard/form/detail page from JSON"
- "Integrate Object UI in an existing React/Vite/Next app"
- "Design a metadata-driven page similar to console"
- "Move an existing React page to schema-driven rendering"

Do not use this skill for:

- Modifying Shadcn upstream primitives under `packages/components/src/ui/**`.
- Core engine internals that belong to `@object-ui/core` maintenance.
- Non-UI backend implementation unrelated to schema rendering.

## Required mindset

1. JSON first, React second.
2. Protocol compatibility before convenience shortcuts.
3. Reusable schema blocks before one-off page code.
4. DataSource abstraction over hardcoded transport logic.

## Standard workflow

### 1. Frame the page contract first

Before writing implementation code, define:

- Page purpose (dashboard, list, detail, form, wizard, board).
- Required data inputs and output actions.
- User roles and visibility rules.
- Interaction model (navigation, submit, bulk actions, modals).

Then produce a first schema draft.

### 2. Select the right package boundaries

Use these boundaries in guidance and generated code:

- `@object-ui/types`: schema and typed interfaces.
- `@object-ui/core`: expression/action/registry logic.
- `@object-ui/components`: base visual components and wrappers.
- `@object-ui/fields`: form input renderers.
- `@object-ui/layout`: shell and page composition.
- `@object-ui/plugin-*`: heavy feature widgets (grid, charts, kanban, map).
- `@object-ui/react`: `SchemaRenderer`, provider wiring, runtime bridge.

When helping third-party apps, consume these packages; avoid duplicating core runtime logic in the app layer.

### 3. Compose schema using proven node shape

Use a strict component schema shape similar to:

```json
{
  "type": "card",
  "id": "customer_summary",
  "className": "col-span-12 lg:col-span-4",
  "props": {
    "title": "Customer Summary"
  },
  "hidden": "${data.userRole !== 'admin'}",
  "children": [
    {
      "type": "text",
      "props": {
        "content": "Active users: ${data.metrics.activeUsers}"
      }
    }
  ]
}
```

Prefer expression-based behavior (`hidden`, `disabled`, computed props) over imperative branching in component code.

### 4. Wire renderer and registry cleanly

Typical integration sequence:

1. Register default renderers/components.
2. Register plugin components needed by the page type.
3. Provide `dataSource` and contextual data through renderer provider.
4. Render schema via `SchemaRenderer`.

Keep custom component registrations namespaced to avoid collisions.

### 5. Use action data, not inline callback spaghetti

Represent interactions as data where possible:

```json
{
  "events": {
    "onClick": [
      { "action": "validate", "target": "customer_form" },
      { "action": "submit", "target": "customer_form" },
      { "action": "navigate", "params": { "url": "/customers" } }
    ]
  }
}
```

If custom app-side handlers are needed, isolate them in action handlers instead of embedding business logic into presentation components.

### 6. Validate responsiveness and accessibility

For every generated page, ensure:

- Responsive layout behavior (mobile/tablet/desktop).
- Semantic labels and ARIA fields where relevant.
- Keyboard-safe interactions for forms and actions.
- Error and loading states are present in schema or wrappers.

### 7. Ship with verification artifacts

Always include:

- Final page schema JSON.
- Integration code snippet (provider + renderer + registry wiring).
- Test checklist (rendering, expressions, actions, data loading).
- Optional migration notes if replacing legacy React page code.

## Output format

Always structure results in this order:

1. `Page Goal` - one paragraph.
2. `Schema JSON` - complete runnable draft.
3. `Integration Steps` - app wiring steps.
4. `Code Snippets` - minimal required TS/TSX examples.
5. `Validation Checklist` - what to test before merge.
6. `Extension Options` - how to add fields/plugins/actions next.

## Console-inspired patterns to reuse

When users ask for a "console-like" experience, prefer:

- App-shell layout with persistent navigation.
- Metadata-driven detail pages composed from widgets.
- Registry-based component resolution over switch/case rendering.
- PageSchema factories for page variants of the same domain entity.

## Expression evaluation boundaries

Understanding what gets evaluated and what does not is critical for correct schemas.

**Evaluated by SchemaRenderer automatically:**

| Field | What happens |
|-------|-------------|
| `props.*` | All values in the `props` object are expression-evaluated. Use `props.label`, `props.value`, etc. |
| `content` | Evaluated for text components. `"content": "Hello ${user.name}"` works. |
| `hidden` / `hiddenOn` | Boolean expression. Component removed from DOM when true. |
| `visible` / `visibleOn` | Boolean expression. `visible` takes priority over `hidden`. |
| `disabled` / `disabledOn` | Boolean expression. Passed as prop to component. |

**NOT evaluated (raw strings passed through):**

| Field | Workaround |
|-------|-----------|
| `value` (top-level) | Move to `props.value` |
| `label` (top-level) | Move to `props.label` |
| `description` (top-level) | Move to `props.description` |
| `className` | Not expression-evaluated. Use static Tailwind classes only. |
| `id` | Static string. No expressions. |

**Correct pattern:**
```json
{
  "type": "statistic",
  "props": {
    "label": "Active Users",
    "value": "${data.metrics.activeUsers}",
    "description": "+${data.metrics.growth}% from last month"
  }
}
```

**Wrong pattern (value will show as raw `${...}` text):**
```json
{
  "type": "statistic",
  "value": "${data.metrics.activeUsers}",
  "label": "${data.labels.title}"
}
```

For the full expression syntax reference (operators, formula functions, security model), see the `objectui-schema-expressions` skill.

## CSS theming template for third-party apps

Third-party projects must set up Tailwind + Shadcn CSS variables correctly. Without this, Object UI components render unstyled.

**Required `src/index.css`:**
```css
@import "tailwindcss";

/* Scan ObjectUI packages so Tailwind generates their utility classes */
@source "../../packages/components/src/**/*.tsx";
@source "../../packages/fields/src/**/*.tsx";
@source "../../packages/layout/src/**/*.tsx";
@source "../../packages/react/src/**/*.tsx";
@source "../../node_modules/@object-ui/components/src/**/*.tsx";
@source "../../node_modules/@object-ui/fields/src/**/*.tsx";

/* Map Shadcn CSS variables to Tailwind 4 color tokens */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Light mode CSS variables (Shadcn defaults) */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

Adjust `@source` paths based on your project's location relative to `node_modules` or the monorepo root.

## Plugin integration in page schemas

When pages need heavy widgets (grids, forms, kanbans, charts), import the plugin package and ensure its components are registered before rendering.

**Grid plugin example:**
```json
{
  "type": "object-grid",
  "props": {
    "objectName": "products",
    "columns": [
      { "name": "name", "label": "Name", "type": "text" },
      { "name": "price", "label": "Price", "type": "currency" },
      { "name": "status", "label": "Status", "type": "select" }
    ]
  },
  "bind": "products"
}
```

**Form plugin example:**
```json
{
  "type": "object-form",
  "props": {
    "objectName": "customer",
    "mode": "edit",
    "fields": [
      { "name": "name", "label": "Name", "type": "text", "required": true },
      { "name": "email", "label": "Email", "type": "text" }
    ]
  }
}
```

**Kanban plugin example:**
```json
{
  "type": "kanban",
  "props": {
    "objectName": "tasks",
    "groupBy": "status"
  },
  "bind": "tasks"
}
```

Import plugins in your app entry point to trigger registration:
```typescript
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-kanban';
```

## Common mistakes to avoid

- Writing large bespoke React JSX trees before schema definition.
- Hardcoding API calls directly inside visual renderers.
- Introducing package coupling (for example, UI package depending on business logic package).
- Registering components without namespace in plugin-heavy projects.
- Skipping docs updates for newly introduced schema patterns.
- Putting expression values in top-level `value`/`label` fields instead of `props.*`.
- Missing Shadcn CSS variables — components render but look completely unstyled.
- Forgetting `@source` directives in Tailwind config — utility classes not generated for ObjectUI packages.

## Fast triage playbook for ambiguous requests

If the request is underspecified:

1. Infer likely page category (list/detail/form/dashboard).
2. Produce a minimal viable schema first.
3. Mark assumptions clearly.
4. Provide one conservative and one advanced variant.

This keeps momentum while inviting focused user feedback.

## Example prompts this skill should handle well

- "In our CRM app, create a customer detail page with tabs, related orders, and action buttons using SchemaRenderer."
- "Migrate this existing React order list to Object UI schema, keep filters and bulk actions."
- "Set up a dashboard page in a Vite app with Object UI cards + chart plugin and role-based visibility."
- "My ObjectUI components are rendering but look completely unstyled — help me fix the CSS setup."
- "Add a kanban board to my existing schema-driven project page."
