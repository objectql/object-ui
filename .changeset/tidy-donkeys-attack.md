---
'@object-ui/app-shell': patch
---

Restore the avatar menu's "My Workspaces" entry, which navigates to
`/organizations?manage=1`.

Users belonging to exactly one organization had no UI path to the workspace
management pages (Members / Invitations / Organization settings). Three
individually reasonable behaviours closed every door at once: `/organizations`
auto-skips the picker for single-org users, the header `WorkspaceSwitcher`
(which carries "Manage members") renders nothing below two organizations, and
the avatar menu had kept only the `?create=1` entry. Reaching member management
required hand-typing the URL.

The entry is not gated on `multiOrgEnabled` — that flag governs creating
organizations, and where self-service creation is disabled this entry is the
only way in.
