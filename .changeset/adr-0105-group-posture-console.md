---
"@object-ui/auth": minor
"@object-ui/app-shell": minor
---

feat(console): group tenancy posture affordances — org switcher as write
context + org attribution in read views (framework ADR-0105 Phase 1)

Under the new `group` tenancy posture the server widens reads to every
organization the member belongs to (`organization_id IN accessible_org_ids`)
while writes land in the ACTIVE organization — so the console's existing
"which org am I in = which org's data I see" presentation becomes wrong the
moment a deployment switches postures. The ADR requires these affordances to
land WITH Phase 1, not after.

- `@object-ui/auth`: `AuthPublicConfig.features.tenancyPosture`
  (`'single' | 'group' | 'isolated'`, exported as `TenancyPosture`) mirrors
  the server's public auth config key. It gates nothing — `multiOrgEnabled`
  stays the capability flag; this only tells the console how to render org
  context.
- `useTenancyPosture()` (app-shell): reads the posture from the cached auth
  config fetch; `undefined` (older server, unrecognized value, fetch failure)
  keeps every group affordance off, so non-group deployments render
  pixel-identical to today.
- `WorkspaceSwitcher`: under `group` the dropdown labels the active org
  "Working organization" and explains the split — new records are created
  here, views show data from all your organizations.
- `RecordFormPage` (create mode): org-walled objects show a "Creates in
  <active org>" badge naming the engine's write target (ADR-0105 D5 stamps
  `organization_id` from the active org).
- Default list columns (`ObjectView`, `InterfaceListPage`, `ObjectDataPage`):
  under `group`, org-walled objects get a TRAILING `organization_id`
  attribution column so cross-org rows are attributable at a glance.
  Render-time only — never persisted into saved view/page metadata, and
  business fields still lead.
