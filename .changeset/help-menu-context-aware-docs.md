---
"@object-ui/app-shell": minor
"@object-ui/console": minor
"@object-ui/i18n": patch
---

feat(header): context-aware Help & Documentation menu + app-scoped docs index

The top-right "?" was a bare external link to `docs.objectstack.ai`, duplicating
the left sidebar's in-product `/docs` entry and ignoring the ADR-0046 docs hub.
It is now an aggregated, context-aware menu:

- **This app's docs** — shown only when the current app's package owns docs
  (matched by `_packageId`). A single-doc app deep-links straight to the
  viewer; a multi-doc app lands on the new app-scoped index.
- **All documentation** — the in-product `/docs` portal.
- **Online documentation** — `docs.objectstack.ai` (opens in a new tab).

Docs are lazily fetched once on first menu open (names/labels only), so the menu
adds no cost until used; a failed fetch soft-degrades to the static entries.

Also adds the app-scoped docs index route **`/apps/:packageId/docs`**
(`AppDocsIndex`) — the package-scoped sibling of `/docs`, listing just that
app's docs — which the "This app's docs" entry targets when an app ships more
than one. New `help.*` strings added to the `en` and `zh` bundles (other
locales fall back to `en`).
