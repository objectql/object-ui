# Architecture & Implementation Patterns

Deep reference for the ObjectUI monorepo: package topology, the JSON protocol, the runtime patterns that glue them, and the AI workflows for extending the engine.

Load this guide when:

- Picking which package a new component / hook / type belongs in.
- Writing or extending the `ComponentRegistry`, `SchemaRenderer`, or any other core wiring.
- Choosing an integration approach for a third-party consumer.
- Onboarding to the layered package strategy.

For day-to-day schema authoring, see `guides/page-builder.md`. For plugin packaging specifics, see `guides/plugin-development.md`.

## Monorepo Topology

ObjectUI is a strict PNPM Workspace. Pick a package by **role + dependency weight**, never one-package-per-component.

### Core layers

| Package | Role | Responsibility | 🔴 Strict Constraints |
|---|---|---|---|
| `@object-ui/types` | The Protocol | Pure JSON Interfaces (ComponentSchema, ActionSchema). | ZERO dependencies. No React code. |
| `@object-ui/core` | The Engine | Schema Registry, Validation, Expression Evaluation, Action Engine, Plugin System. | No UI library dependencies. Logic Only. |
| `@object-ui/components` | The Atoms | Shadcn Primitives (Button, Badge, Card) & Icons. | Pure UI. No business logic. |
| `@object-ui/fields` | The Inputs | Standard Field Renderers (Text, Number, Select). | Must implement FieldWidgetProps. |
| `@object-ui/layout` | The Shell | Page Structure (Header, Sidebar, AppShell). | Routing-aware composition. |
| `@object-ui/react` | The Runtime | `<SchemaRenderer>`, hooks, spec bridge, `LazyPluginLoader`. | Bridges Core and Components. |

### Integration layer (third-party / console embedders)

| Package | Role | Responsibility |
|---|---|---|
| `@object-ui/app-shell` | Minimal Shell | Framework-agnostic `AppShell`, `ObjectRenderer`, `DashboardRenderer`, `PageRenderer`. Bring-your-own-router. |
| `@object-ui/providers` | Context Stack | Reusable `DataSourceProvider`, `MetadataProvider`, `ThemeProvider`. Console-free. |
| `@object-ui/runner` | Universal Runtime | Standalone runtime + dev server for schema-driven apps. Pre-wires popular plugins. |
| `@object-ui/data-*` | Data Adapters | Connectors for REST, ObjectQL, GraphQL (e.g. `@object-ui/data-objectstack`). |

### Platform features (opt-in)

| Package | Role |
|---|---|
| `@object-ui/auth` | `AuthProvider`, `useAuth`, `AuthGuard`, login/signup forms, `createAuthenticatedFetch`. |
| `@object-ui/permissions` | RBAC engine, `PermissionProvider`, object/field/row-level permission guards. |
| `@object-ui/tenant` | Multi-tenancy: `TenantProvider`, scoped queries, per-tenant branding. |
| `@object-ui/i18n` | i18n: 10+ language packs, RTL, date/currency formatters. |
| `@object-ui/mobile` | Mobile/PWA: responsive primitives, touch gestures, install prompts. |
| `@object-ui/collaboration` | Realtime: presence, live cursors, comment threads, conflict resolution. |

### Plugins (heavy / specialized widgets)

| Plugin | Purpose |
|---|---|
| `@object-ui/plugin-grid` | Schema-driven data grid (sorting, filtering, virtualization). |
| `@object-ui/plugin-list` / `plugin-detail` / `plugin-form` | List, Detail, Form view renderers. |
| `@object-ui/plugin-kanban` | Drag-and-drop kanban boards. |
| `@object-ui/plugin-calendar` / `plugin-timeline` / `plugin-gantt` | Time-based views. |
| `@object-ui/plugin-dashboard` / `plugin-report` | Dashboards and reports. |
| `@object-ui/plugin-charts` | Chart rendering (recharts-based). |
| `@object-ui/plugin-map` | Map widgets. |
| `@object-ui/plugin-editor` / `plugin-markdown` | Rich text + markdown editors. |
| `@object-ui/plugin-view` | View switcher / saved views. |
| `@object-ui/plugin-designer` | Visual schema designer canvas. |
| `@object-ui/plugin-workflow` | Workflow / process editor. |
| `@object-ui/plugin-ai` / `plugin-chatbot` | AI assistant + chatbot UI. |

### Tooling

| Package | Purpose |
|---|---|
| `@object-ui/cli` | `objectui` CLI: `init`, `dev`, `build`, `start`, `studio`, `validate`, `check`, `lint`, `test`, `generate`, `add`, `doctor`, `analyze`, `create plugin`. |
| `@object-ui/create-plugin` | `pnpm create-plugin <name>` scaffolder for new `plugin-*` packages. |
| `@object-ui/vscode-extension` | VSCode extension: syntax highlighting, IntelliSense, validation for ObjectUI JSON schemas. |

## Architectural Strategy

**❌ Do NOT create a package for every component.**

**✅ Group by Dependency Weight:**

1. **Atoms (`@object-ui/components`):** Shadcn Primitives. Zero heavy 3rd-party deps.
2. **Fields (`@object-ui/fields`):** Standard Inputs.
3. **Layouts (`@object-ui/layout`):** Page Skeletons.
4. **Plugins (`@object-ui/plugin-*`):** Heavy Widgets (>50KB) or specialized libraries (Maps, Editors, Charts).

**✅ Choose the right integration package:**

- **Building the full ObjectUI Console?** → use `apps/console` patterns (see `guides/console-development.md`).
- **Embedding ObjectUI into a third-party React app with your own router/shell?** → use `@object-ui/app-shell` + `@object-ui/providers`.
- **Running a schema as a standalone app?** → use `@object-ui/runner` or the `objectui` CLI.
- **Custom rendering only (no shell)?** → use `@object-ui/react` (`SchemaRenderer`) directly.

## The JSON Protocol (The "DNA")

Every node in the UI tree follows this shape — enforce it on every input.

```typescript
// @object-ui/types
interface UIComponent {
  /** The unique identifier for the renderer registry (e.g., 'input', 'grid', 'card') */
  type: string;

  /** Unique ID for DOM accessibility and event targeting */
  id?: string;

  /** Visual properties (mapped directly to Shadcn props) */
  props?: Record<string, any>;

  /** Data binding path (e.g., 'user.address.city') */
  bind?: string;

  /** Styling overrides (Tailwind classes) */
  className?: string;

  /** Dynamic Behavior */
  hidden?: string; // Expression: "${data.role != 'admin'}"
  disabled?: string; // Expression

  /** Event Handlers */
  events?: Record<string, ActionDef[]>; // onClick -> [Action1, Action2]

  /** Layout Slots */
  children?: UIComponent[];
}
```

See `rules/protocol.md` for which fields are expression-evaluated and which are not.

## Implementation Patterns

### Pattern A: The Component Registry (Extensibility)

How users add their own components (e.g. a `Map` widget):

```typescript
// packages/core/src/registry.ts
export type ComponentImpl = React.FC<{ schema: any; ... }>;

const registry = new Map<string, ComponentImpl>();

export function registerComponent(type: string, impl: ComponentImpl) {
  registry.set(type, impl);
}

export function resolveComponent(type: string) {
  return registry.get(type) || FallbackComponent;
}
```

### Pattern B: The Renderer Loop (Recursion)

How the schema tree becomes React:

```typescript
// packages/react/src/SchemaRenderer.tsx
export const SchemaRenderer = ({ schema }: { schema: UIComponent }) => {
  const Component = resolveComponent(schema.type);
  const { isHidden } = useExpression(schema.hidden);

  if (isHidden) return null;

  return (
    <Component
      schema={schema}
      className={cn(schema.className)}
      {...schema.props}
    >
      {schema.children?.map(child => (
        <SchemaRenderer key={child.id} schema={child} />
      ))}
    </Component>
  );
};
```

## AI Workflow Instructions

### On "Create New Component" (e.g. `DataTable`)

1. **Type Definition:** Update `@object-ui/types`. Define `DataTableSchema` (columns, sorting, pagination).
2. **Shadcn Mapping:** Look at `shadcn/ui/table`. Create `DataTableRenderer` in `@object-ui/components`.
3. **Data Scope:** Use `useDataScope()` to get the array data. Do not fetch data inside the component.
4. **Registration:** Register `"type": "table"` in the core registry.

### On "Action Logic" (e.g. `OpenModal`)

1. **Define Schema:** Add `OpenModalAction` interface to `@object-ui/types`.
2. **Implement Handler:** Add the logic to the ActionEngine in `@object-ui/core`.
3. **Visuals:** Ensure the triggering component calls `useActionRunner()`.

### On "Documentation"

1. **JSON First:** Always show the JSON configuration before any React code.
2. **Visuals:** Describe how Tailwind classes (`className`) affect the rendered component.
