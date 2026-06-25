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

Adds a gated **"Create workspace"** entry to the org switcher (avatar dropdown) that
opens the dialog directly — previously a single-org user could never reach it, because
the only path (`/organizations`) auto-skips to home when you belong to exactly one org.
The eager provision is idempotent: a control plane that auto-provisions the production
env on org create resolves it to "already provisioned" rather than erroring.

Also removes the unreferenced `apps/console` `CreateWorkspaceDialog` duplicate; the live
component is the app-shell copy used by `OrganizationsPage`.
