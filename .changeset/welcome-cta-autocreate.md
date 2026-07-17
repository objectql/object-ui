---
'@object-ui/components': patch
'@object-ui/app-shell': patch
---

Welcome-page "Create your environment" deep-links straight into the create
dialog (#844): `action:button` gains a client-side `autoTrigger` flag (runs
the action once on mount — same execute path as a click, so param dialogs /
confirms / entitlement gates still apply), and the environments list consumes
`?runAction=create_environment` to mark its create action once entitlements
resolve (upgrade-locked orgs get the upgrade prompt instead; the param is
stripped after consumption so refresh/back don't re-open). Also localizes the
EnvironmentListToolbar's state-aware label overrides ({en,zh}) — they were
hard-coded English inside a zh console.
