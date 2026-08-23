---
'@object-ui/auth': patch
'@object-ui/console': patch
---

The active organization id is now stored per user, and a change of session user drops the
previous user's client state wholesale (objectui#5664).

`auth-active-organization-id` was a single un-namespaced `localStorage` key while its
siblings were already user-scoped (`objectui-recent-items:u:`, `objectui-favorites:u:`,
`flow-palette-recents:u:`). On a browser handed from one account to another — a shared
machine, a kiosk, a handover, a support session — the arriving user's console read the
PREVIOUS user's organization id. The header workspace chip rendered the previous user's
workspace for a user whose `organization/list` was empty, and the consequence past the
cosmetics is the one worth stating: the polluted org context suppressed
`RequireOrganization`'s routing into the guided "Create your workspace" first-run flow, so
a brand-new user on that browser silently never got the new-user flow at all.

Nothing about row visibility rode on this. With the stale id the server answers
`403 USER_IS_NOT_A_MEMBER` on `get-full-organization` and `set-active`, and lists zero
environments; the damage was entirely in what the client believed about itself.

Three changes, and the third is the one that closes the class rather than the instance:

- The key is per-user (`auth-active-organization-id:u:$userId`), matching the convention
  its siblings already use.
- It can no longer be written un-namespaced at all. Where no session user is known yet the
  value lives in memory for that page-load only — a namespacing that kept a bare-key
  fallback would re-open the defect the first time a write happened before the user id
  resolved.
- **A change of session user drops the previous user's client state wholesale.** This is an
  allowlist sweep of both `localStorage` and `sessionStorage`, not a list of known keys, so
  the NEXT storage key someone adds without a `:u:` scope is covered before it is written.
  Only device-scoped entries survive: the arriving session's own bearer token, the pointer
  recording whose state the browser holds, and the UI theme.

Both properties objectui#5703 established are preserved and still pinned: `get()` prefers a
non-null `localStorage` read and falls back to the in-memory value, and the memory value is
nulled BEFORE storage is touched — by `clear()` as before, and now by the user-change purge
too, so the outgoing user's org id cannot outlive their persisted key on the sign-out-then-
sign-in path that never reloads the page.

Existing browsers are not migrated. A value sitting under the retired bare key is
unattributable — nothing recorded whose org id it is — so migrating it is precisely the
defect it would be migrating away from, and it is deleted instead. A signed-in user loses
nothing durable: the active organization is a server-owned fact that
`AuthProvider.refreshOrganizations` re-asks for whenever the list is non-empty and no
active org is held, including the ADR-0081 single-membership repair. One boot re-supplies
it; users with no organization land on the guided first-run flow, which is the outcome this
card is about.

`apps/console`'s pre-render auth preflight purges every spelling of the active-org key —
the retired bare one and each `:u:` scope — when it finds a dead bearer token, and
deliberately leaves the session-user pointer in place so the next sign-in can still tell
that the browser changed hands.
