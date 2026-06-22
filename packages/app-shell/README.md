# @object-ui/app-shell

**Minimal Application Shell for ObjectUI**

A lightweight, framework-agnostic rendering engine that enables third-party systems to integrate ObjectUI components without inheriting the full console infrastructure.

## Purpose

This package provides the essential building blocks for rendering ObjectUI schemas:
- Basic layout components (AppShell, Sidebar, Main)
- Renderer components for objects, dashboards, pages, and forms
- Zero console-specific dependencies
- Bring-your-own-router design

## Installation

```bash
pnpm add @object-ui/app-shell
```

## Usage

### Basic Setup

```tsx
import { AppShell, ObjectRenderer } from '@object-ui/app-shell';

function MyCustomConsole() {
  return (
    <AppShell sidebar={<MySidebar />}>
      <ObjectRenderer
        objectName="contact"
        dataSource={myDataSource}
      />
    </AppShell>
  );
}
```

### With Dashboard

```tsx
import { DashboardRenderer } from '@object-ui/app-shell';

function MyDashboard() {
  return (
    <DashboardRenderer
      schema={dashboardSchema}
      dataSource={myDataSource}
    />
  );
}
```

### With Custom Form

```tsx
import { FormRenderer } from '@object-ui/app-shell';

function MyForm() {
  return (
    <FormRenderer
      schema={formSchema}
      dataSource={myDataSource}
      onSuccess={() => console.log('Saved!')}
    />
  );
}
```

## Key Features

- **Zero Dependencies on Console**: No routing, no auth, no app management
- **Framework Agnostic**: Works with React Router, Next.js, Remix, or any router
- **Lightweight**: ~50KB vs 500KB+ for full console
- **Composable**: Mix and match components as needed
- **Type-Safe**: Full TypeScript support
- **Console AI Entry Point**: The lazy chatbot FAB keeps mobile bottom
  navigation clear until the full assistant panel is loaded
- **Full-Page AI Workspace**: The `/ai` surface provides a responsive chat
  workspace with a desktop conversation rail, mobile Chats drawer, and a
  constrained reading width for long conversations

## Components

### AppShell

Basic layout container with sidebar support.

```tsx
<AppShell
  sidebar={<YourSidebar />}
  header={<YourHeader />}
>
  {children}
</AppShell>
```

### ObjectRenderer

Renders object views (Grid, Kanban, List, etc.).

```tsx
<ObjectRenderer
  objectName="contact"
  viewId="grid-view"
  dataSource={dataSource}
  onRecordClick={(record) => navigate(`/detail/${record.id}`)}
/>
```

### DashboardRenderer

Renders dashboard layouts from schema.

```tsx
<DashboardRenderer
  schema={dashboardSchema}
  dataSource={dataSource}
/>
```

### PageRenderer

Renders custom page schemas.

```tsx
<PageRenderer
  schema={pageSchema}
/>
```

### FormRenderer

Renders forms (modal or inline).

```tsx
<FormRenderer
  schema={formSchema}
  dataSource={dataSource}
  mode="create" // or "edit"
  recordId={recordId}
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
```

## Metadata designers

The metadata-admin engine (`src/views/metadata-admin`) renders an in-app editor
for each metadata type. Every type has a pure-renderer **preview** that doubles
as its **designer** when given `editing` + `onPatch` props — no backend round
trip is required to edit a draft.

### Studio package scope

Studio treats the selected package as the authoring scope. The package selector
is mandatory, and Studio repairs missing `?package=` query parameters from the
last selected package or the first project package so scoped pages do not drift
out of sync with the sidebar. The Studio home overview, quick-create links,
metadata counts, and diagnostics all follow that active package. The dedicated
package-management page remains the global place to create, import, publish,
enable, or disable packages; direct `/metadata/package` links redirect there.
The Studio sidebar also flattens the root Overview group so Home and package
navigation sit directly under the package selector.

### Visual flow canvas

The `flow` designer (`FlowPreview` → `FlowCanvas`) renders an automation as an
industry-standard top-down node-link diagram (think n8n / Power Automate /
Salesforce Flow Builder) instead of a flat step list. It is **dependency-free**
— no ReactFlow / `@xyflow` — so the app-shell bundle stays lean.

**JSON shape** (a `flow` draft):

```jsonc
{
  "nodes": [
    { "id": "start", "type": "start", "label": "Start" },
    { "id": "decide", "type": "decision", "label": "Renew?",
      "ui": { "x": 220, "y": 180 } },   // optional persisted canvas position
    { "id": "email", "type": "action", "label": "Send reminder" },
    { "id": "end", "type": "end", "label": "End" }
  ],
  "edges": [
    { "source": "start", "target": "decide" },
    { "source": "decide", "target": "email", "condition": "${days <= 30}", "label": "Due" },
    { "source": "decide", "target": "end", "isDefault": true, "label": "Skip" },
    { "source": "email", "target": "end" }
  ]
}
```

- **Layout** — nodes without a `ui` hint are placed by a deterministic layered
  auto-layout (cycle-guarded), so a flow always renders cleanly even before any
  manual positioning. Dragging a node persists its position to `node.ui.{x,y}`;
  positions degrade gracefully (they are layout hints, not required data).
- **Edges** — branch semantics (`condition`, `label`, `isDefault`) are rendered
  as labels on the connectors and preserved when a node is inserted on an edge.

**Interactions** (design mode):

- **Add node** — toolbar palette (Action / Decision / Wait / Subflow / Signal /
  End); the new node is auto-selected.
- **Append** — the bottom `+` handle on a node adds a connected child.
- **Insert on edge** — the `+` on a connector splices a node between two nodes,
  preserving the original branch condition on the first segment.
- **Reposition** — drag a node (committed on pointer-up).
- **Delete** — `Delete` / `Backspace` removes the selected node and its edges.
- **Navigate** — fit-to-view, zoom in/out, and background pan.

Selecting a node opens `FlowNodeInspector`, which renders **typed form fields
per node type** (see `flow-node-config.ts`) rather than a raw JSON blob. Node
types follow the spec `FlowNodeAction` enum
(`@objectstack/spec/automation/flow.zod.ts`): `start`, `decision`,
`assignment`, `loop`, `create_record`, `update_record`, `delete_record`,
`get_record`, `http_request`, `script`, `screen`, `wait`, `subflow`,
`connector_action`, `parallel_gateway`, `join_gateway`, `boundary_event`,
`end`. Field keys mirror the **real production vocabulary** used by installed
apps (the spec leaves `config` freeform, so the app metadata is the de-facto
standard): a `start` node exposes *Object* / *Entry condition* (`criteria`,
a CEL string) / *Cron schedule* (`schedule`); the trigger **category** is a
flow-level concern, so `start` deliberately stores **no** `triggerType`. A
`decision` uses `condition`; `get_record`/`update_record`/`delete_record` use a
`filter` object; `loop` uses `iteratorVariable`. Spec **structured blocks** are
edited through dedicated fields, not JSON: a `wait` node maps `waitEventConfig.*`
(Wait-for / Duration / Timeout / On timeout), a `connector_action` maps
`connectorConfig.*` (Connector / Action / Input), and a `boundary_event` maps
`boundaryConfig.*`. CRUD/script/http fields live under `node.config`; spec
blocks and `timeoutMs` live at the node top-level. Type-specific fields sit under
a **Configuration** divider, and **conditional fields** (`showWhen`) only appear
when relevant — e.g. a `script` node switches between a *Code* / *Output
variables* shape and an *email/SMS* notification shape (*Template* / *Recipients*
/ *Template variables*) based on its *Action type* (`actionType`, defaulting to
`code`), and a `wait` node shows *Duration* / *Signal name* based on the selected
*Wait for* mode. A conditional field is never hidden while it still holds a
value, so existing config is always reachable.

Config keys come in three editable shapes so authors never hand-write JSON:

- **Flat object maps** — a `create_record` node's **Field values**, a
  `connector_action`'s **Input**, a `get_record`'s **Filter** — use an inline
  **key/value editor** (`keyValue` kind). Scalar values are auto-typed (`3` →
  number, `true` → boolean); object/array values such as a filter operator
  `{"$ne": null}` round-trip losslessly.
- **String arrays** — a script's **Recipients** / **Output variables** — use a
  single-column **string-list editor** (`stringList` kind).
- **Arrays of objects** — a `screen` node's **Fields** (a list of
  `{name,label,type,required,visibleWhen}` definitions) — use a column-driven
  **object-list repeater** (`objectList` kind).

Anything still not covered by a field (nested objects, arrays, plugin-specific
keys) lives in an **optional** Advanced (JSON) escape hatch: it is shown only
when such keys already exist, and is otherwise reachable through a low-emphasis
"Advanced (JSON)" button — it never alarms authors into thinking the form is
incomplete, and it can never overwrite a key a form field already owns. Node
types with no configuration (e.g. `parallel`) show a plain "No configuration
needed" note instead of an empty JSON box. The `ui` layout hint is always kept
out of the config entirely and preserved across edits.

### Flow simulator (designer-time debug runner)

The canvas toolbar has a **Debug** toggle that opens an in-designer **flow
simulator** (`FlowSimulatorPanel` → `simulator/flow-simulator.ts`). It lets a
low-code author *test a flow draft without a backend* — answering "how do I
mock-run and step through this flow?".

It is a **pure, client-side interpreter**. It **never** calls a `dataSource`:
every side-effecting node (CRUD / `get_record` / `http_request` /
`connector_action` / `script`) is **MOCKED**, so a simulation can never write or
delete real data and never needs a live environment. Its guiding rule is *never
silently simulate semantics that differ from the runtime* — anything that cannot
be faithfully modelled is surfaced loudly instead of faked.

- **Preflight validation** — before a run, `validateFlowDraft` blocks on
  structural errors (no resolvable entry, duplicate ids, edges to missing nodes,
  multiple decision defaults) and warns on soft issues (unreachable nodes, a
  decision with no default). Errors disable **Run** so problems surface up front.
- **Controls** — **Run** (to completion), **Step** (one node), **Reset**, and
  **Continue** (after a pause). Flow `variables` marked `isInput` become a seed
  form; values are auto-typed (`30` → number, `true` → boolean, `{…}` → JSON).
- **Set variables / Mock outputs** — because a decision often reads a value no
  declared input produces (e.g. a computed `daysToExpiry`), the panel adds a
  free-form **Set variables** editor that injects/overrides *any* variable at
  start, so **every branch is reachable**. A **Mock outputs** editor lets the
  author pin what each mocked side-effect node "returns" (written to its
  `outputVariable` / `outputVariables`), so data-dependent logic downstream of a
  `get_record` or `script` can be exercised too.
- **Semantics** — `start`/`assignment` pass through; a `decision` routes
  **edge-first** (first truthy outgoing `condition`, else the `isDefault` edge,
  else a surfaced dead-end), evaluating CEL via `@object-ui/core`'s
  `ExpressionEvaluator` and **surfacing eval errors** (not swallowing them);
  side-effect nodes write their mock to `outputVariable` / `outputVariables[]`;
  `wait` and `screen` **pause** for manual continue; `join_gateway`, `subflow`,
  and `boundary_event` are marked **unsupported** (token sync / nested runs are
  not modelled) rather than faked.
- **Live feedback** — the panel shows a **variable watch**, a **step timeline**
  (status badges `OK` / `MOCKED` / `PAUSED` / `SKIPPED` / `ERROR`, per-decision
  edge diagnostics, and write summaries), while the canvas highlights the
  **active** node (pulsing sky ring), **visited** nodes (emerald), and
  **traversed** edges (sky), dimming nodes not yet reached.

The engine is covered by unit tests in
`previews/simulator/__tests__/flow-simulator.test.ts`.

## Architecture

This package sits between the low-level `@object-ui/react` (SchemaRenderer) and the high-level `apps/console` (full application):

```
Third-Party App
    ↓
@object-ui/app-shell ← You are here
    ↓
@object-ui/react (SchemaRenderer)
    ↓
@object-ui/components + @object-ui/fields + plugins
```

## Comparison with Console

| Feature | @object-ui/app-shell | apps/console |
|---------|---------------------|--------------|
| Bundle Size | ~50KB | ~500KB+ |
| Routing | BYO | Built-in React Router |
| Auth | BYO | Built-in ObjectStack Auth |
| Admin Pages | No | Users, Roles, Audit, etc. |
| App Management | No | Create/Edit Apps |
| Data Source | Any | ObjectStack |
| Customization | Full control | Limited |

## Examples

See `examples/byo-backend-console` for a complete working example that demonstrates:
- Custom routing with React Router
- Custom data adapter (not ObjectStack)
- Custom authentication
- Cherry-picking only needed components
- Building a console in ~100 lines of code

## Record create/edit modes

The default `<DefaultAppContent>` shell mounts a global `<ModalForm>` for
record create/edit interactions. Each object can opt in to a route-driven
full-screen experience instead by setting `editMode` on its metadata:

```jsonc
// objects/account.json
{
  "name": "account",
  "label": "Account",
  "editMode": "page",        // ← opt-in. Default is "modal".
  "fields": { /* ... */ }
}
```

When `editMode: 'page'` is set, clicking **Create** or **Edit** for an
`account` record navigates to a dedicated route instead of opening the
dialog:

| Action | URL |
|--------|-----|
| Create | `/apps/:appName/account/new` |
| Edit   | `/apps/:appName/account/record/:recordId/edit` |

These routes are deep-linkable (refresh-safe), respect the browser back
button, and render the same `<ObjectForm>` pipeline as the modal — so
`tabbed`, `wizard`, and section configurations work in both modes.

JSON `<action:button>` schemas can also trigger the page routes directly
via the action runner, regardless of the object's `editMode`:

```json
{
  "type": "action:button",
  "label": "New Account",
  "action": { "action": "navigate_create", "params": { "objectName": "account" } }
}
```

```json
{
  "type": "action:button",
  "label": "Edit",
  "action": {
    "action": "navigate_edit",
    "params": { "objectName": "account", "recordId": "${record.id}" }
  }
}
```

See [`content/docs/guide/record-edit-modes.md`](../../content/docs/guide/record-edit-modes.md)
for a longer walkthrough.

## User-scoped state (favorites, recent items)

`<ConsoleShell>` includes `FavoritesProvider` and `RecentItemsProvider` —
shared, user-scoped state for pinned apps and recently visited entities.

Both providers are **localStorage-first**: instant first paint, no flash of
empty UI. If a `UserDataAdapter` is attached via `UserStateAdaptersProvider`,
they additionally hydrate from and write through to a backend (debounced).
The official ObjectStack adapter lives in `@object-ui/data-objectstack`
(`createObjectStackUserStateAdapter`).

```tsx
import { useFavorites, useRecentItems, useNavPins } from '@object-ui/app-shell';

const { favorites, toggleFavorite, isFavorite } = useFavorites();
const { recentItems, addRecentItem } = useRecentItems();
// Sidebar pins live in the same store as Favorites — synced to the backend
// via the same `UserDataAdapter<FavoriteItem>` when one is attached.
const { pinnedIds, togglePin, isPinned, applyPins } = useNavPins();
```

Nav pins and Favorites share a single `favorites` collection. `FavoriteItem`
carries optional `type: 'nav'`, `pinned`, and `navId` fields so a single
adapter syncs both flows. The legacy `objectui-nav-pins` localStorage key is
migrated on first mount and then removed. Content favorites (20) and nav
pins (20) each have an independent cap. See the guide below for details.

See [User-Scoped State Persistence](../../content/docs/guide/user-state-persistence.md)
for the adapter contract, backend schema, and how to plug in your own backend.

<!-- release-metadata:v3.3.0 -->

## Command palette (⌘K)

`<ConsoleShell>` mounts a global ⌘K command palette for cross-app navigation and
record search. Its open state and the command that opens it are provided by
`CommandPaletteProvider` (wired in by `ConsoleLayout`) and exposed via
`useCommandPalette()`.

```tsx
import { useCommandPalette } from '@object-ui/app-shell';

function MyToolbarButton() {
  const { openCommandPalette } = useCommandPalette();
  // Idempotent: calling when already open is a no-op.
  return <button onClick={openCommandPalette}>Search…</button>;
}
```

Designed to be deterministic for automated (AI) browser testing — see
[ADR-0054 "UI testability contract"](../../docs/adr/0054-ui-testability-contract.md):

- **Idempotent, direct open (C1).** The top-bar search button, the ⌘K shortcut,
  and the deep-link all call the *same* idempotent `openCommandPalette()`
  (`setOpen(true)`), never a `toggle()`. The button calls the command directly —
  it does **not** re-dispatch a synthetic `⌘K` `KeyboardEvent` (which silently
  did nothing under automation and in ⌘K-reserving browsers). ⌘K stays a
  keyboard *accelerator* and may still toggle (close-on-repeat).
- **URL-addressable (C3).** Open state lives in the `?palette=1` search param, so
  the palette is deep-linkable (`/apps/<app>?palette=1`), restores on reload, and
  works with browser back/forward. `?cmdk=1` is accepted as an alias on read.
- **Stable locators (C4).** The dialog carries `data-testid="overlay:command-palette"`
  plus an ARIA role/name; the header trigger carries
  `data-testid="action:command-palette:open"` (and `:open-mobile` for the compact
  header). `CommandDialog` accepts `contentProps` to forward a `data-testid`/ARIA
  name onto the underlying dialog element.
- **Trusted-input note (C6).** The palette search is a controlled + debounced
  input. Value-injection (`el.value = …`) does **not** fire React's `onChange`;
  drive it with a real-input / CDP-keystroke driver so the debounced fetch fires.

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/layout/app-shell)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/app-shell)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
