---
'@object-ui/auth': patch
---

Restore platform-admin detection for permission-set-derived administrators.

`useIsWorkspaceAdmin` decides Setup app + Studio visibility, App Marketplace
gating and the "Build an app" CTAs. Its third source read `user.roles`, a key
the protocol-17 session face no longer emits (framework ADR-0090 D3 renamed it
to `positions`). An administrator whose adminship comes from the
`admin_full_access` permission set — the single-tenant deployment shape, where
there is no organization member row and the server deliberately no longer
overwrites `user.role` — matched none of the three sources and read as **not an
administrator**: Setup and Studio simply disappeared for them.

The hook now reads `user.positions[]`, the one spelling the session publishes.
Detection is restored for that path and unchanged everywhere else: an active
member row with an admin role, a stored `user.role` admin scalar, and
preview/no-auth mode all behave exactly as before, and nobody who was not an
administrator becomes one — pinned by four negative cases alongside the
positive one.

Also corrects the now-stale documentation that described the removed spelling:
the hook's own docblock, the `roles?: string[]` declaration on the client
`AuthUser` (kept for one remaining compile-time reader; see objectui#5424), and
two comments in `@object-ui/app-shell`'s Home page. No behaviour change from the
comment corrections.
