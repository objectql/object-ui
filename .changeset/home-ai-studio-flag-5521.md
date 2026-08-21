---
'@object-ui/app-shell': minor
---

Console Home stops offering the metadata-authoring front door on a deployment
whose own runtime config says authoring is not offered there (objectui#5521).

The "Build an app" cover card is now withheld when
`GET /api/v1/runtime/config` reports `features.aiStudio: false`. On the composed
hosted-SaaS shape that card led a plain tenant into the full authoring flow
behind a runtime whose `/api/v1/meta/*` answers `403` and whose ToolRegistry
holds zero authoring handlers — the entry was offered and the refusal arrived at
submit. The lockdown criterion for that shape is two-part, UI entry hidden AND
API refused; only the backend half was green.

- The card is **hidden, not dimmed**, because that is the flag's own declared
  meaning on both sides of the wire: `RuntimeFeatures.aiStudio` documents "when
  false, the SPA hides the AI authoring affordances", and the serving plugin
  documents "set false to force-hide the authoring UI".
- `features.marketplace` keeps the different presentation objectui#5504 gave it
  — a dimmed card plus a visible localized reason. That flag means a route is
  reachable; this one means force-hide. "Start with a template" is untouched:
  installing a marketplace package is not AI metadata authoring and answers to
  its own flags.
- No reason line is rendered in its place. `home.build.noCapability` says the
  *account* lacks "Manage Metadata"; on a runtime with no authoring at all the
  surface is absent for everyone, and pointing a viewer at a permission that
  would not help them is the misdirection objectui#5557 is about.
- Unknown fails **OPEN** (`!== false`), the doctrine `isMarketplaceEnabled()`
  already encodes: a runtime predating the flag, or one whose config fetch
  failed, keeps the card exactly as visible as before.

No new authorable config key, no new server surface, and no new copy — the flag
was already being served and already reaches the browser.
