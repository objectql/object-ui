---
'@object-ui/app-shell': patch
---

Metadata the console caches for one workspace is no longer read back in another.

`MetadataProvider` seeds its app list from `sessionStorage` before the org-scoped
fetch returns, and the key was built from the metadata TYPE alone
(`objectui:metadata:app`). `sessionStorage` survives the full-page navigation the
workspace switcher performs, so after an org switch every `useMetadata().apps`
consumer in that seed window — the sidebar, app switcher, search, home, inbox and
the landing resolver among them — read the PREVIOUS workspace's app list. It was
the landing resolver that got caught (objectui#4473, patched downstream by a
bounce in that card's PR), but the provider is the mechanism and any consumer in
the window inherited the same wrong answer.

The seed key now carries the active organization, read from the same
`ActiveOrganizationStorage` that `createAuthenticatedFetch` stamps as
`X-Tenant-ID` — so the cache scope is the tenant the server actually filtered the
list for, and the two cannot drift apart. A tab already open across the upgrade
has its old unscoped entry deleted rather than left inert in storage.

Two consequences worth stating, because both are behavior changes rather than
pure fixes:

- A cached EMPTY list is now a MISS. `[]` is truthy, so it used to clear
  `initialLoading` as if it were an answer, making "no apps (cached, possibly
  stale)" indistinguishable from "no apps (fresh)" for every consumer that gates
  on `loading`. Such a mount now stays in its loading state until the fetch lands.
- Changing the active organization WITHOUT a page reload — the workspace
  management pages switch from an effect when the URL names another org — now
  drops the in-memory cache and re-requests the app list, instead of serving the
  previous org's items until the 5-minute TTL lapsed.

The first resolution of the active organization (unknown to known) is
deliberately not treated as a switch: it happens on every boot, and clearing
there would refetch the eager metadata types while they were still in flight.

No org-confidential record data was involved — the cache holds app DEFINITIONS
(name, label, icon, branding, navigation, required-permission names), never
record rows or credentials, and on the switch path the reader is the same signed-in
user reading a workspace they are a member of.
