---
'@object-ui/app-shell': patch
---

The marketplace **catalog** page now tells a non-admin that the runtime has no
marketplace, instead of telling them they lack permission (objectui#5557).

`MarketplacePage` ordered its two early returns admin-first, so on a runtime that
mounts no marketplace at all (`features.marketplace: false` — an `OS_CLOUD_URL=off`
deployment, the EE deploy template's factory default) an unprivileged member got
"access denied" for a surface that exists for nobody. That answer sends them to
ask an administrator for a grant that would not help them, and it left the
informational disabled state built in objectui#5504 unreachable for every
non-admin. The runtime check now answers first, because "this deployment has no
marketplace" is true regardless of who is asking.

This restores the sibling-page invariant for the one class of viewer it still
failed for: `MarketplacePackagePage` was reordered the same way in objectui#5533,
so on a marketplace-off runtime the catalog page and the package detail page now
give a non-admin the same kind of answer.

Scope, deliberately narrow:

- **Admin-first ordering stays correct where a marketplace exists.** On a runtime
  with `features.marketplace: true`, a non-admin still gets `MarketplaceAccessDenied`
  — the catalog is an install surface, and a member who cannot install has nothing
  to do with it. That boundary is pinned by an explicit test, not left to prose:
  without it, a change that simply dropped the admin check would look correct.
- Nothing an admin sees changes, on either kind of runtime.
- No new i18n keys, and no change to `MarketplaceAccessDenied` or
  `MarketplaceDisabled` themselves — only which of the two the page reaches for,
  and in which order it decides.
- The disabled state is still the server's own answer (`features.marketplace`),
  never inferred from a failed request, and it still fails open.
