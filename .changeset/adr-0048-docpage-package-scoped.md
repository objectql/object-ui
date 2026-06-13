---
"@object-ui/console": patch
---

ADR-0048: DocPage resolves docs package-scoped. The doc viewer at
`/apps/:appName/docs/:name` now passes the route's package segment as
`getItem('doc', name, { packageId })`, so the single-doc fetch is package-scoped
(prefer-local) on the server. Two installed packages may ship a doc with the
same bare name and each resolves within its own package — doc names no longer
need a globally-unique namespace prefix (the prefix becomes a convention, like
`page`/`dashboard`/`report`). The legacy top-level `/docs/:name` path (no
`appName`) keeps its context-free behavior.
