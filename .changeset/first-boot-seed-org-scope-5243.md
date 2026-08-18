---
'@object-ui/app-shell': patch
---

Fix the metadata seed cache delivering nothing on the boot right after a first login.

On a browser that has never signed in, `ActiveOrganizationStorage` is empty at
mount, so the eager `app` fetch — one round trip — lands long before
`AuthProvider` resolves the active organization (`getSession` →
`listOrganizations` → `getActiveOrganization`). The seed entry was therefore
written under the no-org scope while every later boot computes the real
organization id, so the entry was never read again and an orphaned no-org entry
was left in `sessionStorage` until the tab closed.

The entry is now moved onto the resolved organization's key at the moment the
organization resolves, taken from the live cache entry — no extra request and no
deferred render. This is a relabelling rather than a re-scoping: that first
request carries no `X-Tenant-ID`, and the server does not read that header for
tenant scoping (`resolveAuthzContext` derives the tenant from
`session.activeOrganizationId` alone), so the response was already computed for
exactly the organization being stamped.
