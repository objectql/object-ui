---
'@object-ui/app-shell': minor
---

feat(console): born-with-env eager provisioning for multi-org workspace create

ObjectStack runs a 1-production-environment-per-organization model: a user who wants
another production space creates another organization, and each org is born with its
production environment. The self-service "create workspace" flow now delivers that
without an onboarding-wizard detour.

After `createOrganization` succeeds (which already switches the active org),
`CreateWorkspaceDialog` eagerly `POST`s `/api/v1/cloud/environments` with the new org as
target so its first environment is provisioned as a production env (allowed on every plan,
including free), then hands off to the existing switch-and-navigate-home path. The
provision is best-effort: on failure the onboarding gate provisions the env lazily on
first navigation, so multi-org still works. The `multiOrgEnabled` enable-gate is unchanged
(already wired end-to-end via the auth `/config` `features.multiOrgEnabled` flag).

Also removes the unreferenced `apps/console` `CreateWorkspaceDialog` duplicate; the live
component is the app-shell copy used by `OrganizationsPage`.
