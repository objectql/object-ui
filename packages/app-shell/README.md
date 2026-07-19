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

### ActionParamDialog

Collects user input for a declared action's `params` before execution. Every
param renders through the shared form field-widget renderer from
`@object-ui/fields` (`getLazyFieldWidget`), so a param of any form-supported
field type — `select`, `lookup`, `date`, `file`, `image`, `richtext`, `color`,
… — gets its real widget instead of a text-input fallback (ADR-0059). The pure
`paramToField()` adapter owns the param → field translation, and a drift test
pins param support ⊇ form support. `required` validation and `visible` CEL
gating are applied by the dialog; file/image uploads use the ambient
`UploadProvider`, lookup/user pickers the surrounding `SchemaRendererContext`.

## Metadata designers

The metadata-admin engine (`src/views/metadata-admin`) renders an in-app editor
for each metadata type. Every type has a pure-renderer **preview** that doubles
as its **designer** when given `editing` + `onPatch` props — no backend round
trip is required to edit a draft.

### AI chat conversation key (ADR-0057)

The console's AI chat surfaces are **views over one conversation model**, not
separate chats. A conversation is keyed on `(user, app, product)` — never on the
surface — by the pure `chatConversationScope({ appId, product })` helper
(`src/hooks/chatScope.ts`). `product` is the ADR-0063 binding axis (`ask` |
`build`), derived from the resolved agent via `chatProductOfAgent(name)`, never a
per-surface choice. A package-scoped surface resolves `app:${packageId}:${product}`,
so the Studio design copilot editing package `X` and the full-page focus view
`/ai/build?package=X` (the "Edit with AI" entry) **resume the same thread**
instead of forking; a generic `/ai/:agent` visit with no package degrades to the
product alone (`build` / `ask`). Enablement is the single access-filtered
agent-catalog gate (`useAiSurfaceEnabled`, ADR-0068): a seat-less user's empty
catalog hides the whole AI surface.

### App → Studio reverse bridge

Inside a running app, workspace admins get a "Design in Studio" entry in the
top bar (`AppHeader`) that deep-links to the app's owning package on the Studio
design surface. When the current route names a specific interface — a
dashboard, page, or report — it opens straight to that surface in the Interfaces
pillar (`/studio/:packageId/interfaces?surface=<type>:<name>`); on object routes
and the app root it opens the package's Data tab (`/studio/:packageId/data`).
The route-type → surface-type decision lives in `appStudioRoutePath`. It is the
reverse of the builder's "Open app" bridge (ADR-0080): the entry only renders
for admins and only when the app has an owning package (`_packageId`), and
package writability stays a server-side concern — a read-only package opens in
Studio as browse-only.

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

### Access matrix (package-scoped)

The Access pillar's permission matrix follows the active package (ADR-0086 P0).
A Permission Set / Profile is a single record whose `objects` / `fields` maps
accumulate authorization rows contributed by many packages, so the matrix:

- lists **only the objects the active package declares** — the panel never
  exposes the whole environment's objects; and
- saves via **slice-merge** — it re-reads the record and writes back just this
  package's slice, leaving rows contributed by other packages untouched.

The left rail lists only permission sets this package owns — the metadata API
filters `permission` by the record-level `package_id` provenance server-side
(framework ADR-0086 P1), via `client.list('permission', { packageId })`, so
environment-owned platform defaults (`admin_full_access`, `member_default`, …)
are excluded by the backend. (The `?package=` list rows don't echo the
provenance columns, so a client-side filter can't do this.) Save writes a
package draft and publishes with the whole package (ADR-0086 P2). Rendering
`PermissionMatrixEditPage` without a `packageId` keeps the environment-wide
behavior (full object list, whole-record save). The scope/merge helpers
(`scopePermissionSet`, `mergePermissionSlice`) live in
`metadata-admin/permission-slice.ts`.

#### Row-Level Security — CEL authoring safety (objectui#2413)

Below the object matrix, `PermissionAdvancedFacets` edits the three advanced
facets (Row-Level Security, Tab Visibility, Delegated Admin Scope). RLS is the
highest-risk surface: `USING` (read filter) / `CHECK` (write filter) predicates
are hand-typed CEL, and a typo silently mis-scopes rows — some paths **fail
open**, *widening* access with no error. The `USING`/`CHECK` editors therefore
run three author-time safeties, all delegated to the framework's canonical CEL
engine (`@objectstack/formula`) so the GUI reaches the **same verdict as the
server** instead of maintaining a second grammar:

- **Inline lint** (`CelPredicateField`) — `validateExpression` flags parse
  faults inline (blocking Save) and unknown-field near-misses as non-blocking
  "did-you-mean" warnings; a non-pushdown-able `USING` filter is flagged as a
  fail-open blast-radius advisory (`isPushdownableCel`).
- **Field autocomplete** — `introspectScope` supplies the target object's
  fields plus scope vars (`current_user`, `record`, …) and stdlib functions as
  you type, so an identifier that would silently never match is caught early.
- **Test-run** (`CelTestRunDialog`) — dry-runs a predicate against a sample
  record + `current_user` through `ExpressionEngine.evaluate` and shows
  allow / deny / non-boolean / error before you ship.

The engine is loaded lazily (dynamic `import`, feature-detected and
error-swallowing like `preview/capabilityLint.ts`), so the CEL parser stays out
of the main bundle and a missing/older engine degrades to "no assistance"
rather than breaking the editor. The bridge is `metadata-admin/celAuthoring.ts`.

#### Field conditional rules — CEL editors (objectui#1582)

The object designer's field inspector (`ObjectFieldInspector`, Advanced →
*Conditional rules*) edits the ADR-0036 B2 field-level predicates
`visibleWhen` / `readonlyWhen` / `requiredWhen` with the same
`CelPredicateField` editor, in **`scope="record"`** mode:

- These rules evaluate with the record bound **only as the `record`
  namespace** (see `@object-ui/core`'s `evalFieldPredicate`), so a bare field
  reference is flagged as an **error** with the exact `record.<field>` fix,
  and autocomplete offers the roots that are actually bound at runtime —
  `record` / `previous` / `parent` (master-detail header) — plus the stdlib;
  typing `record.` / `previous.` completes the object's own field names.
- Values round-trip both wire shapes: a bare CEL string or the
  `{ dialect, source }` Expression envelope (envelope extras such as
  `meta.rationale` are preserved on edit). The deprecated
  `conditionalRequired` alias is read into the *Required when* editor and
  migrated to `requiredWhen` on the first edit.
- The same lint also runs draft-wide in `clientValidation.ts`
  (`validateMetadataDraft('object', …)`), so an invalid predicate on any
  field — not just the selected one — surfaces in the editor's issue banner
  under a `fields.<field>.<rule>` path before save.

#### Formula fields — CEL value expressions (objectui#1582 follow-up)

A `formula` field's *Formula (CEL)* editor (Type-specific section) is the same
`CelPredicateField`, in **`role="value"`** mode (bare CEL of any type, still
`scope="record"`, autocomplete roots `record` only — formulas see neither
`previous` nor `parent`):

- The editor shows the **inferred result type** (Number / Text / Boolean /
  Date) under the field — the same `@objectstack/formula`
  `inferExpressionType` verdict dataset derivation keys **measure
  eligibility** off, so "this formula won't be a SUM measure" is visible
  before saving. An unprovable type reads *Unknown* with the
  `double()` / `int()` / `string()` pinning hint.
- Edits land on the spec's **`expression`** key (either wire shape, envelope
  extras preserved) — the legacy `formula` key, which the engine never read,
  seeds the editor and is migrated on the first edit — and the proven type is
  stamped onto **`Field.returnType`** (cleared when the type can't be proven).
- Formula expressions are also linted **draft-wide** under
  `fields.<field>.expression`, alongside the conditional rules.
- `summary` fields have **no CEL expression** — the spec models them as
  `summaryOperations` — so the inspector edits the roll-up structurally
  instead: child object, aggregation function (`count` / `sum` / `min` /
  `max` / `avg`), the child field to aggregate, and (optionally) the child
  relationship field pointing back to the parent.

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

A `decision` node's **Branches** repeater additionally shows a per-branch
**Target** column (#1942) — a node picker scoped to this flow — so the whole
decision (conditions *and* destinations) is authored in one table, like
Salesforce Flow Decision Outcomes. The column is **virtual**: it is derived
from the decision's outgoing edges (routing truth lives on `edge.condition` /
`label` / `isDefault`, which the engine and simulator evaluate) and is never
stored on `config.conditions`. Picking a target creates or retargets the
branch's out-edge carrying its condition/label/default; clearing it detaches
(removes) that edge — never the node. Because edges stay the single source of
truth, it round-trips with the reciprocal per-edge **Branch** picker in
`FlowEdgeInspector` (#1930) and with canvas rewiring; custom hand-written edge
guards and fault/back edges are never touched (`flow-decision-edges.ts`).

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

## URL-addressable overlays (`useUrlOverlay`)

`useUrlOverlay(key)` is the reusable building block behind the command palette's
URL-addressable open state (ADR-0054 C3). It stores a navigable overlay's open
state in a `?<key>=1` search param instead of component `useState`, so the
overlay is deep-linkable, restores on reload, and works with back/forward — and
its open path is idempotent (C1).

```tsx
import { useUrlOverlay } from '@object-ui/app-shell';

function HelpMenu() {
  const { open, setOpen, openOverlay } = useUrlOverlay('shortcuts');
  // Header button (any component under the router):  onClick={openOverlay}
  // Dialog (elsewhere, reads the same param):        <Dialog open={open} onOpenChange={setOpen}>
  // Deep-link that opens on load:                    /apps/foo?shortcuts=1
}
```

Because state lives in the URL, a trigger and the overlay it controls need no
shared provider or prop-drilling — they just use the same `key`. The
command palette (`?palette=1`, `?cmdk=1` alias) and the keyboard-shortcuts dialog
(`?shortcuts=1`, openable from the Help menu — no longer `?`-key-only) both build
on it. `replace`/`alias`/`value` are configurable.

The shared overlay primitives in `@object-ui/components`
(`Dialog`/`Sheet`/`Drawer`/`Popover`/`DropdownMenu`/`AlertDialog`) already forward
a `data-testid` onto their content element and emit Radix `data-state="open|closed"`,
so overlays are locatable and their open/closed state is machine-readable by
construction (C4).

## Settle signal (is the app idle?)

`<ConsoleShell>` exposes one global "no requests in flight" predicate so an
automated (AI) browser driver can wait for the app to settle instead of
hardcoding timeouts (ADR-0054 C5). The data layer increments a counter around
every outbound request (it wraps the adapter's `fetch`), mirrored onto
`window.__objectui`:

```js
// In an e2e / browser driver:
await page.waitForFunction(() => window.__objectui?.idle === true);
// or:  window.__objectui.pendingRequests === 0
// or:  await window.__objectui.whenIdle();   // resolves when settled (10s cap)
```

In React, `useSettleSignal()` returns `{ pending, idle }` for a global busy
indicator; the lower-level `getPendingRequests` / `subscribeSettle` / `whenIdle`
/ `withSettleSignal` / `installSettleSignalGlobal` are also exported.

Async data regions additionally expose region-level state for finer waits: the
list view and record-picker results set `aria-busy` while fetching and
`data-state="loading|idle"`, complementing the Radix `data-state` already on
overlays.

## Field locators (`field:{object}.{field}`)

Generated forms emit a metadata-derived stable locator on every field wrapper, so
an automated (AI) driver can target a field without relying on i18n-fragile labels
or positional selectors (ADR-0054 C4). The form renderer derives it from the
form's `objectName` and each field's name — every form (`ObjectForm`, `ModalForm`,
`DrawerForm`, `SplitForm`, `WizardForm`) inherits it with zero per-app work:

```html
<div data-testid="field:account.industry" data-field="industry"> … input … </div>
```

```js
// e2e / AI driver:
await page.getByTestId('field:account.industry').locator('input').fill('SaaS');
```

The object prefix is omitted (`field:{field}`) when a form has no owning object.
This complements the action/overlay locators already emitted by the renderer
(`overlay:command-palette`, `action:command-palette:open`, …).

## Testability ratchet

The invariants above are kept from regressing (ADR-0054 Phase 5, "counts can only
go down"):

- A conformance test (runs in the gating `pnpm test` job) fails the build if a new
  **synthetic-event trigger** (`el.dispatchEvent(new KeyboardEvent/MouseEvent/
  PointerEvent …)`) is introduced anywhere in `packages/*/src` or `apps/*/src`.
  Legitimate `CustomEvent` / `PopStateEvent` dispatch (event bus / history nudge)
  is allowed. Replace a synthetic trigger with a direct, idempotent command
  (`useCommandPalette` / `useUrlOverlay`).
- A matching ESLint rule `object-ui/no-synthetic-event-trigger` flags the same
  pattern in-editor (the repo `Lint` workflow is manual, so the test is the CI
  gate).

## Platform preview badge

While the whole platform is pre-GA, the top bar (`AppHeader`) shows a small
**Preview** chip next to the product wordmark on every console surface (home /
app / orgs). It's rendered by `PreviewBadge`, driven by the platform stage in
runtime-config:

```ts
// packages/app-shell/src/runtime-config.ts
branding.stage: 'preview' | 'beta' | 'ga'  // default: 'preview'
```

- `getPlatformStage()` reads it (defaults to `'preview'`, so the badge shows out
  of the box on any runtime that hasn't sent a stage yet).
- The server pushes it via `GET /api/v1/runtime/config` (`branding.stage`).
  Operators set it with `OS_PRODUCT_STAGE` or `new RuntimeConfigPlugin({ stage })`.
- At launch, set `stage: 'ga'` — `PreviewBadge` renders nothing and the chip
  disappears with **no code change**. `'beta'` shows a "Beta" chip instead.

```tsx
import { PreviewBadge, getPlatformStage } from '@object-ui/app-shell';

<PreviewBadge className="ml-2 hidden sm:inline-flex" />; // used inside AppHeader
```

Labels are localized under `topbar.stage.*` (`@object-ui/i18n`).

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
