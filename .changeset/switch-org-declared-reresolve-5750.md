---
'@object-ui/auth': patch
---

`switchOrganization` now re-resolves identity for the organization it just switched
to by its own explicit decision, instead of depending on an accidental
`TokenStorage` side effect to notice the switch (objectui#5750).

`AuthProvider.switchOrganization` has never called `loadSession()` itself. Identity
re-resolved across a switch only because `POST /organization/set-active` happens to
return the SIGNED `token.signature` spelling in `set-auth-token`, which differs from
the UNSIGNED `session.token` spelling `getSession()` normally stores — so
`TokenStorage.set` reads the flip as a rotation and the objectui#4467 subscription
calls `loadSession()` for it (measured and pinned in objectui#5749/#5719). That
signed spelling is deterministic on the raw session token, not on the organization:
two switches with no `get-session` landing in between produce the identical signed
value, so the SECOND `TokenStorage.set` sees no change, never notifies, and identity
is left answering for whichever organization the FIRST switch targeted even though
`activeOrganization` already reads as the new one.

Reachable in the console via `OrganizationLayout`'s slug-driven effect (the "Manage"
link on an org card, plus its own "Back to organizations" button) — ordinary
client-side navigation with no full-page reload and nothing debouncing repeat
switches. `WorkspaceSwitcher` and `OrganizationsPage`'s own card click were not
reachable paths for this: both force `window.location.href` immediately after a
successful switch, and the resulting fresh `AuthProvider` mount always performs an
authoritative `loadSession()` regardless of how the race above resolved.

`switchOrganization` now tracks the organization it last resolved to itself and
re-resolves explicitly whenever a switch's target differs from that, while
suppressing the (now redundant) rotation notification for its own `set-active`
call — so the common single-switch path still spends exactly one `get-session`, not
two. A generation guard discards a still-in-flight, now-superseded switch's answer
rather than let it clobber a later switch's fresher one.
