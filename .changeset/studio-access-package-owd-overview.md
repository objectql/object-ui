---
"@object-ui/app-shell": minor
---

feat(studio-access): package-level OWD overview — audit & batch-edit sharingModel (objectui#2505)

Add a package-scoped **"Record Sharing Baseline (OWD)"** panel to the Studio
Access pillar, a sibling surface next to the permission-set rail. It surveys —
and batch-edits — the org-wide default of every object the package owns, so an
author no longer has to open each object's Settings page to audit the baseline.

- **`PackageOwdOverviewPanel`** — a table of object × `sharingModel` ×
  `externalSharingModel` covering the package's objects (published ∪ pending
  drafts). Inline selects reuse the canonical four OWD values and the option
  labels/help copy from `ObjectSettingsPanel`. Save writes one package-scoped
  metadata **draft per changed object** (identical to the per-object Settings
  write); publish flows through the unchanged security-domain gate.
- `controlled_by_parent` rows show the master link (read-only) instead of an
  external dial; row-level `external ≤ internal` validation (ADR-0090 D11) is
  surfaced inline and blocks Save.
- New shared **`owd-sharing.ts`** — `OWD_MODELS`, the `OWD_WIDTH` axis,
  `isExternalWider`, `deriveMasterObject`.
- The Access pillar hosts it via a pinned rail entry + the existing `?surface=`
  deep-link (`owd:overview`); the read-only OWD badge in `PermissionMatrixEditor`
  now links here (plain chip at environment scope, unchanged).
- Read-only packages render the table non-editable. EN + zh-CN i18n.
