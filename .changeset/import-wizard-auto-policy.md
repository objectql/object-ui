---
"@object-ui/app-shell": minor
"@object-ui/i18n": patch
---

**Console user-import wizard defaults to the `auto` password policy (tracks framework#3236).** The "Sign-in setup for imported users" selector gains an **Automatic (recommended)** option and it is now the default (was "No password"). `auto` decides per row on the server: reachable users get an invitation (email / SMS), anyone who can't be reached gets a one-time password shown once on the result screen — so it works with or without an email/SMS service, and the one-time-password reveal now surfaces only the rows that actually fell back (instead of the whole batch under `temporary`).

The other three policies are unchanged and still selectable: `invite` (force invitations, unreachable rows fail), `temporary` (force one-time passwords for every row), `none` (identity only). New `console.identityImport.policy.auto` / `policyHint.auto` strings added for `en` and `zh`; the `none` label drops its "(recommended)" marker.
