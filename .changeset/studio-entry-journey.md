---
"@object-ui/app-shell": patch
---

feat(studio): builder landing + `studio:builder` entry — the builder joins the login journey

The pillar application builder was a URL-only surface (zero links anywhere pointed at
`/studio/...`). Now it has a front door wired into the platform journey:

- **BuilderLanding** — pick or create a writable base package (writable bases lead,
  read-only code packages listed for browsing), then jump into the full-screen pillar
  builder. Served standalone at bare **`/studio`** (bookmarkable) and embeddable via
  the **`studio:builder`** component ref, which the framework's Studio app references
  from its new 「App Builder」 nav entry — so the journey is: login → Home → Studio →
  App Builder → package → build.
- `/studio/:packageId` now lands on **`data`** (the pillar order's first surface)
  instead of `interfaces`.
- Package-list parsing/creation is extracted to `packages-io` and shared by the
  landing and the top-bar package switcher.
