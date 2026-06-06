# ADR-0034: Runtime editing reuses studio's per-item draft → publish → version model (retire `sys_view` / `sys_report` / `sys_dashboard`)

**Status**: Proposed (2026-06-06)
**Author**: ObjectUI renderer team
**Consumers**: `@object-ui/app-shell` (ObjectView / ReportView / DashboardView + metadata-admin), `@object-ui/data-objectstack` (metadata client), and the ObjectStack backend (`/api/v1/meta/*`).

---

## TL;DR

The console edits the same artifacts — **views, reports, dashboards** — in **two unrelated stores**:

- **Studio** → the metadata overlay: `PUT /meta/:type/:name` with `mode: 'draft' | 'publish'`, plus `publish()`, history and rollback. Drafts are **per item** and invisible to runtime until published; publish is available **per item** (`client.publish(type, name)`) and as a batch **app publish** (`/packages/:id/publish-drafts`).
- **Runtime** → bespoke per-type tables `sys_view` / `sys_report` / `sys_dashboard`: immediate writes, no draft/publish/history, each with its own column layout (`toSysViewPayload`).

PRs #1496/#1504/#1505 unified the **editing UI** (both render the same spec-driven inspector); #1508 gave the report/dashboard editors the admin gate that view editing already had. **Persistence is still split.**

**Decision:** make the runtime editors reuse studio's model exactly. A runtime edit **saves a per-item draft** (invisible to other users, visible in the editor's own live preview), and an explicit **Publish** promotes it to the active overlay and records a version. No bespoke tables, no new scope dimension. Because the runtime panels already emit the spec draft and the runtime already *reads* views/reports/dashboards from the metadata layer (`MetadataProvider.readType('view'|'report'|'dashboard')`), this is mostly a write-path switch.

`sys_view`/`sys_report`/`sys_dashboard` are retired. Per-user personalization (a `user` overlay for **views only**) is explicitly **out of scope** here — a later, additive change.

## Why this model (low-code rationale)

- **One system, one mental model.** A view/report/dashboard behaves identically whether edited in studio or at runtime: same draft, same publish, same version/history/rollback.
- **Solves the real use case.** "I'm editing a dashboard, only half done — stage it, don't publish, don't let users see it." A **per-item draft** does exactly this: invisible to users, resumable by the editor (`GET …?state=draft`).
- **Immediacy *and* staging coexist.** The editing admin sees their own changes live in the panel's preview (driven by the local draft); other users keep seeing the **published** value until Publish. Per-item publish means staging one dashboard blocks nothing else.
- **Governance upgrade.** Runtime edits gain validation, history and rollback they never had.
- **No new backend for v1.** Reuses `/meta` draft/publish as-is.

### Draft vs publish — a property of the change, not the screen

`draft → publish` exists for **staging** and **atomic multi-item app releases**; forcing the two-step onto a trivial one-field tweak is friction (studio already mitigates with auto-save). So:

- **Default = save-as-draft + explicit Publish** (matches studio; satisfies the "stage half-done work" need). The editor's live preview keeps it feeling immediate.
- Batch **app publish** stays available for releasing many items together.
- **Always versioned** on publish.

This unifies the UX in *both* surfaces rather than making runtime a special case.

## What changes (before → after)

| | Before | After |
|---|---|---|
| Save (view) | `dataSource.create/update('sys_view', toSysViewPayload(...))` | `metadataClient.save('view', name, draft, { mode:'draft' })` |
| Save (report/dashboard) | `adapter.update('sys_report'|'sys_dashboard', name, schema)` | `metadataClient.save(type, name, draft, { mode:'draft' })` |
| Publish | — (writes were immediately live) | `metadataClient.publish(type, name)` → active overlay + version |
| Read (others) | `sys_*` merged with metadata | metadata **active** value (already the read path) |
| Read (editor, resume) | n/a | `metadataClient.get(type, name, { state:'draft' })` |
| Shape adapters | `toSysViewPayload` / `fromSysViewRecord` / report+dashboard adapters | deleted |

Runtime panels gain a small **draft/publish chrome** (Save draft · Publish · "unpublished changes" indicator · discard draft) — the same affordances studio's `ResourceEditPage` already has, reused.

## Rollout (flagged, reversible, back-compat)

1. **(done)** Unify the editing UI (#1496/#1503/#1504/#1505) and gate report/dashboard editing (#1508).
2. **Seam (this ADR's first code):** a single `persistRuntimeMetadata(type, name, draft, …)` (+ `publishRuntimeMetadata`). Behind a flag (default **off**) it routes to the existing `sys_*` writes — **zero behaviour change** — so it is safe to merge and unit-test now. Flag **on** routes to `metadataClient` draft/publish.
3. **UI:** add the draft/publish chrome to the runtime panels, flag-gated.
4. **Verify in a real environment** (this sandbox has no backend; the save→draft→publish→read round trip cannot be verified here). Then flip the default.
5. **Retire:** migrate existing `sys_*` rows → published overlays (dual-read window), drop the tables, delete the shape adapters.

## Risks

- 🔴 **Not verifiable in CI/sandbox.** This changes *where* edits persist and *how* they are read; there is no running backend here, so the round trip must be verified in a real environment. Mitigation: feature flag (default off) + per-item, reversible steps.
- 🔴 **Data migration.** Existing `sys_*` rows must move to published overlays without loss; dual-read window + rollback.
- 🟡 **Immediacy expectation.** Editors must understand Save = draft, Publish = live; the live preview and a clear "unpublished changes" indicator cover this.
- 🟡 **Permissions.** Writing/publishing metadata requires admin/publish rights — already aligned with the #1508 admin gate.
- 🟡 **Multi-tenant.** Writes/migration must stay correctly scoped to the org/env overlay.

## Out of scope

- **Per-user personalization** (a `user` overlay for views) — a later, additive change. v1 is admin editing of the shared definition only.

## Appendix: persistence call sites (the seam targets)

| Panel | Today | File |
|---|---|---|
| ObjectView | `dataSource.create/update('sys_view', toSysViewPayload(...))` (`handleViewConfigSave` / `handleViewCreate`; `persistViewPatch` for incremental toolbar state) | `packages/app-shell/src/views/ObjectView.tsx` |
| ReportView | `adapter.update('sys_report', name, schema)` (`saveSchema`) | `packages/app-shell/src/views/ReportView.tsx` |
| DashboardView | `adapter.updateDashboard(name, schema)` / `adapter.update('sys_dashboard', …)` (`saveSchema`) | `packages/app-shell/src/views/DashboardView.tsx` |
