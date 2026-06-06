# ADR-0034: Unify runtime metadata persistence (retire `sys_view` / `sys_report` / `sys_dashboard` in favour of a scoped metadata overlay)

**Status**: Proposed (2026-06-06)
**Author**: ObjectUI renderer team
**Consumers**: `@object-ui/app-shell` (ObjectView / ReportView / DashboardView + the metadata-admin inspectors), `@object-ui/data-objectstack` (metadata client), `@object-ui/plugin-view` / `plugin-report` / `plugin-dashboard`, and the ObjectStack backend (`/api/v1/meta/*`, the overlay store and its history).

---

## TL;DR

The console edits the same conceptual artifacts — **views, reports, dashboards** — in **two unrelated storage systems**:

- **Design time (studio)** → the unified metadata overlay system: `GET/PUT /api/v1/meta/:type/:name`, layered `code artifact ← org/env overlay ← draft`, with `draft → publish`, validation, history and rollback. The canonical, packaged, versioned definition.
- **Runtime (the right-rail editors)** → bespoke per-type data tables `sys_view`, `sys_report`, `sys_dashboard`: plain rows, immediate writes, no draft/publish/history, each with its **own column layout** (`toSysViewPayload` snake_cases scalars and stuffs the rest into `*_json` blobs).

PRs #1496 / #1504 / #1505 unified the **editing UI** (both layers now render the same spec-driven inspector from `@objectstack/spec`), but the **persistence stayed split**: every runtime panel still flattens the spec draft back into a bespoke `sys_*` row.

This ADR argues the split should be along **lifecycle/scope (design-time vs runtime)**, not along **artifact type**, and proposes collapsing the three bespoke tables into the existing metadata overlay system by adding a **`user` (runtime personalization) scope** below the org/env overlay. The frontend is already most of the way there: the inspectors speak the spec shape, so the remaining change is to repoint each panel's `onSave` from `sys_*` writes to a scoped `metadataClient.put(...)`.

---

## Context: how we got two stores

The separation is not unmotivated. Runtime-authored artifacts (a user's personal filtered view of Leads, an admin's quick dashboard) legitimately differ from packaged metadata:

1. **Lifecycle / ownership** — packaged metadata is authored by designers, shipped in packages, versioned and published; runtime artifacts are end-user/admin content that must **not** pollute the app package and cannot be "published".
2. **Immediacy** — a runtime save must take effect instantly; it should not go through `draft → publish`.
3. **Permissions** — saving a personal view is a *data* operation, not a *metadata authoring* one; it must not require publish rights.
4. **Scale / write frequency** — user-scoped instances are numerous and written often; the overlay system (layering + validation + history) is heavier per write.

So **the design-time vs runtime distinction is correct.** What is suboptimal is implementing it as **one bespoke table per artifact type**.

## Problem: "a table per type" is technical debt

1. **Two sources of truth.** A "view" can exist both as packaged metadata (a `ViewItem`) *and* as a `sys_view` row; the runtime merges them. Same for reports/dashboards. This is confusing and a recurring source of bugs.
2. **Shape drift.** `sys_view` has its own columns + `*_json` blobs that must be hand-kept in sync with the `NamedListView` spec. `toSysViewPayload` / `fromSysViewRecord` are pure maintenance burden and have been a bug source.
3. **Capability asymmetry.** The `sys_*` path has no history / rollback / draft / validation; studio has all of it. The same artifact gets two different levels of care.
4. **Not portable.** `sys_*` rows are not part of any package, so `export` / `publish` / environment promotion silently drop them.
5. **N toolchains.** Studio has one editor; runtime has another. PRs #1496/#1504/#1505 only just papered over the *shape* difference with per-panel adapters.

## Decision (proposed)

Unify on the metadata system, and model runtime personalization as a **scope layer**, not a parallel table.

### 1. View / report / dashboard are first-class metadata types

All three are authored, read and written through `/api/v1/meta/:type/:name` in their **spec shape** (`ViewItem` is already one; `report` and `dashboard` schemas already exist in `@objectstack/spec` — they back the studio inspectors today). Retire `sys_view`, `sys_report`, `sys_dashboard`.

### 2. Add a `user` (runtime) scope to the overlay stack

Extend the existing layered overlay with one more, lowest layer:

```
code artifact (package)
   ←  org / env overlay        (studio: draft → publish, history)
        ←  user overlay         (runtime: immediate, no publish)   ← NEW
```

The **scope decides the behaviour**, uniformly:

| Scope | Write path | Publish | History | Visibility |
|-------|-----------|---------|---------|------------|
| `package` / `org` | studio | `draft → publish` | yes | everyone (once published) |
| `user` | runtime panels | immediate (active on write) | off by default | the owning user/role |

This preserves every reason the split existed (immediacy, no-publish, data-style permissions, write throughput for the `user` scope) **without** a bespoke per-type table.

### 3. Personalization metadata, not personalization tables

Record-style attributes the `sys_*` tables carry today (owner, shared-with, pinned, sort order, default-for-user) become **fields on the user-scoped overlay**, addressed by `type + name + ownerScope`. The runtime "merge metadata-defined + user-defined views" becomes the overlay resolver's existing **layering** (effective = artifact ← org ← user), which already exists for the other layers.

### 4. Frontend: one save seam

Each runtime panel's persistence collapses to one call, e.g.:

```ts
// today (three shapes, three tables)
dataSource.create('sys_view', toSysViewPayload(draft, objectName))
adapter.update('sys_report', name, draft)
adapter.updateDashboard(name, draft)

// target (one shape, one path)
metadataClient.put(type, name, draft, { scope: 'user' })
```

`toSysViewPayload` / `fromSysViewRecord` / the report+dashboard adapters are deleted. Because the inspectors already emit the spec draft (post #1496/#1504/#1505), this is a localized change at the `onSave` boundary.

## Consequences

**Positive**
- One store, one shape, one toolchain for an artifact's whole life.
- Personalization gains, for free, the overlay system's diffing ("my view vs the app default"), validation, optional history, export/promotion.
- Deletes the `sys_*` schemas and all the shape-conversion code (a meaningful net reduction).
- The "two sources of truth / merge" class of bugs disappears.

**Costs / risks**
- **Backend-led.** Requires the `/meta` API + overlay store to learn a `user` scope (resolution order, write path, per-scope history toggle, throughput for high write volume). This ADR's frontend is ready; the backend is the gating work.
- **Data migration.** Existing `sys_view` / `sys_report` / `sys_dashboard` rows must be migrated into user-scoped overlays (with a back-compat dual-read window).
- **Write performance.** The `user` scope needs a lightweight write path (skip history/validation by default) so personalization stays cheap.
- **Permissions model.** A new "edit own user-scoped overlay" permission, distinct from metadata publish rights.

## Rollout (phased, back-compat throughout)

1. **(done)** Unify the editing UI on the spec-driven inspectors — #1496 (view), #1504 (report), #1505 (dashboard), #1503 (i18n). Runtime panels already produce spec drafts.
2. **Backend**: add `scope: 'user'` to `/meta` write/read + overlay resolution (artifact ← org ← user); lightweight user-scope write (no publish/history by default).
3. **Frontend seam**: introduce a single `persistRuntimeMetadata(type, name, draft)` helper; today it routes to the existing `sys_*` writes, so the switch in step 4 is one line per panel.
4. **Cutover**: repoint `persistRuntimeMetadata` to `metadataClient.put(..., { scope: 'user' })` behind a flag; dual-read `sys_*` for a window.
5. **Migrate** `sys_*` rows → user overlays; **retire** the tables and delete `toSysViewPayload` / adapters.

## Alternatives considered

- **Keep the status quo (per-type tables).** Rejected: it is the technical debt this ADR documents — two sources of truth, shape drift, capability asymmetry, non-portability.
- **Push everything (incl. personalization) through `draft → publish`.** Rejected: breaks runtime immediacy and forces publish permissions onto end-user personalization.
- **One generic `sys_user_metadata` table (type + name + owner + spec JSON), separate from the overlay system.** A reasonable middle ground (one table, spec shape, no per-type drift), but it still keeps personalization *outside* the overlay resolver, so it forgoes free layering/diffing against the app default and re-implements a parallel resolver. The scoped-overlay approach is preferred; this is the fallback if extending the overlay store proves too costly.

---

## Appendix: current persistence call sites (for the step-3 seam)

| Runtime panel | Today | File |
|---|---|---|
| ObjectView (view) | `dataSource.create/update('sys_view', toSysViewPayload(...))` | `packages/app-shell/src/views/ObjectView.tsx` |
| ReportView | `adapter.update('sys_report', name, schema)` | `packages/app-shell/src/views/ReportView.tsx` |
| DashboardView | `adapter.updateDashboard(name, schema)` / `adapter.update('sys_dashboard', ...)` | `packages/app-shell/src/views/DashboardView.tsx` |
