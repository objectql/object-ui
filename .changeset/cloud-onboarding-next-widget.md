---
'@object-ui/app-shell': minor
---

feat(cloud): state-aware onboarding next-step widget for the Cloud Welcome page

The Cloud control-plane Welcome page is static SDUI, but the most useful thing it
can show — "what do I do next?" — depends on live state the metadata can't carry:
does the caller's org already have its production environment? New signups are
auto-provisioned one, so a static "Step 1: create an environment" is wrong for
most first-time users.

Add `cloud:onboarding-next`, a registered SDUI widget that resolves
`hasProductionEnv` from the same org-scoped `/cloud/environment-entitlements`
endpoint the environment list uses, and renders the right primary action:

- no production env → **Create your environment** (the real first step);
- has production env → **Open Production** (full-page nav that follows the SSO
  302 into the env) + **Manage environments**;
- loading → a neutral skeleton (no CTA flash / layout jump);
- unknown / error → degrades to the open-production actions, so the button
  always works.

Routes and the SSO endpoint come from the page metadata (`properties`), so the
Cloud app owns its URLs and copy; the widget owns only the state logic.
