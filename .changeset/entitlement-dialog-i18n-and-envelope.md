---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

Localize the environment entitlement dialog and read cloud's nested error envelope.

The free-plan "Development environments are a paid feature" prompt was built from
English string literals in `entitlements.ts` — including the lowercase `your free
plan` sentence users reported (cloud#959). Both spec builders now take a translator
and resolve `environment.entitlement.*`; all ten locale packs carry the strings.
`entitlements.ts` stays dependency-free: `t` is passed in, not imported, and
defaults to the English copy with local `{{token}}` interpolation.

The dialog now renders the Console's own copy rather than the server's prose — a
control plane upgrades independently and only localizes these messages from
cloud#959 on, so preferring the server string left the reactive path English
against every older deployment.

Also fixes the reactive dialog not firing at all: cloud#948 moved coded errors into
a nested envelope (`{ success, error: { code, … } }`), and
`entitlementDialogFromError` read `code` off the top level — returning `null` for
every entitlement 403, so the upgrade dialog degraded to a generic red error toast.
Both shapes are read now.
