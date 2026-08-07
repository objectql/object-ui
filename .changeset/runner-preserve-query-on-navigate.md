---
'@object-ui/runner': patch
---

Runner in-app navigation now carries the current query string across to the pushed URL instead of `pushState`-ing a bare path. Opening the Runner with `?api=<base>` and clicking a sidebar entry no longer drops the parameter from the address bar, so reloading or sharing the resulting URL still reaches the same backend rather than silently falling back to the (normally empty) `LocalBundleLoader` and rendering `Page not found`. The whole query string is preserved, not just `api` — `@object-ui/core`'s `?__debug…` flags survive navigation for the same reason. A navigation target that spells out its own query keeps it and wins on collision, with the remaining current parameters merged in behind it (#3578).
