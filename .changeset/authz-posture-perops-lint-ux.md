---
'@object-ui/app-shell': minor
---

Authorization authoring UX — surface the ADR-0066 security primitives the
framework now enforces (④ secure-by-default posture, ⑤ per-operation
requiredPermissions, ⑨ capability-reference lint).

**Access matrix — private-posture badge (④).** `PermissionMatrixEditor` object
rows now show an amber **Private** badge when the object declares
`access: { default: 'private' }`, with a tooltip explaining that a permission
set's `'*'` wildcard grant does NOT cover the object — without this, an admin
reading the matrix would assume a wildcard set reaches it while the server
403s. The object catalog mapping threads `access.default` through
(`ObjectSummary.accessDefault`).

**Object designer — Access section (④ + ⑤).** `ObjectDefaultInspector` (shared
by metadata-admin and the Studio Data-pillar settings tab) gains an "Access"
section: an exposure-posture select (`public`/`private`, with a warning hint
that a private object needs an explicit grant before anyone but platform
admins can use it), and a "Required capabilities" editor for the object-level
`requiredPermissions` AND-gate. The capability editor supports both shapes —
`string[]` (all operations) and the per-operation `{read,create,update,delete}`
map — with a mode toggle that converts losslessly (all→per-op copies the list
into every operation; per-op→all unions). The per-operation toggle is
**feature-detected** against the bundled `@objectstack/spec` (it needs the ⑤
union, spec ≥ 12.7) so the UI never offers a shape client-side validation
would reject; map-form drafts always render per-operation inputs.

**Publish — capability-reference lint (⑨).** `usePublishAllDrafts` now runs
`validateCapabilityReferences` from `@objectstack/lint` over the pending
object/app/action drafts (declaration side = published permission sets ∪
pending permission drafts) and surfaces "capability registered nowhere"
warnings as a post-publish toast. Strictly advisory and fail-safe: the rule is
feature-detected (no-op until the lint dependency ships it), and any
client/import/rule failure is swallowed — the lint can never break or block
publishing.
