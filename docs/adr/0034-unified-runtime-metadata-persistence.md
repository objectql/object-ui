# ADR-0034: Unify runtime metadata persistence (admin-edits-the-shared-definition first; retire `sys_view` / `sys_report` / `sys_dashboard`)

**Status**: Proposed (2026-06-06)
**Author**: ObjectUI renderer team
**Consumers**: `@object-ui/app-shell` (ObjectView / ReportView / DashboardView + the metadata-admin inspectors), `@object-ui/data-objectstack` (metadata client), `@object-ui/plugin-view` / `plugin-report` / `plugin-dashboard`, and the ObjectStack backend (`/api/v1/meta/*`, the overlay store and its history).

---

## TL;DR

The console edits the same conceptual artifacts — **views, reports, dashboards** — in **two unrelated storage systems**:

- **Design time (studio)** → the unified metadata overlay: `GET/PUT /api/v1/meta/:type/:name`, layered `code artifact ← org/env overlay ← draft`, with `draft → publish`, validation, history and rollback. The canonical, packaged, versioned definition.
- **Runtime (the right-rail editors)** → bespoke per-type data tables `sys_view`, `sys_report`, `sys_dashboard`: plain rows, immediate writes, no draft/publish/history, each with its **own column layout** (`toSysViewPayload` snake_cases scalars and stuffs the rest into `*_json` blobs).

PRs #1496 / #1504 / #1505 unified the **editing UI** (both layers now render the same spec-driven inspector from `@objectstack/spec`), but the **persistence stayed split**.

**Key finding (verified in code):** *none of the runtime editors do per-user personalization today.* They all write the **shared** record. View editing is already **admin-gated**; report/dashboard editing is **un-gated** (any user who clicks "edit" mutates the shared report/dashboard for everyone). So in practice these buttons are an **admin quick-edit entry point to the shared definition**, not a personalization feature.

This ADR therefore proposes a **v1 that matches that reality and removes the debt now**, with personalization deferred to v2:

- **v1 (this version, mostly frontend):** treat every runtime edit button as an **admin** quick-edit that writes the **shared definition through the existing `/meta` org/env overlay**. Retire `sys_view`/`sys_report`/`sys_dashboard` and their shape adapters. Add the missing admin gate to report/dashboard.
- **v2 (backend-led, when there's demand):** add **per-user personalization to views only**, as an additive `user` overlay layer below org/env. Reports/dashboards/pages stay shared (governed by ownership + visibility, not per-user overlays).

The frontend is already positioned for both: post #1496/#1504/#1505 the inspectors emit the spec draft, so v1 is mostly repointing each panel's `onSave`.

---

## Context: how we got two stores

The split is not unmotivated. Runtime-authored artifacts *could* legitimately differ from packaged metadata (immediacy, no-publish, data-style permissions, write throughput). So the **design-time vs runtime distinction is sound.** What is suboptimal is implementing it as **one bespoke table per artifact type** — and, as the finding below shows, the runtime tables aren't even being used for the personalization that would justify them.

## Current reality (verified)

| Runtime editor | Permission gate today | Writes to | Per-user? |
|---|---|---|---|
| **View** (`ObjectView`) | **admin-gated** (`onConfigView={isAdmin ? … : undefined}`, panel `open={… && isAdmin}`) | shared `sys_view` row | **no** (the row is shared; the comment "user-defined views" notwithstanding) |
| **Report** (`ReportView`) | **un-gated** (`report-edit-button` shown to everyone) | shared `sys_report` | no |
| **Dashboard** (`DashboardView`) | **un-gated** | shared `sys_dashboard` | no |
| **Page** (`PageView`) | — (render only; authored in studio) | metadata | n/a |

Takeaways: (1) there is **no per-user data to preserve**; (2) view editing is **already** admin-only; (3) report/dashboard editing is an **un-gated shared mutation** — arguably a defect this ADR also fixes.

## Problem: "a table per type" is technical debt

1. **Two sources of truth.** A "view" can exist both as packaged metadata (a `ViewItem`) *and* as a `sys_view` row; the runtime merges them. Same for reports/dashboards. Confusing and bug-prone.
2. **Shape drift.** `sys_view` has bespoke columns + `*_json` blobs hand-kept in sync with the `NamedListView` spec via `toSysViewPayload` / `fromSysViewRecord` — pure maintenance burden and a known bug source.
3. **Capability asymmetry.** The `sys_*` path has no history / rollback / draft / validation; studio has all of it.
4. **Not portable.** `sys_*` rows aren't part of any package, so `export` / `publish` / environment promotion silently drop them.
5. **N toolchains.** #1496/#1504/#1505 only just papered over the *shape* difference with per-panel adapters.

## The architectural crux: two different kinds of "personal"

When personalization *is* wanted, it comes in two shapes — and conflating them is the main design risk:

| Kind | Semantics | Right for |
|------|-----------|-----------|
| **(A) Personal overlay (delta)** | "the org has a Leads grid; I layer my own columns/filter on top of it" — a *delta over a shared definition* | **views** (Airtable personal-vs-collaborative views; Salesforce per-user list columns/filters; ServiceNow list personalization; Dataverse `userquery`) |
| **(B) Owned instance (ownership + visibility)** | "I built my own report/dashboard; it's mine, optionally shared" — a *standalone artifact I own* | **reports / dashboards** (Salesforce report/dashboard folders; Metabase personal collections; Tableau) |

A per-user *overlay of a specific org report* is the wrong model; a report's "personal-ness" is **ownership + visibility**, which in most orgs simply manifests as *shared*. Pages are shared metadata everywhere (Salesforce Lightning pages, Retool, ServiceNow) — no personalization.

## Decision

### Storage: one system, retire the bespoke tables

View / report / dashboard are authored, read and written through `/api/v1/meta/:type/:name` in their **spec shape** (`ViewItem` already is; `report`/`dashboard` schemas already exist in `@objectstack/spec` and back the studio inspectors). Retire `sys_view`, `sys_report`, `sys_dashboard`.

### v1 — admin edits the shared definition (mostly frontend, no new backend)

The runtime edit buttons become explicit **admin quick-edit** affordances that write the **org/env overlay** via the **existing** `/meta` PUT (the same write studio already uses), taking effect immediately (overlay write / `mode: 'publish'`, not a pending draft, to preserve the quick-edit feel):

```ts
// today (three shapes, three tables)
dataSource.create('sys_view', toSysViewPayload(draft, objectName))
adapter.update('sys_report', name, draft)
adapter.updateDashboard(name, draft)

// v1 (one shape, one path — existing org/env overlay)
metadataClient.put(type, name, draft /* spec shape */)   // gated by admin
```

- Add the missing **admin gate** to the report/dashboard edit buttons.
- Delete `toSysViewPayload` / `fromSysViewRecord` and the report/dashboard adapters.
- Migrate existing `sys_*` rows → org/env overlays, with a back-compat dual-read window; then drop the tables.

Because the inspectors already emit the spec draft, this is a localized change at each `onSave` boundary plus a read-path switch to the overlay's effective value.

### v2 — per-user personalization, views only (backend-led, on demand)

Add one more, lowest overlay layer **scoped to a user**, used **only by views**:

```
code artifact (package)
   ←  org / env overlay        (admin quick-edit + studio: immediate or draft→publish)
        ←  user overlay         (per-user view personalization: immediate, no publish)   ← v2, views only
```

Reports/dashboards do **not** get a per-user overlay; if "personal" ones are ever wanted they are modelled as **owned, shareable** metadata (ownership + visibility), defaulting to shared. Pages stay shared-only.

### Target model per artifact

| Artifact | Storage | Personalization model | Default | Precedent |
|---|---|---|---|---|
| **Object views** (grid / **kanban** / calendar / gallery / list / …) | unified metadata | **v2: personal overlay** (artifact ← org ← user delta) | org-shared default + optional personal | Airtable personal/collaborative views, Dataverse `userquery`, SF personal list views |
| **Reports / Dashboards** | unified metadata | **ownership + visibility** (private / role / org); no per-user overlay | **shared** (optionally restrict who can create) | SF report/dashboard folders, Metabase collections, Tableau |
| **Custom pages** | unified metadata | **none** (shared only) | shared | SF Lightning pages, Retool, ServiceNow |

> Note: in ObjectUI a **kanban** is a *view kind* of an object (like grid), so it sits in the "object views" row — it personalizes like any other view, not like a standalone dashboard.

## Consequences

**Positive**
- One store, one shape, one toolchain per artifact's whole life; the "two sources of truth / merge" bug class disappears.
- Runtime admin edits gain the overlay system's validation, optional history and env-promotion **for free**, and report/dashboard editing gets a proper permission gate.
- Deletes the `sys_*` schemas and all shape-conversion code (a meaningful net reduction).
- **v1 needs no new backend** — it reuses the existing `/meta` org/env overlay.
- Personalization stays a clean, additive, demand-driven v2 (views only), not a blocker.

**Costs / risks**
- **Immediacy vs governance.** Quick-edit must feel instant → write the env overlay / `mode:'publish'` rather than leaving a draft. (Draft→publish remains available for governed changes.)
- **Read-path switch.** Runtime read moves from "`sys_*` + metadata merge" to the overlay's effective value (the metadata read path is already partly there).
- **Data migration.** Existing `sys_*` rows → overlays, behind a dual-read window.
- **v2 backend.** The `user` scope needs overlay resolution (artifact ← org ← user), a lightweight write path (no publish/history by default) and an "edit own personalization" permission distinct from publish rights.

## Rollout (phased, back-compat throughout)

1. **(done)** Unify the editing UI on the spec-driven inspectors — #1496 (view), #1504 (report), #1505 (dashboard), #1503 (i18n). Runtime panels already produce spec drafts.
2. **v1 — frontend seam**: introduce `persistRuntimeMetadata(type, name, draft)`; initially routes to the existing `sys_*` writes so the switch is one line per panel.
3. **v1 — cutover**: repoint `persistRuntimeMetadata` to `metadataClient.put(type, name, draft)` (org/env overlay, immediate) behind a flag; add admin gating to report/dashboard; dual-read `sys_*` for a window.
4. **v1 — retire**: migrate `sys_*` rows → overlays; drop the tables; delete `toSysViewPayload` / adapters.
5. **v2 — backend**: add the `user` scope (views only) for per-user personalization, additive and flagged.

## Alternatives considered

- **Keep the status quo (per-type tables).** Rejected: it is the technical debt this ADR documents, and the tables aren't even serving the personalization that would justify them.
- **One uniform `user` overlay for all three types (the first draft of this ADR).** Rejected: a per-user overlay is right for views but wrong for reports/dashboards, whose "personal-ness" is ownership+visibility. Conflating them bakes in the wrong model.
- **Ship per-user personalization in v1.** Rejected for v1: there is no per-user data today and view editing is already admin-only, so personalization is pure new scope (backend) with no current consumer — classic YAGNI. Deferred to v2.
- **One generic `sys_user_metadata` table (type + name + owner + spec JSON).** A reasonable v2 fallback if extending the overlay store proves too costly, but it keeps personalization outside the overlay resolver (forgoing free layering/diffing against the app default).

---

## Appendix: current persistence call sites (for the step-2 seam)

| Runtime panel | Today | File |
|---|---|---|
| ObjectView (view) | `dataSource.create/update('sys_view', toSysViewPayload(...))` | `packages/app-shell/src/views/ObjectView.tsx` |
| ReportView | `adapter.update('sys_report', name, schema)` | `packages/app-shell/src/views/ReportView.tsx` |
| DashboardView | `adapter.updateDashboard(name, schema)` / `adapter.update('sys_dashboard', ...)` | `packages/app-shell/src/views/DashboardView.tsx` |
