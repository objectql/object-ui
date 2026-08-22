---
'@object-ui/auth': minor
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Stop showing an access-denied screen to a real administrator while their
adminship is still resolving.

`useIsWorkspaceAdmin()` returned a bare `boolean`, so "the inputs have not
arrived yet" and "resolved: not an admin" were the same answer. One of its three
sources — the active organization member row — is fetched some round trips after
the session (`listOrganizations` → `getActiveOrganization` → `getActiveMember`),
so an administrator whose adminship lives only in that row rendered at least
once as a non-admin, and every gate downstream acted on it: the two marketplace
surfaces painted `MarketplaceAccessDenied`, the console chrome dropped and
re-added its admin nav entry, and `AppContent` fired a `<Navigate to="/home"
replace>` that the later flip could not undo.

**Breaking (published API, hence `minor` per this repo's version policy):**
`useIsWorkspaceAdmin(): boolean` is replaced by
`useWorkspaceAdminStatus(): { isAdmin: boolean; isResolved: boolean }`. The old
name is removed rather than kept alongside, so a call site that ignores the
third state fails to compile instead of silently refusing an administrator.

    -const isAdmin = useIsWorkspaceAdmin();
    +const { isAdmin, isResolved } = useWorkspaceAdminStatus();

`AuthProvider` gains `isMembershipResolved` on its context — the organization /
member pipeline has reached a terminal state — because `organizations`,
`activeOrganization` and `activeMember` read `[]` / `null` / `null` both before
the pipeline starts and after it finds nothing.

No extra wait for administrators: `isResolved` is true the instant `isAdmin` is,
so an admin the session already identifies through `positions[]` never waits on
the member row.
