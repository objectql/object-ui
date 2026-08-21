---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Marketplace-less runtimes now say so instead of erroring: `OS_CLOUD_URL=off` is a
first-class disabled state, and the load-failure hint describes the control plane
the runtime was actually pointed at (objectui#5504).

`apps/objectos-ee/deploy/.env.example` ships `OS_CLOUD_URL=off` as its factory
default, so a stock self-hosted stack has no marketplace at all. The Console still
recommended one: Home led with "Start with a template" and "Browse App
Marketplace", and the click landed on a red **Failed to load marketplace / Not
found** card whose hint claimed this runtime "points at the public ObjectStack
cloud by default" and advised setting `OS_CLOUD_URL`. Both claims were false for
exactly the deployment reading them — the operator had not left the default, and
the advice pointed back at the template that told them to set `off`. "Marketplace
disabled by configuration" is a configuration conclusion, not a load failure.

- `isMarketplaceEnabled()` (`runtime-config`) reads the server's own
  `features.marketplace`, which `RuntimeConfigPlugin` derives per request from the
  serving app's route table (objectstack#8356). It is never inferred from the shape
  of a failed request: a control plane that is merely DOWN leaves the flag `true`,
  so an outage still renders as an outage. Unknown fails OPEN.
- The marketplace page renders an informational "App Marketplace is turned off"
  state — muted, not `destructive` — and issues no request it knows will 404.
- Home's "Start with a template" cover greys out with a visible localized reason,
  and the "Browse App Marketplace" shortcut is withheld, exactly as they already
  are for the `manage_metadata` capability gate.
- `marketplace.load.failedHint` is replaced by `failedHintConfigured` (naming the
  configured control plane) and `failedHintSameOrigin`. The "points at the public
  cloud by default" sentence is gone: it was rendered unconditionally, including on
  every runtime whose operator had overridden `OS_CLOUD_URL`.

All ten locale packs carry the new keys.
