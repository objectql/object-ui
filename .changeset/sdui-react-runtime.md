---
"@object-ui/react-runtime": minor
"@object-ui/console": patch
---

New `@object-ui/react-runtime` — the trusted runtime-React tier for `kind:'react'` pages (vendored react-runner: Sucrase transpile + scope-eval, no sandbox). Renders real JSX/TSX (any HTML + JS + hooks/useState/map/onClick) in the main React tree with an injected scope (React, registered components, page data) and a built-in error boundary. Lazy-loadable and gated to enterprise/private deployments where authors are trusted.
