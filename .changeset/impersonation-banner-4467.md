---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

The console shows a standing impersonation banner, with an exit that fails loudly (#4467).

While `session.impersonatedBy` is present, `ConsoleShell` renders a banner naming BOTH
parties — the impersonated user, whose name every write is recorded under, and the
administrator who started it — plus a stop affordance. It derives from the session rather
than from client memory of the click, so it survives a full SPA reboot, a new tab and a
browser restart, and it cannot disagree with who the server thinks is acting. An ordinary
session renders `null` and its chrome is unchanged.

The exit calls `POST /auth/admin/stop-impersonating` over the same data lane and then
awaits a session refresh. The server restores the administrator from the `admin_session`
COOKIE, so a deployment that blocks cookies cannot exit this way — the banner says so and
stays up instead of appearing to succeed, which would leave the operator doing ordinary
work under someone else's identity.

Ten locale packs carry the banner's copy.
