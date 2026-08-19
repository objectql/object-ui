---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Show the current organization in the console top bar for users with exactly one
membership.

`WorkspaceSwitcher` is a multi-membership affordance — with one organization
there is nothing to switch to, so it renders nothing — and it was also the only
place the console ever displayed the organization name. On a deployment whose
tenancy posture puts an organization wall in force (`isolated` or `group`), that
left a single-membership business user with no indication anywhere of which
organization they were looking at, while every list on the page was silently
scoped to it. Found in a downstream multi-tenant acceptance run.

The new `CurrentOrganizationIndicator` renders the active organization name
read-only — no trigger, no menu, no click target — in exactly the case the
switcher declines. The switcher's own visibility rule is unchanged, and
deployments without an organization wall (`single` posture, or a server that
reports no posture at all) render nothing new: the top bar stays
organization-silent where organizations are not a scope the user is inside.

Adds one translated string, `organization.current.label`, in all ten packs.
