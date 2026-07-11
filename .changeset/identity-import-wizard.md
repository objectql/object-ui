---
"@object-ui/plugin-grid": minor
"@object-ui/app-shell": minor
"@object-ui/auth": patch
"@object-ui/i18n": patch
---

feat: identity import — the stock ImportWizard now drives sys_user bulk import (framework#2782)

The Users list gets an Import entry for platform admins (gated on
`features.admin` from `/api/v1/auth/config` plus workspace-admin), wired to
the dedicated `POST /api/v1/auth/admin/import-users` pipeline instead of the
generic data import (which would bypass better-auth hashing and produce
accounts that can never sign in).

- **plugin-grid**: two generic, backend-agnostic ImportWizard slots —
  `extraOptionsContent` (host-injected options on the preview step) and
  `renderResultExtra` (host-rendered content on the result step).
- **app-shell**: identity import dataSource adapter — splits files into the
  endpoint's ≤500-row batches (idempotent upsert makes re-runs safe), injects
  the selected password policy, renumbers per-batch results onto the whole
  file, and enriches rows with their sign-in identity. Password policy panel
  (`none` default / `invite` / `temporary`) and a one-shot temporary-password
  reveal with CSV download (client memory only — nothing is persisted).
  Async-job/undo surfaces are hidden for identity import by design.
- **auth**: `AuthPublicConfig.features.admin` typing.
- **i18n**: en/zh strings for the identity import panels.
