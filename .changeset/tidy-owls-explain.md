---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Gate Home's metadata-authoring CTAs on the `manage_metadata` capability the
server reports, with a visible localized reason.

"Build an app" and "Start with a template" were gated on `useIsWorkspaceAdmin()`
— a ROLE check. On a multi-tenant deployment that deliberately withholds
metadata authoring from tenants, a workspace owner is an admin by role yet holds
no `manage_metadata`, so the most prominent CTA on their home page led into
`/studio`, a filled-in new-package dialog, and a capability refusal at submit.

Both cover cards are now disabled, with the reason shown on screen and in the
tooltip, whenever the session lacks the capability. The marketplace shortcut in
the apps strip is withheld with them (it targets the same route, so leaving it
live would have made the gate cosmetic), as is the "Build with AI" hero CTA
(its output is draft metadata that cannot be published without the capability).
On a workspace with no apps yet, the admin empty state explains the posture
instead of directing the owner to build their first application.

The gate consumes the answer `GET /api/v1/auth/me/permissions` already returns,
surfaced through the permissions provider — no permission logic is re-derived in
the client. Unknown capabilities fail OPEN: a backend that reports no
`systemPermissions` at all is indistinguishable from one reporting an empty set,
and the server enforces regardless, so nothing is withheld on missing client
data. New key `home.build.noCapability` in all ten locale packs.
