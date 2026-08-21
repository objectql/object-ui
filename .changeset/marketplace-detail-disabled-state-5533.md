---
'@object-ui/app-shell': patch
---

The marketplace **package detail** page now states that the marketplace is turned
off, instead of red-erroring, on a runtime that has none (objectui#5533).

`MarketplacePackagePage` takes the same `isMarketplaceEnabled()` early return its
sibling catalog page took in objectui#5504, rendering the informational
`MarketplaceDisabled` state when the server reports `features.marketplace: false`
(an `OS_CLOUD_URL=off` deployment — the EE template's factory default). Until now
the same runtime answered a bookmarked or pasted package URL with a destructive
"Failed to load package / Not found." card, so the two sibling pages reached
opposite conclusions about one runtime: the catalog called it configuration, the
detail page called it a failure.

Both requests the page fires for its own view are skipped in that state — the
package fetch and the cloud-installation probe — rather than fired and discarded:
a discarded request still reaches the server and can race the destructive card
onto the screen before the disabled state settles.

Scope, deliberately narrow:

- **Not** a "swallow all errors" change. With `features.marketplace: true` the page
  behaves exactly as before, and a package that genuinely is not there still
  renders the destructive card carrying the server's own message. The flag is the
  runtime's own answer, never inferred from the shape of a failure, and it fails
  open — a runtime that answers nothing keeps its detail page.
- The `installLocal` surfaces are untouched. That is a different capability flag,
  and an air-gapped `OS_CLOUD_URL=off` runtime still has a working install-local
  path.
- No new i18n keys: `marketplace.disabled.*` and `marketplace.action.backHome`
  already ship in all ten locale packs.
