# ADR-0056: Permission editing belongs in Studio — Setup keeps user management and assignment

**Status**: Proposed (2026-07-12)
**Author**: ObjectUI app-shell / Studio team
**Consumers**: `@object-ui/app-shell` (Setup object surfaces for `sys_permission_set`; Studio Access pillar `AccessPillar` / `PermissionMatrixEditPage`; `views/metadata-admin/*`; `builtinComponents.tsx`), `@object-ui/plugin-form` (the generic object form that renders the `sys_permission_set` textareas today)
**Relates to (framework)**: **ADR-0090** (Permission Model v2 — concept convergence; names ObjectUI *Studio + Setup* as consumers, D6 explain, D7 lint, D12 delegated admin/`adminScope`), **ADR-0092** (identity-table write guard — the same "UI hint ≠ server boundary" discipline), **ADR-0086** (authz metadata↔config boundary — package vs environment provenance on permission sets), **ADR-0066** (unified authorization model — the `sys_capability` registry that backs P2), **ADR-0049** (no unenforced security properties), **ADR-0057** (RLS depth / business-unit tree, referenced by the RLS + admin-scope editors), **ADR-0084** (application-builder IA — Access as Studio's fourth pillar)
**Relates to (objectui)**: **ADR-0053** / **ADR-0055** (nav / surface-context precedent), **ADR-0054** (UI-testability contract — proofs for each phase)
**Tracking**: objectstack-ai/objectui#2398 (epic — "Consolidate permission-set editing into Studio")

---

> **Cross-repo numbering note.** ObjectUI keeps its own ADR sequence (latest is
> ADR-0055); this is ADR-0056 in **that** sequence. The `framework` repo has an
> unrelated ADR-0056 (permission-model landing verification). The two repos'
> ADR numbers have always collided (0036 / 0054 / 0055 differ across repos), so
> every framework cross-reference above is given **by title**, not by number
> alone. If the reviewers would rather this decision live in the framework
> permission-ADR series (0049 / 0066 / 0086 / 0090 / 0092), it becomes
> framework ADR-0093 instead — see *Alternatives considered* A5.

## TL;DR

A permission set has **two** editing surfaces today, over the **same**
`sys_permission_set` record:

- **Setup** (`com.objectstack.setup`, gated `setup.access`) lists permission
  sets under *Access Control* (`nav_permission_sets` → the `sys_permission_set`
  **object**). The generic object form renders **six `Field.textarea` columns**,
  each a hand-edited **JSON blob**: `object_permissions`, `field_permissions`,
  `system_permissions`, `row_level_security`, `tab_permissions`, `admin_scope`.
- **Studio** (gated `studio.access`) has an **Access pillar** whose
  `PermissionMatrixEditPage` is a structured, Salesforce-style matrix — but it
  edits **only** object CRUD/VAMA/lifecycle (`objects`) and field-level R/W
  (`fields`). The other four concerns have **no structured editor anywhere**;
  raw JSON in Setup is the only way to author them.

Raw JSON authorization metadata is exactly the failure surface **ADR-0090**
(AI-authored metadata, security-domain lint, explain-by-construction) and
**ADR-0049** (no unenforced/unvalidated security properties) argue against: it
is unvalidated at author time, invisible to the explain engine and the D7
publish linter, and a silent-incident footgun.

**Decision (Option B): permission *editing* is a Studio concern; Setup keeps
user management and permission-set *assignment*.** Every structured editor lives
behind `studio.access`; Setup's raw JSON textareas are retired. The **one
deliberate exception** is `system_permissions` (the capability list, which
includes `studio.access` itself): granting who-may-enter-Studio is a Setup act,
so it stays in Setup — but as a structured `sys_capability` multi-select, never
a JSON textarea.

Target end-state, field by field:

| `sys_permission_set` column | Concept | Edited today | Target editor | Home |
| --- | --- | --- | --- | --- |
| `object_permissions` | Object CRUD/VAMA/lifecycle | Setup JSON **and** Studio matrix | `PermissionMatrixEditor` (exists) | **Studio** |
| `field_permissions` | Field-level R/W (FLS) | Setup JSON **and** Studio matrix | `PermissionMatrixEditor` (exists) | **Studio** |
| `system_permissions` | Capability strings (incl. `studio.access`) | Setup JSON textarea | **`sys_capability` multi-select picker** | **Setup** (exception) |
| `admin_scope` | Delegated-admin scope (ADR-0090 D12) | Setup JSON textarea | New structured editor / matrix entry | **Studio** |
| `row_level_security` | RLS policies (USING/CHECK) | Setup JSON textarea | New structured RLS editor | **Studio** |
| `tab_permissions` | App/tab visibility | Setup JSON textarea | New structured tab-visibility editor | **Studio** |

---

## Context

### The two surfaces, and the record underneath them

Both surfaces ultimately write **one** table, `sys_permission_set`
(`@objectstack/plugin-security`, `managedBy: 'config'`), whose columns are all
`Field.textarea` typed *"JSON-serialized …"*. They differ only in **path**:

- **Setup → live data.** `security-plugin.ts` contributes
  `{ id: 'nav_permission_sets', type: 'object', objectName: 'sys_permission_set' }`
  into Setup's `group_access_control` (next to *Positions* → `sys_position` and
  *Capabilities* → `sys_capability`). Opening a row renders the generic object
  form: six JSON textareas, a live CRUD write to the row.
- **Studio → metadata draft.** The Access pillar (`StudioDesignSurface.tsx`,
  fourth pillar per ADR-0084) lists the **`permission` metadata type** and opens
  `PermissionMatrixEditPage`. Under a package it writes a **draft** that Publish
  promotes into the `sys_permission_set` row (ADR-0086 P2); at environment scope
  it writes the row live. The metadata shape is `PermissionSetSchema`
  (`packages/spec/src/security/permission.zod.ts`, camelCase `objects` /
  `fields` / `systemPermissions` / `tabPermissions` / `rowLevelSecurity` /
  `contextVariables` / `adminScope` / `isDefault` / `managedBy` / `packageId`).

So this is **not** two data stores — it is two *editors of the same
authorization record*, one structured-but-partial (Studio, objects+fields only),
one total-but-raw (Setup, six JSON blobs). That overlap is the problem.

### Why raw JSON editing is the wrong surface for authorization

1. **It is the exact anti-pattern ADR-0090 is built to remove.** ADR-0090's
   thesis: authorization metadata is AI-authored, so *vocabulary is attack
   surface* and *structure is the precondition for defense* — the D6 explain
   engine, D7 security-domain publish linter, and access-matrix snapshot gate
   can only exist because grants are structured data. A JSON textarea is a hole
   straight through all of it: no field validation, no cross-field refine, no
   diff the explain engine can read.
2. **ADR-0049 discipline.** A `readonly`/affordance is a UI hint, not a server
   boundary (this is precisely the ADR-0092 finding for identity tables). Raw
   JSON authoring is the mirror failure: it *looks* like editing structured
   permissions while bypassing every author-time guard the structured path has.
3. **Duplication + drift.** `object_permissions` / `field_permissions` are
   editable in **both** surfaces, in **two** shapes (snake_case JSON textarea vs
   the matrix's typed model). Two ways to author the same grant is two ways to
   author it *wrong*, and only one of them is linted.
4. **Audience mismatch (the ADR-0084 / studio.app split).** Setup is the
   operator/admin app (users, SSO, system config, `setup.access`); Studio is the
   maker/implementer app (schema-side, `studio.access`). Fine-grained
   permission *design* (object matrices, FLS, RLS predicates, delegated-admin
   scopes) is maker work; permission-set **assignment** to people and
   who-can-enter-Studio are operator work. The current split cuts across that
   line.

### What already exists (so the plan doesn't rebuild it)

- **`PermissionMatrixEditor`** (`views/metadata-admin/PermissionMatrixEditor.tsx`)
  — structured editor for `objects` (C/R/U/D + Transfer/Restore/Purge +
  ViewAll/ModifyAll, with cascade rules) and `fields` (R/W). Package- and
  environment-scoped, OCC + destructive-change dialog, per-object OWD/`private`
  badges (ADR-0066/0090), assigned-users section. **It does not yet edit
  `systemPermissions`, `tabPermissions`, `rowLevelSecurity`, `adminScope`, or
  `contextVariables`.**
- **`sys_capability`** (`@objectstack/plugin-security`, ADR-0066 D1) — a
  first-class capability **registry** object: `name` / `label` / `description` /
  `scope` (`platform` | `org`) / `managed_by` (`platform` | `package` | `admin`)
  / `active`. Seeded from `PLATFORM_CAPABILITIES` in
  `@objectstack/spec/security/capabilities.ts`, which already includes
  `setup.access`, `studio.access`, `manage_users`, `manage_metadata`,
  `manage_platform_settings`, `manage_org_users`. **Setup already lists it**
  (*Capabilities* nav). P2 needs only a picker over this object — **no new
  object.**
- **`AdminScopeSchema`** (ADR-0090 D12, in `permission.zod.ts`) — the exact
  target shape for the `admin_scope` editor: `businessUnit`, `includeSubtree`,
  `manageAssignments`, `manageBindings`, `authorEnvironmentSets`,
  `assignablePermissionSets[]`.
- **`RowLevelSecurityPolicySchema`** (`spec/security/rls.zod.ts`) — the target
  shape for the RLS editor: `name` / `object` / `operation` / `using` / `check`
  (CEL-style predicates).
- **`AccessExplainPanel`** (`views/metadata-admin/`) — the D6 "view as / why can
  X" explain surface already present alongside the matrix; the structured
  editors should sit next to it, not behind a JSON blob.

## Decision

**Option B — permission editing is a Studio concern; Setup keeps user
management and assignment.**

1. **All structured permission editors live behind `studio.access`**, in the
   Studio Access pillar (and the shared `metadata-admin` permission route the
   pillar embeds). Object/field permissions already are; RLS, tab-visibility,
   and delegated-admin scope join them.
2. **Setup keeps, and only keeps:** user CRUD / invite / import (unchanged;
   ADR-0092), position management, and **permission-set *assignment*** (binding
   sets to positions/users via `sys_position_permission_set` /
   `sys_user_permission_set`, and the assigned-users surface) — plus the P2
   exception below. Setup stops being a permission-*authoring* surface.
3. **Exception — `system_permissions` stays in Setup**, because it includes
   `studio.access`: deciding *who may enter Studio* cannot itself require
   entering Studio, and capability-granting is operator work. It moves from a
   JSON textarea to a **structured `sys_capability` multi-select** (active,
   scope-labelled, description tooltips), so even the retained-in-Setup field is
   never raw JSON.
4. **Setup's raw JSON textareas are retired** once every concern has a
   structured home (P5). No permission concern is left author-only-as-JSON.

This is the objectui-side realization of ADR-0090's stated ObjectUI
consequences (Access pillar owns the matrix; provenance/default badges; explain
by construction) and extends the matrix from objects+fields to the full
permission-set surface.

### Phased rollout

Each phase is an independently shippable, browser-verified PR (ADR-0054 proofs).
All phases are **objectui**; framework spec touchpoints are called out as
companion follow-ups (this ADR does not itself change framework source).

- **P1 — Retire Setup's object/field JSON, deep-link to the Studio matrix.**
  In Setup, replace the `object_permissions` / `field_permissions` textareas on
  the `sys_permission_set` form with a **read-only summary + a deep-link**
  ("Edit object & field permissions in Studio →") into the environment-scope
  `PermissionMatrixEditPage` for that set. No new editor — reuse the existing
  matrix. Removes the duplicate authoring path.

- **P2 — `system_permissions` → structured `sys_capability` picker (stays in
  Setup).** Replace the `system_permissions` textarea with a multi-select over
  `sys_capability` (filter `active = true`; group/label by `scope`; show
  `description`). Writes the same `string[]` of capability names. Granting
  `studio.access` remains a Setup act; no JSON.

- **P3 — Studio matrix gains a delegated-admin (`admin_scope`) entry.** Add an
  `adminScope` editor to `PermissionMatrixEditPage` (or an adjacent Access-pillar
  panel): BU-subtree picker (`businessUnit` + `includeSubtree`), the
  manage-assignments / manage-bindings / author-env-sets toggles, and the
  `assignablePermissionSets[]` allowlist (ADR-0090 D12). Studio-only.

- **P4 — Build the three new structured Studio editors** for
  `row_level_security`, `tab_permissions`, and `admin_scope` (the P3 entry is
  the admin-scope piece; P4 completes RLS + tabs and hardens all three):
  - **RLS**: per-policy rows (object · operation · USING · CHECK) with an
    expression field validated against the RLS predicate surface.
  - **Tab visibility**: per-app/tab selector → `visible | hidden | default_on |
    default_off`, enumerating installed apps/tabs.
  - **Admin scope**: finalize the P3 editor.

- **P5 — Retire ALL Setup permission JSON textareas.** With every concern homed
  in a structured editor, remove the remaining raw-JSON rendering of
  `object_permissions`, `field_permissions`, `row_level_security`,
  `tab_permissions`, `admin_scope` from the Setup `sys_permission_set` form
  (`system_permissions` already handled in P2). Setup's permission-set surface is
  now: identity fields + capability picker + assignment + read-only summaries
  with Studio deep-links.

## Consequences

- **One authoring path per concern.** Objects/fields/RLS/tabs/admin-scope are
  authored once, in Studio, through validated editors the explain engine (D6)
  and publish linter (D7) can see. Capabilities are authored once, in Setup,
  through the `sys_capability` picker.
- **The Setup/Studio audience split (ADR-0084 / studio.app) is honored:**
  operators assign and grant-entry; makers design permissions.
- **AI-authoring safety improves** exactly where ADR-0090 wants it: no security
  concern is reachable as an unvalidated free-text blob.
- **Framework spec touchpoints (companion work, not in this ADR's PRs):**
  - P2/P5 change how the `sys_permission_set` form renders — via an
    objectui-side form override, or by narrowing the object's field widgets in
    `plugin-security` (framework). The **columns stay** (they are the storage);
    only the *editor* changes. If done framework-side it wants its own changeset
    citing this ADR.
  - The RLS/tab/admin-scope editors read `RowLevelSecurityPolicySchema`,
    `tabPermissions` enum, and `AdminScopeSchema` from `@objectstack/spec` — no
    schema change, but the editors couple to those shapes.
- **Studio becomes load-bearing for permission ops.** An admin who can assign
  sets but lacks `studio.access` can no longer *design* them. That is the
  intended boundary, but it makes "who holds `studio.access`" operationally
  important — hence P2 keeps that grant in Setup and first-class.

## Open design questions

1. **Deep-link UX & scope (P1).** Setup permission sets are often
   **environment-authored** (`packageId` absent), but the Studio **Access
   pillar** is package-scoped (lists only a package's own sets). The deep-link
   target must therefore be the **environment-scope** `PermissionMatrixEditPage`
   (the editor already supports `packageId`-absent, whole-record save) reached
   via the shared `metadata-admin` permission route — **not** the package
   pillar. Confirm the exact route, how a package-managed (read-mostly) set is
   presented (matrix read-only + "edit in the owning package" per ADR-0086), and
   the back-navigation contract (return to the Setup row). Should the link
   cross-app-navigate (Setup → Studio) or open the matrix in a Setup-hosted
   route that reuses the component?
2. **What the RLS editor actually is (P4).** RLS `using`/`check` are CEL-style
   predicate expressions. A dropdown-only editor cannot express them; the real
   work is a **predicate/expression builder** (field · operator · value, with
   `current_user.*` context variables) that still round-trips hand-written CEL.
   How much of the expression surface (ADR-0058) is in scope for v1 vs a
   "simple rules + raw-CEL escape hatch" hybrid? Where do `contextVariables`
   (present in `PermissionSetSchema` but **not** a `sys_permission_set` column)
   live and get edited?
3. **Tab-visibility source of truth (P4).** Enumerating apps/tabs to offer
   `visible | hidden | default_on | default_off` — from installed apps metadata?
   Package-scoped or environment-wide? How are apps that appear/disappear after
   authoring reconciled?
4. **Admin-scope editor placement (P3/P4).** A row *inside* the object matrix,
   or a **separate Access-pillar panel**? `adminScope` is not per-object, so it
   does not fit the object×action grid; a sibling panel next to
   `AccessExplainPanel` is the likely shape. Needs the BU tree picker
   (`sys_business_unit`) and validation that `assignablePermissionSets` exist.
5. **Backward-compat for existing JSON on live sets.** Rows authored through the
   old textareas hold real JSON in all six columns. On first open in a
   structured editor: parse-and-render, and if a value is **malformed** or uses
   a shape the editor can't represent, fall back to a **read-only raw view + a
   guarded "edit JSON" escape hatch** rather than dropping data. Define the
   parse-failure contract, whether P5 keeps a hidden raw-JSON escape for
   irrecoverable values, and whether a one-time normalization/lint pass
   (ADR-0090 D7 family) should stamp legacy rows.
6. **`system_permissions` — Setup-only, or also visible in the Studio matrix?**
   The agreed exception keeps *authoring* in Setup. Should Studio *display*
   capabilities read-only for context (it already shows OWD/provenance), or omit
   them entirely to keep the boundary crisp?

## Alternatives considered

- **A1 — Keep both surfaces, just add validation to the JSON.** Rejected:
  validated JSON is still the anti-structure ADR-0090 removes; two authoring
  paths for objects/fields remain, and the RLS/tab/admin-scope concerns still
  have no usable editor. Lipstick on the footgun.
- **A2 — Move *everything* (including capabilities) into Studio; Setup only
  assigns.** Rejected for `system_permissions`: `studio.access` is granted
  *there*, so deciding who enters Studio would require Studio — a bootstrap
  knot. Capability-granting is also squarely operator work.
- **A3 — Move all editing into Setup; delete the Studio matrix.** Rejected:
  inverts ADR-0084's maker/operator split, and Setup's generic object form is
  the raw-JSON surface we are trying to eliminate. The structured matrix is the
  asset, not the liability.
- **A4 — One mega-editor for all six concerns.** Rejected: the concerns have
  different shapes (object×action grid vs per-policy RLS list vs scalar
  capability set vs BU-scoped admin grant) and different audiences (P2 stays in
  Setup). Phase them as focused editors sharing the Access-pillar shell.
- **A5 — File this as framework ADR-0093 instead of objectui ADR-0056.**
  Defensible: the permission *model* ADRs (0049/0066/0086/0090/0092) all live in
  framework, and P2/P5 have framework spec touchpoints. Chosen against as the
  default because **all five phases are objectui UI-surface-ownership
  decisions** — precisely what objectui's ADR series records (0053 nav, 0054
  testability, 0055 bare-data-surface). If reviewers prefer the framework home,
  renumber to 0093 and keep the objectui cross-refs; the content is unchanged.

## References

- objectui: `packages/app-shell/src/views/metadata-admin/PermissionMatrixEditor.tsx`,
  `views/metadata-admin/AccessExplainPanel.tsx`,
  `views/studio-design/StudioDesignSurface.tsx` (`AccessPillar`),
  `services/builtinComponents.tsx` (registers `type: 'permission'` → the matrix).
- framework: `packages/plugins/plugin-security/src/objects/sys-permission-set.object.ts`
  (the six textarea columns), `objects/sys-capability.object.ts`,
  `security-plugin.ts` (Setup Access-Control nav; `permission` draft → published
  `sys_permission_set`), `packages/spec/src/security/permission.zod.ts`
  (`PermissionSetSchema`, `AdminScopeSchema`), `security/permission.form.ts`,
  `security/capabilities.ts` (`PLATFORM_CAPABILITIES`), `security/rls.zod.ts`.
- ADRs: framework ADR-0090 (permission model v2), ADR-0092 (identity write
  guard), ADR-0086 (authz metadata↔config boundary), ADR-0066 (unified authz /
  `sys_capability`), ADR-0049 (no unenforced security properties), ADR-0084
  (application-builder IA); objectui ADR-0053 / ADR-0054 / ADR-0055.
