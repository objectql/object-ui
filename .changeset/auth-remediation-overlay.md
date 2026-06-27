---
'@object-ui/auth': minor
'@object-ui/app-shell': minor
---

Auth: remediation overlay for the ADR-0069 session gate (enforced MFA / password expiry)

The ObjectStack backend now blocks logged-in users from protected resources with `403 { error: { code: 'MFA_REQUIRED' | 'PASSWORD_EXPIRED' } }`. The Console now detects this on every API response and raises a full-screen, guided remediation flow instead of leaving the user on failing requests.

- `@object-ui/auth`: the authenticated fetch wrapper detects the gate and broadcasts it via a tiny module-level emitter; `AuthProvider` exposes `remediationRequired` + `setRemediationRequired`; the `twoFactorClient` plugin is enabled and `enrollTotp` / `verifyTotp` are added to the auth client (`changePassword` already existed).
- `@object-ui/app-shell`: a `RemediationOverlay` (mounted in `ConsoleShell`) renders the guided flow — change an expired password, or enrol an authenticator (password confirm → QR + backup codes → verify TOTP) — then reloads so the app re-fetches cleanly. Auth + metadata + `me/*` reads stay reachable (server allow-list), so the overlay renders above a normally-loading shell.
